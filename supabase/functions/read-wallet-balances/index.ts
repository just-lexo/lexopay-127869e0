const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Base network token contracts
const TOKENS: Record<string, { contract: string; decimals: number }> = {
  USDC: { contract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
  USDT: { contract: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", decimals: 6 },
};

// ERC-20 balanceOf selector
const BALANCE_OF_SELECTOR = "0x70a08231";

async function rpcCall(rpcUrl: string, method: string, params: any[]) {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

async function getEthBalance(rpcUrl: string, address: string): Promise<string> {
  const result = await rpcCall(rpcUrl, "eth_getBalance", [address, "latest"]);
  const wei = BigInt(result);
  // Convert to ETH string with precision
  const eth = Number(wei) / 1e18;
  return eth.toFixed(8);
}

async function getErc20Balance(
  rpcUrl: string,
  tokenContract: string,
  walletAddress: string,
  decimals: number
): Promise<string> {
  const paddedAddress = walletAddress.slice(2).padStart(64, "0");
  const data = BALANCE_OF_SELECTOR + paddedAddress;

  const result = await rpcCall(rpcUrl, "eth_call", [
    { to: tokenContract, data },
    "latest",
  ]);

  const rawBalance = BigInt(result);
  const balance = Number(rawBalance) / Math.pow(10, decimals);
  return balance.toFixed(decimals);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const walletAddress = url.searchParams.get("address");

    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return new Response(
        JSON.stringify({ error: "Valid wallet address required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rpcUrl = Deno.env.get("BASE_RPC_URL");
    if (!rpcUrl) {
      return new Response(
        JSON.stringify({ error: "RPC not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const balances: Array<{
      token: string;
      balance: string;
      contract: string | null;
      decimals: number;
      isNative: boolean;
    }> = [];

    // Fetch ETH balance
    try {
      const ethBalance = await getEthBalance(rpcUrl, walletAddress);
      balances.push({
        token: "ETH",
        balance: ethBalance,
        contract: null,
        decimals: 18,
        isNative: true,
      });
    } catch (err) {
      console.error("Error fetching ETH balance:", err);
    }

    // Fetch ERC-20 balances in parallel
    const tokenEntries = Object.entries(TOKENS);
    const tokenResults = await Promise.allSettled(
      tokenEntries.map(([symbol, info]) =>
        getErc20Balance(rpcUrl, info.contract, walletAddress, info.decimals).then(
          (balance) => ({
            token: symbol,
            balance,
            contract: info.contract,
            decimals: info.decimals,
            isNative: false,
          })
        )
      )
    );

    for (const result of tokenResults) {
      if (result.status === "fulfilled") {
        balances.push(result.value);
      }
    }

    return new Response(
      JSON.stringify({ balances, address: walletAddress, network: "base" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error reading balances:", error);
    return new Response(
      JSON.stringify({ error: "Failed to read balances" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
