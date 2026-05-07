// Recover a single deposit by its on-chain transaction hash.
// Parses the receipt's ERC-20 Transfer logs (USDC/USDT on Base) and ETH value,
// matches the recipient against any user's known deposit address, and credits
// the user idempotently. Safe to call multiple times — duplicates are skipped
// by the unique index on deposits.tx_hash.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TRANSFER_EVENT_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const TOKENS: Record<string, { address: string; decimals: number; symbol: string }> = {
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": { address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", decimals: 6, symbol: "USDC" },
  "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2": { address: "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2", decimals: 6, symbol: "USDT" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const RPC = Deno.env.get("BASE_RPC_URL") || "https://mainnet.base.org";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth: admin or self (any logged-in user can recover their own deposit)
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!jwt) return json({ error: "Unauthorized" }, 401);
    const { data: userData, error: uErr } = await supabase.auth.getUser(jwt);
    if (uErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const callerId = userData.user.id;
    const { data: adminRow } = await supabase
      .from("profiles").select("is_admin").eq("user_id", callerId).maybeSingle();
    const isAdmin = !!adminRow?.is_admin;

    const body = await req.json().catch(() => ({}));
    let txHash: string = String(body?.tx_hash || "").trim().toLowerCase();
    if (!/^0x[0-9a-f]{64}$/.test(txHash)) {
      return json({ error: "Invalid tx_hash format" }, 400);
    }

    // Fetch receipt + tx
    const [receipt, tx, currentBlock] = await Promise.all([
      rpc(RPC, "eth_getTransactionReceipt", [txHash]),
      rpc(RPC, "eth_getTransactionByHash", [txHash]),
      rpcInt(RPC, "eth_blockNumber", []),
    ]);
    if (!receipt) return json({ error: "Transaction not found on-chain" }, 404);
    if (receipt.status && receipt.status !== "0x1") {
      return json({ error: "Transaction failed on-chain" }, 400);
    }

    const txBlock = parseInt(receipt.blockNumber, 16);
    const confirmations = Math.max(0, currentBlock - txBlock);

    // Build candidate (token, toAddress, amount) tuples from logs
    type Cand = { symbol: string; to: string; amount: number };
    const candidates: Cand[] = [];

    for (const log of receipt.logs || []) {
      const addr = String(log.address || "").toLowerCase();
      const meta = TOKENS[addr];
      if (!meta) continue;
      if (!log.topics || log.topics[0]?.toLowerCase() !== TRANSFER_EVENT_TOPIC) continue;
      const toTopic = (log.topics[2] || "").toLowerCase();
      if (toTopic.length < 66) continue;
      const to = "0x" + toTopic.slice(-40);
      const raw = BigInt(log.data || "0x0");
      const amount = Number(raw) / Math.pow(10, meta.decimals);
      if (amount > 0) candidates.push({ symbol: meta.symbol, to, amount });
    }

    // ETH transfer (native)
    if (tx?.to && tx?.value && BigInt(tx.value) > 0n) {
      candidates.push({
        symbol: "ETH",
        to: String(tx.to).toLowerCase(),
        amount: Number(BigInt(tx.value)) / 1e18,
      });
    }

    if (candidates.length === 0) {
      return json({ error: "No token transfers found in this transaction" }, 400);
    }

    // Match against known deposit addresses (stored) AND derived addresses
    // for every user (in case the address was never persisted).
    const recipients = Array.from(new Set(candidates.map((c) => c.to.toLowerCase())));

    const addrMap = new Map<string, { user_id: string; network: string }>();

    // 1) Stored deposit rows
    const { data: addrRows } = await supabase
      .from("deposits")
      .select("user_id, address, network");
    for (const r of addrRows || []) {
      if (r.address) {
        addrMap.set(String(r.address).toLowerCase(), {
          user_id: r.user_id,
          network: r.network || "base",
        });
      }
    }

    // 2) Derived addresses for every profile
    const { data: profiles } = await supabase
      .from("profiles").select("user_id");
    for (const p of profiles || []) {
      const derived = deriveDepositAddress(p.user_id).toLowerCase();
      if (!addrMap.has(derived)) {
        addrMap.set(derived, { user_id: p.user_id, network: "base" });
      }
    }

    console.log("recover-deposit-by-tx", { txHash, recipients, knownAddrs: addrMap.size });

    const matched = candidates.filter((c) => addrMap.has(c.to.toLowerCase()));
    if (matched.length === 0) {
      return json({
        error: "No matching deposit address for this transaction",
        recipients,
        debug: candidates,
      }, 404);
    }

    // If non-admin, ensure they own at least one matched address
    if (!isAdmin) {
      const ownsAny = matched.some((m) => addrMap.get(m.to)!.user_id === callerId);
      if (!ownsAny) return json({ error: "Forbidden" }, 403);
    }

    let credited = 0;
    const results: any[] = [];
    for (const m of matched) {
      const owner = addrMap.get(m.to)!;
      // Non-admin: only their own
      if (!isAdmin && owner.user_id !== callerId) continue;

      const ok = await credit(supabase, {
        user_id: owner.user_id,
        address: m.to,
        token: m.symbol,
        network: owner.network,
        amount: m.amount,
        tx_hash: txHash,
        confirmations,
      });
      results.push({ to: m.to, token: m.symbol, amount: m.amount, credited: ok });
      if (ok) credited++;
    }

    return json({
      message: credited > 0 ? "Deposit recovered" : "Already processed",
      credited, confirmations, results,
    });
  } catch (e) {
    console.error("recover-deposit-by-tx error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: any, s = 200) {
  // Always return 200 to avoid non-2xx errors at the client.
  // Surface errors via { error } / { success:false } in body instead.
  const body = (b && typeof b === "object") ? { success: !b.error, ...b } : b;
  return new Response(JSON.stringify(body), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
async function rpc(url: string, method: string, params: unknown[]) {
  const r = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
  return j.result;
}
async function rpcInt(url: string, method: string, params: unknown[]) {
  return parseInt(await rpc(url, method, params), 16);
}

async function credit(supabase: any, d: {
  user_id: string; address: string; token: string; network: string;
  amount: number; tx_hash: string; confirmations: number;
}) {
  const refId = "LXP-DEP-" + d.tx_hash.slice(2, 10).toUpperCase();
  const now = new Date().toISOString();

  // Try to update an existing PENDING deposit row first (so the user's
  // generated address row becomes CONFIRMED), else insert a fresh row.
  const { data: pending } = await supabase
    .from("deposits")
    .select("id, status")
    .eq("user_id", d.user_id)
    .eq("address", d.address)
    .eq("token", d.token)
    .in("status", ["PENDING", "DETECTED"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Skip if this tx_hash is already credited anywhere
  const { data: dup } = await supabase
    .from("deposits").select("id").eq("tx_hash", d.tx_hash).maybeSingle();
  if (dup) return false;

  let depositId: string | null = null;
  if (pending) {
    const { data: upd, error: uErr } = await supabase
      .from("deposits")
      .update({
        status: "CONFIRMED",
        amount: d.amount,
        tx_hash: d.tx_hash,
        detected_at: now,
        confirmed_at: now,
        confirmations_count: Math.min(12, d.confirmations),
        reference_id: refId,
        provider_source: "recover-by-tx",
      })
      .eq("id", pending.id)
      .select("id").maybeSingle();
    if (uErr) { console.error("update pending failed", uErr); return false; }
    depositId = upd?.id || null;
  } else {
    const { data: ins, error: iErr } = await supabase.from("deposits").insert({
      user_id: d.user_id, address: d.address, token: d.token, network: d.network,
      amount: d.amount, tx_hash: d.tx_hash, status: "CONFIRMED",
      detected_at: now, confirmed_at: now, confirmations_count: Math.min(12, d.confirmations),
      reference_id: refId, provider_source: "recover-by-tx",
    }).select("id").maybeSingle();
    if (iErr) {
      if (String(iErr.message || "").toLowerCase().includes("duplicate")) return false;
      console.error("insert deposit failed", iErr); return false;
    }
    depositId = ins?.id || null;
  }
  if (!depositId) return false;

  // Credit crypto balance
  const { data: wallet } = await supabase
    .from("wallets").select("id").eq("user_id", d.user_id).eq("type", "CRYPTO").maybeSingle();
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

  await supabase.from("transactions").insert({
    user_id: d.user_id, kind: "DEPOSIT",
    title: "Crypto Deposit", subtitle: `${d.token} on Base`,
    amount_display: `+${d.amount} ${d.token}`, status: "SUCCESS",
    metadata: { deposit_id: depositId, amount: d.amount, token: d.token,
      network: d.network, tx_hash: d.tx_hash, reference: refId, recovered: true },
  });

  await supabase.from("notifications").insert({
    user_id: d.user_id, type: "deposit_confirmed",
    title: "Deposit Confirmed",
    message: `${d.amount} ${d.token} credited to your wallet.`,
    related_kind: "deposit", related_id: depositId,
  });

  return true;
}
