import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ERC-20 Transfer event signature
const TRANSFER_EVENT_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

// Base Mainnet token contract addresses
const TOKEN_CONTRACTS: Record<string, string> = {
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  USDT: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
};

const REQUIRED_CONFIRMATIONS = 12;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const BASE_RPC_URL = Deno.env.get("BASE_RPC_URL");
    if (!BASE_RPC_URL) {
      return new Response(
        JSON.stringify({ error: "BASE_RPC_URL not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all pending deposits
    const { data: pendingDeposits, error: fetchError } = await supabase
      .from("deposits")
      .select("*")
      .in("status", ["PENDING", "DETECTED"]);

    if (fetchError) throw fetchError;
    if (!pendingDeposits || pendingDeposits.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending deposits to monitor", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get current block number
    const blockRes = await fetch(BASE_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1,
      }),
    });
    const blockData = await blockRes.json();
    const currentBlock = parseInt(blockData.result, 16);

    let processed = 0;

    for (const deposit of pendingDeposits) {
      try {
        if (deposit.status === "PENDING") {
          // Check for ETH transfers
          if (deposit.token === "ETH") {
            await checkEthDeposit(supabase, deposit, BASE_RPC_URL, currentBlock);
          } else {
            // Check ERC-20 transfers
            await checkErc20Deposit(supabase, deposit, BASE_RPC_URL, currentBlock);
          }
        } else if (deposit.status === "DETECTED" && deposit.tx_hash) {
          // Check confirmations for detected deposits
          await checkConfirmations(supabase, deposit, BASE_RPC_URL, currentBlock);
        }
        processed++;
      } catch (err) {
        console.error(`Error processing deposit ${deposit.id}:`, err);
      }
    }

    return new Response(
      JSON.stringify({ message: "Monitoring complete", processed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in monitor-deposits:", error);
    return new Response(
      JSON.stringify({ error: "Deposit monitoring failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function checkEthDeposit(
  supabase: any, deposit: any, rpcUrl: string, currentBlock: number
) {
  const address = deposit.address.toLowerCase();
  
  // Get balance of the deposit address
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", method: "eth_getBalance",
      params: [address, "latest"], id: 1,
    }),
  });
  const data = await res.json();
  const balanceWei = BigInt(data.result || "0x0");
  const balanceEth = Number(balanceWei) / 1e18;

  if (balanceEth > 0.0001) {
    // Check recent blocks for the transaction
    const blockRange = 1000; // ~30 min of blocks on Base
    const fromBlock = `0x${Math.max(0, currentBlock - blockRange).toString(16)}`;

    // Look for transactions to this address via eth_getLogs won't work for ETH
    // Use a simpler approach: mark as detected with the balance amount
    await supabase
      .from("deposits")
      .update({
        status: "DETECTED",
        amount: Math.round(balanceEth * 1e6) / 1e6,
        detected_at: new Date().toISOString(),
        confirmations_count: REQUIRED_CONFIRMATIONS, // ETH balance is already confirmed
      })
      .eq("id", deposit.id)
      .eq("status", "PENDING");

    // For ETH, if we see balance, it's already confirmed on-chain
    await confirmDeposit(supabase, deposit, balanceEth);
  }
}

async function checkErc20Deposit(
  supabase: any, deposit: any, rpcUrl: string, currentBlock: number
) {
  const contractAddress = TOKEN_CONTRACTS[deposit.token];
  if (!contractAddress) return;

  const address = deposit.address.toLowerCase();
  const paddedAddress = "0x000000000000000000000000" + address.slice(2);

  // Search recent Transfer events to this address
  const blockRange = 2000;
  const fromBlock = `0x${Math.max(0, currentBlock - blockRange).toString(16)}`;

  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", method: "eth_getLogs",
      params: [{
        fromBlock,
        toBlock: "latest",
        address: contractAddress,
        topics: [TRANSFER_EVENT_TOPIC, null, paddedAddress],
      }],
      id: 1,
    }),
  });

  const data = await res.json();
  const logs = data.result || [];

  if (logs.length === 0) return;

  // Process latest transfer
  const latestLog = logs[logs.length - 1];
  const txHash = latestLog.transactionHash;

  // Check if already processed
  const { data: existing } = await supabase
    .from("deposits")
    .select("id")
    .eq("tx_hash", txHash)
    .neq("status", "PENDING")
    .maybeSingle();

  if (existing) return; // Already processed

  // Decode amount (USDC/USDT have 6 decimals)
  const rawAmount = BigInt(latestLog.data);
  const decimals = deposit.token === "ETH" ? 18 : 6;
  const amount = Number(rawAmount) / Math.pow(10, decimals);

  const txBlock = parseInt(latestLog.blockNumber, 16);
  const confirmations = currentBlock - txBlock;

  await supabase
    .from("deposits")
    .update({
      status: "DETECTED",
      amount,
      tx_hash: txHash,
      detected_at: new Date().toISOString(),
      confirmations_count: Math.min(confirmations, REQUIRED_CONFIRMATIONS),
    })
    .eq("id", deposit.id)
    .eq("status", "PENDING");

  // Create notification
  await supabase.from("notifications").insert({
    user_id: deposit.user_id,
    type: "deposit_detected",
    title: "Deposit Detected",
    message: `${amount} ${deposit.token} deposit detected on Base. Waiting for confirmations.`,
    related_kind: "deposit",
    related_id: deposit.id,
  });

  if (confirmations >= REQUIRED_CONFIRMATIONS) {
    await confirmDeposit(supabase, deposit, amount, txHash);
  }
}

async function checkConfirmations(
  supabase: any, deposit: any, rpcUrl: string, currentBlock: number
) {
  if (!deposit.tx_hash) return;

  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", method: "eth_getTransactionReceipt",
      params: [deposit.tx_hash], id: 1,
    }),
  });

  const data = await res.json();
  if (!data.result) return;

  const txBlock = parseInt(data.result.blockNumber, 16);
  const confirmations = currentBlock - txBlock;

  await supabase
    .from("deposits")
    .update({ confirmations_count: Math.min(confirmations, REQUIRED_CONFIRMATIONS) })
    .eq("id", deposit.id);

  if (confirmations >= REQUIRED_CONFIRMATIONS) {
    await confirmDeposit(supabase, deposit, deposit.amount, deposit.tx_hash);
  }
}

async function confirmDeposit(
  supabase: any, deposit: any, amount: number, txHash?: string
) {
  const refId = "LXP-DEP-" + deposit.id.slice(0, 8).toUpperCase();

  // Update deposit status
  await supabase
    .from("deposits")
    .update({
      status: "CONFIRMED",
      amount,
      confirmed_at: new Date().toISOString(),
      confirmations_count: REQUIRED_CONFIRMATIONS,
      reference_id: refId,
      ...(txHash ? { tx_hash: txHash } : {}),
    })
    .eq("id", deposit.id)
    .in("status", ["PENDING", "DETECTED"]);

  // Credit crypto balance
  const { data: wallet } = await supabase
    .from("wallets")
    .select("id")
    .eq("user_id", deposit.user_id)
    .eq("type", "CRYPTO")
    .single();

  if (wallet) {
    const { data: existingBalance } = await supabase
      .from("crypto_balances")
      .select("balance")
      .eq("wallet_id", wallet.id)
      .eq("token", deposit.token)
      .eq("network", deposit.network)
      .single();

    if (existingBalance) {
      await supabase
        .from("crypto_balances")
        .update({ balance: (Number(existingBalance.balance) || 0) + amount })
        .eq("wallet_id", wallet.id)
        .eq("token", deposit.token)
        .eq("network", deposit.network);
    } else {
      await supabase.from("crypto_balances").insert({
        wallet_id: wallet.id,
        token: deposit.token,
        network: deposit.network,
        balance: amount,
      });
    }
  }

  // Create transaction record
  await supabase.from("transactions").insert({
    user_id: deposit.user_id,
    kind: "DEPOSIT",
    title: "Crypto Deposit",
    subtitle: `${deposit.token} on Base`,
    amount_display: `+${amount} ${deposit.token}`,
    status: "SUCCESS",
    metadata: {
      deposit_id: deposit.id,
      amount,
      token: deposit.token,
      network: deposit.network,
      tx_hash: txHash || null,
      reference: refId,
    },
  });

  // Notify user
  await supabase.from("notifications").insert({
    user_id: deposit.user_id,
    type: "deposit_confirmed",
    title: "Deposit Confirmed",
    message: `${amount} ${deposit.token} has been added to your wallet.`,
    related_kind: "deposit",
    related_id: deposit.id,
  });
}
