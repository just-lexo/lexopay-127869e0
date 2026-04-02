import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.13.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address, signature, message, linkToSession } = await req.json();

    if (!address || !signature || !message) {
      return new Response(
        JSON.stringify({ error: "Missing address, signature, or message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify signature
    let recoveredAddress: string;
    try {
      recoveredAddress = ethers.verifyMessage(message, signature);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: "Signature does not match address" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const normalizedAddress = address.toLowerCase();

    // Check if a profile with this wallet_address already exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("wallet_address", normalizedAddress)
      .maybeSingle();

    // CASE B: User is already logged in, link wallet to their account
    if (linkToSession) {
      // linkToSession contains the user_id of the currently logged-in user
      if (existingProfile) {
        if (existingProfile.user_id === linkToSession) {
          return new Response(
            JSON.stringify({ success: true, linked: true, message: "Wallet already linked to your account" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ error: "This wallet is already linked to another account" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Link wallet to existing user
      await supabase
        .from("profiles")
        .update({
          wallet_address: normalizedAddress,
          wallet_connected_at: new Date().toISOString(),
        })
        .eq("user_id", linkToSession);

      return new Response(
        JSON.stringify({ success: true, linked: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CASE A: Wallet exists → log into that user
    let userId: string;
    let isNewUser = false;

    if (existingProfile) {
      userId = existingProfile.user_id;
    } else {
      // CASE C: New wallet, no session → create new user
      const walletEmail = `${normalizedAddress}@wallet.lexopay.app`;
      const walletPassword = crypto.randomUUID() + crypto.randomUUID();

      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: walletEmail,
        password: walletPassword,
        email_confirm: true,
        user_metadata: { wallet_address: normalizedAddress },
      });

      if (createError) {
        if (createError.message?.includes("already been registered")) {
          const { data: { users } } = await supabase.auth.admin.listUsers();
          const found = users?.find((u: any) => u.email === walletEmail);
          if (found) {
            userId = found.id;
          } else {
            throw createError;
          }
        } else {
          throw createError;
        }
      } else {
        userId = newUser.user!.id;
        isNewUser = true;
      }

      // Update profile with wallet address
      await supabase
        .from("profiles")
        .update({
          wallet_address: normalizedAddress,
          wallet_connected_at: new Date().toISOString(),
          username: isNewUser ? `wallet_${normalizedAddress.slice(2, 8)}` : undefined,
          display_name: isNewUser ? `${address.slice(0, 6)}...${address.slice(-4)}` : undefined,
          onboarding_completed: isNewUser ? false : undefined,
        })
        .eq("user_id", userId!);
    }

    // Generate a magic link token for the user
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: `${normalizedAddress}@wallet.lexopay.app`,
    });

    if (linkError) throw linkError;

    // Use OTP verification to get a session
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anonClient = createClient(supabaseUrl, anonKey);
    
    const { data: sessionData, error: sessionError } = await anonClient.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: "magiclink",
    });

    if (sessionError) throw sessionError;

    return new Response(
      JSON.stringify({
        success: true,
        session: sessionData.session,
        user: sessionData.user,
        isNewUser,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Wallet auth error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Authentication failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
