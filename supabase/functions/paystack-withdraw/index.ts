import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PAYSTACK_BASE_URL = "https://api.paystack.co";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) {
      return new Response(
        JSON.stringify({ error: "PAYSTACK_SECRET_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action } = body;

    if (action === "verify_bank") {
      return await verifyBank(body, PAYSTACK_SECRET_KEY);
    }

    if (action === "withdraw") {
      return await processWithdrawal(body, user.id, PAYSTACK_SECRET_KEY, supabase);
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in paystack-withdraw:", error);
    return new Response(
      JSON.stringify({ error: "Something went wrong. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function verifyBank(
  body: any, secretKey: string
): Promise<Response> {
  const { account_number, bank_code } = body;

  if (!account_number || !bank_code) {
    return new Response(
      JSON.stringify({ error: "Account number and bank code are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const res = await fetch(
    `${PAYSTACK_BASE_URL}/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`,
    {
      headers: { Authorization: `Bearer ${secretKey}` },
    }
  );

  const data = await res.json();

  if (!res.ok || !data.status) {
    return new Response(
      JSON.stringify({
        success: false,
        error: data.message || "Could not verify account",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      account_name: data.data.account_name,
      account_number: data.data.account_number,
      bank_id: data.data.bank_id,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function processWithdrawal(
  body: any, userId: string, secretKey: string, supabase: any
): Promise<Response> {
  const { withdrawal_id, amount, bank_code, bank_name, account_number, account_name } = body;

  if (!withdrawal_id || !amount || !bank_code || !account_number || !account_name) {
    return new Response(
      JSON.stringify({ error: "Missing required fields" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Verify the withdrawal belongs to this user
  const { data: withdrawal, error: wErr } = await supabase
    .from("withdrawals")
    .select("*")
    .eq("id", withdrawal_id)
    .eq("user_id", userId)
    .eq("status", "PROCESSING")
    .single();

  if (wErr || !withdrawal) {
    return new Response(
      JSON.stringify({ error: "Withdrawal not found or already processed" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Step 1: Create transfer recipient
    const recipientRes = await fetch(`${PAYSTACK_BASE_URL}/transferrecipient`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "nuban",
        name: account_name,
        account_number,
        bank_code,
        currency: "NGN",
      }),
    });

    const recipientData = await recipientRes.json();
    if (!recipientRes.ok || !recipientData.status) {
      throw new Error(recipientData.message || "Failed to create recipient");
    }

    const recipientCode = recipientData.data.recipient_code;

    // Step 2: Initiate transfer (amount in kobo)
    const reference = withdrawal.reference || `LXP-WD-${Date.now()}`;
    const transferRes = await fetch(`${PAYSTACK_BASE_URL}/transfer`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "balance",
        amount: Math.round(amount * 100), // Convert to kobo
        recipient: recipientCode,
        reason: `LexoPay withdrawal ${reference}`,
        reference,
      }),
    });

    const transferData = await transferRes.json();

    if (!transferRes.ok || !transferData.status) {
      // Update withdrawal as failed
      await supabase
        .from("withdrawals")
        .update({ status: "FAILED" })
        .eq("id", withdrawal_id);

      throw new Error(transferData.message || "Transfer failed");
    }

    const providerRef = transferData.data.transfer_code;

    // Note: In test mode, Paystack may auto-succeed or require manual finalization
    // The actual status will be tracked via webhooks in production

    return new Response(
      JSON.stringify({
        success: true,
        reference,
        provider_reference: providerRef,
        status: transferData.data.status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Paystack transfer error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Transfer failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
