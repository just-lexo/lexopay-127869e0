// Live price oracle backed by CoinMarketCap.
// Returns market and display (1% spread) NGN rates for ETH/USDC/USDT.
// In-memory 60s cache per warm instance.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SPREAD_PCT = 1.0; // 1% applied against market mid
const CACHE_TTL_MS = 60_000;
const SUPPORTED = ["ETH", "USDC", "USDT"] as const;

type Cached = { at: number; payload: unknown };
let cache: Cached | null = null;

async function fetchCMC() {
  const apiKey = Deno.env.get("CMC_API_KEY");
  if (!apiKey) throw new Error("CMC_API_KEY not configured");

  const headers = { "X-CMC_PRO_API_KEY": apiKey, Accept: "application/json" };

  // 1) Crypto USD prices
  const cryptoUrl = `https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=${SUPPORTED.join(",")}&convert=USD`;
  const cryptoRes = await fetch(cryptoUrl, { headers });
  if (!cryptoRes.ok) throw new Error(`CMC crypto ${cryptoRes.status}`);
  const cryptoJson = await cryptoRes.json();

  // 2) USD -> NGN
  const fxUrl = `https://pro-api.coinmarketcap.com/v2/tools/price-conversion?amount=1&symbol=USD&convert=NGN`;
  const fxRes = await fetch(fxUrl, { headers });
  if (!fxRes.ok) throw new Error(`CMC fx ${fxRes.status}`);
  const fxJson = await fxRes.json();
  const usdNgn: number =
    fxJson?.data?.[0]?.quote?.NGN?.price ??
    fxJson?.data?.quote?.NGN?.price ??
    null;
  if (!usdNgn || !isFinite(usdNgn)) throw new Error("Invalid USD/NGN rate");

  const prices: Record<string, { usd: number; market_ngn: number; display_ngn: number }> = {};
  for (const sym of SUPPORTED) {
    const arr = cryptoJson?.data?.[sym];
    const entry = Array.isArray(arr) ? arr[0] : arr;
    const usd: number = entry?.quote?.USD?.price ?? (sym === "USDC" || sym === "USDT" ? 1 : 0);
    if (!usd) continue;
    const market = usd * usdNgn;
    const display = market * (1 - SPREAD_PCT / 100);
    prices[sym] = {
      usd: round(usd, 6),
      market_ngn: round(market, 4),
      display_ngn: round(display, 4),
    };
  }

  return {
    prices,
    usd_ngn: round(usdNgn, 4),
    spread_pct: SPREAD_PCT,
    fetched_at: new Date().toISOString(),
    source: "coinmarketcap",
  };
}

function round(n: number, dp: number) {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const now = Date.now();
    if (!cache || now - cache.at > CACHE_TTL_MS) {
      const payload = await fetchCMC();
      cache = { at: now, payload };
    }
    return new Response(JSON.stringify({ success: true, ...(cache.payload as object), cached: now - cache.at < CACHE_TTL_MS }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("get-live-prices error:", err);
    return new Response(
      JSON.stringify({ success: false, message: (err as Error).message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
