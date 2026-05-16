// Dojah identity verification: BVN or NIN lookup.
// Auto-bumps profile to KYC tier 2 on a successful match.
// Requires DOJAH_APP_ID + DOJAH_API_KEY secrets.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DOJAH_BASE = "https://api.dojah.io"; // sandbox: https://sandbox.dojah.io

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const appId = Deno.env.get("DOJAH_APP_ID");
    const apiKey = Deno.env.get("DOJAH_API_KEY");
    if (!appId || !apiKey) {
      return json({ success: false, error: "KYC provider not configured. Please contact support." }, 200);
    }

    const auth = req.headers.get("Authorization");
    if (!auth) return json({ success: false, error: "Not authenticated" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (authErr || !user) return json({ success: false, error: "Invalid session" }, 401);

    const body = await req.json().catch(() => ({}));
    const { id_type, id_number, full_name, date_of_birth, phone_number } = body || {};

    if (!id_type || !id_number) {
      return json({ success: false, error: "ID type and number required" }, 400);
    }
    if (!["BVN", "NIN"].includes(String(id_type).toUpperCase())) {
      return json({ success: false, error: "Only BVN and NIN supported" }, 400);
    }

    // Hit the right Dojah endpoint
    const headers = { AppId: appId, Authorization: apiKey, Accept: "application/json" };
    const lookupUrl =
      String(id_type).toUpperCase() === "BVN"
        ? `${DOJAH_BASE}/api/v1/kyc/bvn/full?bvn=${encodeURIComponent(id_number)}`
        : `${DOJAH_BASE}/api/v1/kyc/nin?nin=${encodeURIComponent(id_number)}`;

    const dojahRes = await fetch(lookupUrl, { headers });
    const dojahData = await dojahRes.json().catch(() => ({}));

    if (!dojahRes.ok || !dojahData?.entity) {
      return json({
        success: false,
        error: dojahData?.error || "Identity verification failed. Please double-check your details.",
        provider_status: dojahRes.status,
      }, 200);
    }

    const entity = dojahData.entity;
    const providerName = entity.first_name?.toLowerCase?.() ?? "";
    const providerLast = entity.last_name?.toLowerCase?.() ?? "";
    const providerDob = entity.date_of_birth || entity.dateOfBirth;

    // Soft name match (allow re-ordering / extra middle names)
    const expectedTokens = String(full_name || "").toLowerCase().split(/\s+/).filter(Boolean);
    const nameMatched = !expectedTokens.length || expectedTokens.some(
      (t) => providerName.includes(t) || providerLast.includes(t),
    );

    let dobMatched = true;
    if (date_of_birth && providerDob) {
      const a = new Date(date_of_birth).toISOString().slice(0, 10);
      const b = new Date(providerDob).toISOString().slice(0, 10);
      dobMatched = a === b;
    }

    if (!nameMatched || !dobMatched) {
      return json({
        success: false,
        error: "Details do not match the records on file. Please review and try again.",
      }, 200);
    }

    // Persist submission + bump tier
    await supabase.from("kyc_submissions").upsert(
      {
        user_id: user.id,
        full_name: full_name?.trim() ?? `${entity.first_name ?? ""} ${entity.last_name ?? ""}`.trim(),
        phone_number: phone_number?.trim() ?? entity.phone_number1 ?? entity.phone ?? "",
        date_of_birth: providerDob ?? date_of_birth ?? null,
        id_type: String(id_type).toUpperCase(),
        id_number,
        bvn: String(id_type).toUpperCase() === "BVN" ? id_number : null,
        nin: String(id_type).toUpperCase() === "NIN" ? id_number : null,
        tier_target: 2,
        provider: "dojah",
        provider_response: entity,
        status: "approved",
        admin_note: "Auto-verified via Dojah",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" } as any,
    );

    await supabase.rpc("admin_apply_kyc_provider_result", {
      _user_id: user.id,
      _provider: "dojah",
      _tier: 2,
      _provider_response: entity,
    });

    await supabase.from("notifications").insert({
      user_id: user.id,
      type: "kyc_approved",
      title: "Identity verified",
      message: "You've been upgraded to KYC tier 2. Higher daily limits unlocked.",
      related_kind: "profile",
    });

    return json({ success: true, tier: 2 }, 200);
  } catch (e: any) {
    console.error("dojah-verify error:", e);
    return json({ success: false, error: e?.message || "Verification failed" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
