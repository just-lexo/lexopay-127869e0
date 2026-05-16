// Live price oracle backed by CoinMarketCap.
// Honors admin rate overrides stored in app_settings.rate_overrides.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_SPREAD_PCT = 1.0;
const CACHE_TTL_MS = 60_000;
const SUPPORTED = ["ETH", "USDC", "USDT"] as const;

type Cached = { at: number; payload: unknown };
let cache: Cached | null = null;

async function fetchOverrides(): Promise<Record<string, { spread_pct?: number; manual_price_usd?: number; enabled?: boolean }>> {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data } = await supabase.from("app_settings").select("value").eq("key", "rate_overrides").maybeSingle();
    return (data?.value as any) || {};
  } catch {
    return {};
  }
}

async function fetchCMC() {
  const apiKey = Deno.env.get("CMC_API_KEY");
  if (!apiKey) throw new Error("CMC_API_KEY not configured");

  const headers = { "X-CMC_PRO_API_KEY": apiKey, Accept: "application/json" };

  const cryptoUrl = `https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=${SUPPORTED.join(",")}&convert=USD`;
  const cryptoRes = await fetch(cryptoUrl, { headers });
  if (!cryptoRes.ok) throw new Error(`CMC crypto ${cryptoRes.status}`);
  const cryptoJson = await cryptoRes.json();

  const fxUrl = `https://pro-api.coinmarketcap.com/v2/tools/price-conversion?amount=1&symbol=USD&convert=NGN`;
  const fxRes = await fetch(fxUrl, { headers });
  if (!fxRes.ok) throw new Error(`CMC fx ${fxRes.status}`);
  const fxJson = await fxRes.json();
  const usdNgn: number =
    fxJson?.data?.[0]?.quote?.NGN?.price ??
    fxJson?.data?.quote?.NGN?.price ??
    null;
  if (!usdNgn || !isFinite(usdNgn)) throw new Error("Invalid USD/NGN rate");

  const overrides = await fetchOverrides();

  const prices: Record<string, { usd: number; market_ngn: number; display_ngn: number; spread_pct: number; overridden: boolean }> = {};
  for (const sym of SUPPORTED) {
    const arr = cryptoJson?.data?.[sym];
    const entry = Array.isArray(arr) ? arr[0] : arr;
    let usd: number = entry?.quote?.USD?.price ?? (sym === "USDC" || sym === "USDT" ? 1 : 0);
    if (!usd) continue;

    const ov = overrides?.[sym];
    let spreadPct = DEFAULT_SPREAD_PCT;
    let overridden = false;
    if (ov?.enabled) {
      overridden = true;
      if (typeof ov.manual_price_usd === "number" && ov.manual_price_usd > 0) usd = ov.manual_price_usd;
      if (typeof ov.spread_pct === "number") spreadPct = ov.spread_pct;
    }

    const market = usd * usdNgn;
    const display = market * (1 - spreadPct / 100);
    prices[sym] = {
      usd: round(usd, 6),
      market_ngn: round(market, 4),
      display_ngn: round(display, 4),
      spread_pct: spreadPct,
      overridden,
    };
  }

  return {
    prices,
    usd_ngn: round(usdNgn, 4),
    spread_pct: DEFAULT_SPREAD_PCT,
    fetched_at: new Date().toISOString(),
    source: "coinmarketcap",
    overrides_applied: Object.keys(overrides || {}).length > 0,
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
    return new Response(
      JSON.stringify({ success: true, ...(cache.payload as object), cached: now - cache.at < CACHE_TTL_MS }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("get-live-prices error:", err);
    return new Response(
      JSON.stringify({ success: false, message: (err as Error).message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
