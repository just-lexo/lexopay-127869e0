// Creates a 60-second locked conversion quote using server-side prices.
// Client passes token + network + amount; we compute & store the quote and return its id.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SPREAD_PCT = 1.0;
const FEE_PCT = 1.5;
const QUOTE_TTL_SECONDS = 60;
const SUPPORTED = ["ETH", "USDC", "USDT"];

async function fetchPrices() {
  const apiKey = Deno.env.get("CMC_API_KEY");
  if (!apiKey) throw new Error("Price oracle not configured");
  const headers = { "X-CMC_PRO_API_KEY": apiKey, Accept: "application/json" };

  const [cryptoRes, fxRes] = await Promise.all([
    fetch(`https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=${SUPPORTED.join(",")}&convert=USD`, { headers }),
    fetch(`https://pro-api.coinmarketcap.com/v2/tools/price-conversion?amount=1&symbol=USD&convert=NGN`, { headers }),
  ]);
  if (!cryptoRes.ok) throw new Error(`Price oracle ${cryptoRes.status}`);
  if (!fxRes.ok) throw new Error(`FX oracle ${fxRes.status}`);
  const cj = await cryptoRes.json();
  const fj = await fxRes.json();
  const usdNgn: number = fj?.data?.[0]?.quote?.NGN?.price ?? fj?.data?.quote?.NGN?.price;
  if (!usdNgn) throw new Error("Invalid USD/NGN rate");

  const out: Record<string, number> = {};
  for (const sym of SUPPORTED) {
    const arr = cj?.data?.[sym];
    const entry = Array.isArray(arr) ? arr[0] : arr;
    const usd: number = entry?.quote?.USD?.price ?? ((sym === "USDC" || sym === "USDT") ? 1 : 0);
    if (usd) out[sym] = usd * usdNgn;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return ok({ success: false, message: "Not authenticated" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData.user) return ok({ success: false, message: "Invalid session" });
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const tokenSym = String(body.token || "").toUpperCase();
    const network = String(body.network || "base").toLowerCase();
    const amount = Number(body.amount);

    if (!SUPPORTED.includes(tokenSym)) return ok({ success: false, message: "Unsupported token" });
    if (!isFinite(amount) || amount <= 0) return ok({ success: false, message: "Invalid amount" });

    const prices = await fetchPrices();
    const marketRate = prices[tokenSym];
    if (!marketRate) return ok({ success: false, message: "Price unavailable" });

    const displayRate = marketRate * (1 - SPREAD_PCT / 100);
    const grossNgn = amount * displayRate;
    const fee = round(grossNgn * (FEE_PCT / 100), 2);
    const ngnAmount = round(grossNgn - fee, 2);
    if (ngnAmount <= 0) return ok({ success: false, message: "Amount too small" });

    const expiresAt = new Date(Date.now() + QUOTE_TTL_SECONDS * 1000).toISOString();

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: quote, error: insErr } = await admin
      .from("conversion_quotes")
      .insert({
        user_id: userId,
        token: tokenSym,
        network,
        from_amount: amount,
        market_rate: round(marketRate, 4),
        display_rate: round(displayRate, 4),
        spread_pct: SPREAD_PCT,
        fee,
        ngn_amount: ngnAmount,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (insErr) return ok({ success: false, message: insErr.message });

    return ok({
      success: true,
      quote: {
        id: quote.id,
        token: tokenSym,
        network,
        from_amount: amount,
        market_rate: quote.market_rate,
        display_rate: quote.display_rate,
        spread_pct: SPREAD_PCT,
        fee_pct: FEE_PCT,
        fee,
        ngn_amount: ngnAmount,
        expires_at: expiresAt,
        ttl_seconds: QUOTE_TTL_SECONDS,
      },
    });
  } catch (err) {
    console.error("create-conversion-quote error:", err);
    return ok({ success: false, message: (err as Error).message });
  }
});

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function round(n: number, dp: number) {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}
