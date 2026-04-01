import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const USD_TO_NGN = 1580;
const SPREAD_PERCENTAGE = 1.5;

async function fetchCoinbasePrice(token: string): Promise<number> {
  const pair = `${token}-USD`;
  const res = await fetch(`https://api.coinbase.com/v2/prices/${pair}/spot`);
  if (!res.ok) {
    if (token === "USDC" || token === "USDT") return 1.0;
    throw new Error(`Failed to fetch price for ${token}`);
  }
  const data = await res.json();
  return parseFloat(data.data.amount);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find all PROCESSING conversions
    const { data: pendingConversions, error: fetchError } = await supabase
      .from("conversions")
      .select("*")
      .eq("status", "PROCESSING")
      .limit(10);

    if (fetchError) throw fetchError;

    if (!pendingConversions || pendingConversions.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: "No pending conversions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processed = 0;
    let failed = 0;

    for (const conversion of pendingConversions) {
      try {
        // Fetch current price
        const usdPrice = await fetchCoinbasePrice(conversion.from_token);
        const ngnRate = usdPrice * USD_TO_NGN * (1 - SPREAD_PERCENTAGE / 100);
        const grossNgn = conversion.from_amount * ngnRate;
        const fee = grossNgn * 0.015; // 1.5% fee
        const finalNgn = Math.round((grossNgn - fee) * 100) / 100;

        // Get user's NGN wallet
        const { data: ngnWallet } = await supabase
          .from("wallets")
          .select("id")
          .eq("user_id", conversion.user_id)
          .eq("type", "NGN")
          .single();

        if (!ngnWallet) {
          throw new Error("NGN wallet not found");
        }

        // Credit NGN balance
        const { data: currentBalance } = await supabase
          .from("ngn_balances")
          .select("balance")
          .eq("wallet_id", ngnWallet.id)
          .single();

        const newBalance = (currentBalance?.balance || 0) + finalNgn;

        await supabase
          .from("ngn_balances")
          .update({ balance: newBalance, updated_at: new Date().toISOString() })
          .eq("wallet_id", ngnWallet.id);

        // Update conversion record
        await supabase
          .from("conversions")
          .update({
            status: "SUCCESS",
            ngn_amount: finalNgn,
            fee,
            rate: ngnRate,
            updated_at: new Date().toISOString(),
          })
          .eq("id", conversion.id);

        // Create transaction record
        await supabase.from("transactions").insert({
          user_id: conversion.user_id,
          kind: "CONVERT",
          title: "Conversion Completed",
          subtitle: `${conversion.from_token} → NGN`,
          amount_display: `-${conversion.from_amount} ${conversion.from_token} → +₦${finalNgn.toLocaleString()} (fee: ₦${fee.toFixed(2)})`,
          status: "SUCCESS",
          metadata: {
            conversion_id: conversion.id,
            from_amount: conversion.from_amount,
            from_token: conversion.from_token,
            from_network: conversion.from_network,
            rate: ngnRate,
            fee,
            ngn_amount: finalNgn,
          },
        });

        // Create notification
        await supabase.from("notifications").insert({
          user_id: conversion.user_id,
          type: "conversion_completed",
          title: "Conversion Completed",
          message: `Your conversion of ${conversion.from_amount} ${conversion.from_token} to ₦${finalNgn.toLocaleString()} has been completed.`,
        });

        processed++;
      } catch (convErr: any) {
        console.error(`Failed to process conversion ${conversion.id}:`, convErr);

        // Mark as failed and refund crypto
        await supabase
          .from("conversions")
          .update({
            status: "FAILED",
            updated_at: new Date().toISOString(),
          })
          .eq("id", conversion.id);

        // Refund: get crypto wallet and add back
        const { data: cryptoWallet } = await supabase
          .from("wallets")
          .select("id")
          .eq("user_id", conversion.user_id)
          .eq("type", "CRYPTO")
          .single();

        if (cryptoWallet) {
          const { data: cryptoBalance } = await supabase
            .from("crypto_balances")
            .select("balance")
            .eq("wallet_id", cryptoWallet.id)
            .eq("token", conversion.from_token)
            .eq("network", conversion.from_network)
            .single();

          if (cryptoBalance) {
            await supabase
              .from("crypto_balances")
              .update({
                balance: cryptoBalance.balance + conversion.from_amount,
                updated_at: new Date().toISOString(),
              })
              .eq("wallet_id", cryptoWallet.id)
              .eq("token", conversion.from_token)
              .eq("network", conversion.from_network);
          }
        }

        // Notify user of failure
        await supabase.from("notifications").insert({
          user_id: conversion.user_id,
          type: "conversion_failed",
          title: "Conversion Failed",
          message: `Your conversion of ${conversion.from_amount} ${conversion.from_token} could not be completed. Your crypto has been refunded.`,
        });

        failed++;
      }
    }

    return new Response(
      JSON.stringify({ processed, failed, total: pendingConversions.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Process conversions error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
