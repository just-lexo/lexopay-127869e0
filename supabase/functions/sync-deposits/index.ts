// Recovery sync: scans recent blockchain history for deposits to all known
// user deposit addresses and credits anything missing. Idempotent thanks to
// the deposits.tx_hash unique index.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TRANSFER_EVENT_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const TOKEN_CONTRACTS: Record<string, { address: string; decimals: number }> = {
  USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
  USDT: { address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", decimals: 6 },
};

// How many recent blocks to scan in recovery mode (~24h on Base @ 2s blocks ≈ 43200)
const DEFAULT_BLOCK_RANGE = 50000;
// eth_getLogs window per request
const CHUNK = 9000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const RPC = Deno.env.get("BASE_RPC_URL") || "https://mainnet.base.org";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth: require admin
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    if (!jwt) return json({ error: "Unauthorized" }, 401);
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const { data: adminCheck } = await supabase
      .from("profiles").select("is_admin").eq("user_id", userData.user.id).maybeSingle();
    if (!adminCheck?.is_admin) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const blockRange = Math.min(Number(body?.blocks) || DEFAULT_BLOCK_RANGE, 200000);

    // Collect all distinct deposit addresses with their owning user
    const { data: deposits, error: dErr } = await supabase
      .from("deposits")
      .select("user_id, address, token, network");
    if (dErr) throw dErr;

    // Map address(lower) -> { user_id, network }
    const addressMap = new Map<string, { user_id: string; network: string }>();
    for (const d of deposits || []) {
      if (d.address) addressMap.set(d.address.toLowerCase(), { user_id: d.user_id, network: d.network });
    }

    // Also include derived addresses for every profile (fallback if not persisted)
    const { data: profiles } = await supabase.from("profiles").select("user_id");
    for (const p of profiles || []) {
      const derived = deriveDepositAddress(p.user_id).toLowerCase();
      if (!addressMap.has(derived)) addressMap.set(derived, { user_id: p.user_id, network: "base" });
    }

    if (addressMap.size === 0) return json({ message: "No addresses to sync", credited: 0 });

    // Existing tx_hashes to skip
    const { data: existingTxs } = await supabase
      .from("deposits").select("tx_hash").not("tx_hash", "is", null);
    const seen = new Set((existingTxs || []).map((r: any) => (r.tx_hash || "").toLowerCase()));

    const currentBlock = await rpcInt(RPC, "eth_blockNumber", []);
    const fromBlock = Math.max(0, currentBlock - blockRange);

    let credited = 0;
    const errors: string[] = [];

    // Scan ERC-20 transfers for each token in chunks
    for (const [symbol, meta] of Object.entries(TOKEN_CONTRACTS)) {
      // Build padded topic list of all addresses (to-address)
      const paddedTo = Array.from(addressMap.keys()).map(
        (a) => "0x000000000000000000000000" + a.slice(2),
      );

      for (let start = fromBlock; start <= currentBlock; start += CHUNK) {
        const end = Math.min(start + CHUNK - 1, currentBlock);
        try {
          const logs = await rpcCall(RPC, "eth_getLogs", [{
            fromBlock: "0x" + start.toString(16),
            toBlock: "0x" + end.toString(16),
            address: meta.address,
            topics: [TRANSFER_EVENT_TOPIC, null, paddedTo],
          }]);
          if (!Array.isArray(logs)) continue;

          for (const log of logs) {
            const txHash = (log.transactionHash || "").toLowerCase();
            if (!txHash || seen.has(txHash)) continue;
            const toTopic = (log.topics?.[2] || "").toLowerCase();
            const toAddr = "0x" + toTopic.slice(-40);
            const owner = addressMap.get(toAddr);
            if (!owner) continue;
            const raw = BigInt(log.data || "0x0");
            const amount = Number(raw) / Math.pow(10, meta.decimals);
            if (amount <= 0) continue;

            const ok = await creditDeposit(supabase, {
              user_id: owner.user_id,
              address: toAddr,
              token: symbol,
              network: owner.network || "base",
              amount,
              tx_hash: txHash,
            });
            if (ok) {
              credited++;
              seen.add(txHash);
            }
          }
        } catch (e) {
          errors.push(`${symbol} ${start}-${end}: ${(e as Error).message}`);
        }
      }
    }

    return json({ message: "Sync complete", credited, addresses: addressMap.size, errors });
  } catch (e) {
    console.error("sync-deposits error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: any, status = 200) {
  // Always return 200; encode failures in payload instead.
  const payload = (body && typeof body === "object") ? { success: !body.error, ...body } : body;
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function rpcCall(url: string, method: string, params: unknown[]) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
  return j.result;
}
async function rpcInt(url: string, method: string, params: unknown[]) {
  const r = await rpcCall(url, method, params);
  return parseInt(r, 16);
}

async function creditDeposit(supabase: any, d: {
  user_id: string; address: string; token: string;
  network: string; amount: number; tx_hash: string;
}) {
  const refId = "LXP-DEP-" + d.tx_hash.slice(2, 10).toUpperCase();
  const now = new Date().toISOString();

  // Insert deposit (unique tx_hash protects against duplicates)
  const { data: inserted, error: insErr } = await supabase
    .from("deposits")
    .insert({
      user_id: d.user_id,
      address: d.address,
      token: d.token,
      network: d.network,
      amount: d.amount,
      tx_hash: d.tx_hash,
      status: "CONFIRMED",
      detected_at: now,
      confirmed_at: now,
      confirmations_count: 12,
      reference_id: refId,
      provider_source: "sync-recovery",
    })
    .select("id")
    .maybeSingle();

  if (insErr) {
    // duplicate or other - skip
    if (String(insErr.message || "").toLowerCase().includes("duplicate")) return false;
    console.error("insert deposit failed", insErr);
    return false;
  }
  if (!inserted) return false;

  // Credit crypto balance
  const { data: wallet } = await supabase
    .from("wallets").select("id").eq("user_id", d.user_id).eq("type", "CRYPTO").single();
  if (wallet) {
    const { data: bal } = await supabase
      .from("crypto_balances").select("balance")
      .eq("wallet_id", wallet.id).eq("token", d.token).eq("network", d.network).maybeSingle();
    if (bal) {
      await supabase.from("crypto_balances")
        .update({ balance: Number(bal.balance || 0) + d.amount })
        .eq("wallet_id", wallet.id).eq("token", d.token).eq("network", d.network);
    } else {
      await supabase.from("crypto_balances").insert({
        wallet_id: wallet.id, token: d.token, network: d.network, balance: d.amount,
      });
    }
  }

  // Transaction record
  await supabase.from("transactions").insert({
    user_id: d.user_id,
    kind: "DEPOSIT",
    title: "Crypto Deposit",
    subtitle: `${d.token} on Base`,
    amount_display: `+${d.amount} ${d.token}`,
    status: "SUCCESS",
    metadata: {
      deposit_id: inserted.id, amount: d.amount, token: d.token,
      network: d.network, tx_hash: d.tx_hash, reference: refId, recovered: true,
    },
  });

  // Notify
  await supabase.from("notifications").insert({
    user_id: d.user_id,
    type: "deposit_confirmed",
    title: "Deposit Recovered",
    message: `${d.amount} ${d.token} credited to your wallet from on-chain history.`,
    related_kind: "deposit",
    related_id: inserted.id,
  });

  return true;
}
