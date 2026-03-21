import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// USD → NGN rate (will be fetched from a forex API in production)
const USD_TO_NGN = 1580;
const SPREAD_PERCENTAGE = 1.5;

interface PriceResponse {
  token: string;
  usdPrice: number;
  ngnRate: number;
  timestamp: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const tokens = url.searchParams.get("tokens") || "ETH,USDC,USDT";
    const tokenList = tokens.split(",").map((t) => t.trim().toUpperCase());

    const prices: PriceResponse[] = [];

    for (const token of tokenList) {
      try {
        // Coinbase public price API — no auth needed
        const pair = `${token}-USD`;
        const res = await fetch(
          `https://api.coinbase.com/v2/prices/${pair}/spot`
        );

        if (!res.ok) {
          console.error(`Coinbase API error for ${pair}: ${res.status}`);
          // Fallback prices for stablecoins
          if (token === "USDC" || token === "USDT") {
            prices.push({
              token,
              usdPrice: 1.0,
              ngnRate: USD_TO_NGN * (1 - SPREAD_PERCENTAGE / 100),
              timestamp: new Date().toISOString(),
            });
          }
          continue;
        }

        const data = await res.json();
        const usdPrice = parseFloat(data.data.amount);

        // Apply spread: user gets slightly less NGN per crypto
        const ngnRate = usdPrice * USD_TO_NGN * (1 - SPREAD_PERCENTAGE / 100);

        prices.push({
          token,
          usdPrice,
          ngnRate: Math.round(ngnRate * 100) / 100,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error(`Error fetching price for ${token}:`, err);
      }
    }

    return new Response(
      JSON.stringify({
        prices,
        usdToNgn: USD_TO_NGN,
        spread: SPREAD_PERCENTAGE,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in get-crypto-prices:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch prices" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
