// Paystack transfer webhook — auto-finalize SUCCESS / FAILED withdrawals.
// Verifies HMAC-SHA512 signature against PAYSTACK_SECRET_KEY.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paystack-signature",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!secret) {
    return new Response(JSON.stringify({ error: "Not configured" }), { status: 500, headers: corsHeaders });
  }

  const raw = await req.text();
  const signature = req.headers.get("x-paystack-signature") || "";
  const expected = createHmac("sha512", secret).update(raw).digest("hex");
  if (signature !== expected) {
    console.warn("paystack-webhook: invalid signature");
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: corsHeaders });
  }

  let event: any;
  try { event = JSON.parse(raw); } catch {
    return new Response(JSON.stringify({ error: "Bad JSON" }), { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const reference = event?.data?.reference;
  const eventName = event?.event as string | undefined;
  if (!reference || !eventName?.startsWith("transfer.")) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), { headers: corsHeaders });
  }

  // Map Paystack transfer events
  const success = eventName === "transfer.success";
  const failed = eventName === "transfer.failed" || eventName === "transfer.reversed";
  if (!success && !failed) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), { headers: corsHeaders });
  }

  const { data: wd } = await supabase
    .from("withdrawals")
    .select("id, status")
    .eq("reference", reference)
    .maybeSingle();

  if (!wd) {
    console.warn("paystack-webhook: withdrawal not found for reference", reference);
    return new Response(JSON.stringify({ ok: true, missing: true }), { headers: corsHeaders });
  }

  if (wd.status !== "PROCESSING") {
    return new Response(JSON.stringify({ ok: true, already: wd.status }), { headers: corsHeaders });
  }

  const { data, error } = await supabase.rpc("admin_resolve_withdrawal", {
    _withdrawal_id: wd.id,
    _success: success,
    _note: success ? `Paystack confirmed (${event?.data?.transfer_code || ""})` : (event?.data?.gateway_response || event?.data?.reason || "Paystack failed"),
  });

  if (error) {
    console.error("paystack-webhook resolve error", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ ok: true, resolved: success ? "SUCCESS" : "FAILED", data }), { headers: corsHeaders });
});
