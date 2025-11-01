import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Initialize Supabase client with service role key for admin access
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { userId, action } = await req.json();

    if (!userId) {
      throw new Error("Missing userId");
    }

    console.log(`Fixing wallet balance for user ${userId}, action: ${action}`);

    // Get user profile
    const { data: userProfile, error: userError } = await supabase
      .from("profiles")
      .select("id, wallet_balance, email, name")
      .eq("id", userId)
      .single();

    if (userError || !userProfile) {
      throw new Error("User profile not found");
    }

    if (action === 'calculate_correct_balance') {
      // Calculate correct balance based on all successful transactions
      const { data: allTransactions, error: allTxError } = await supabase
        .from("transactions")
        .select("type, amount, status")
        .eq("user_id", userId)
        .eq("status", "success");

      if (allTxError) {
        throw new Error("Failed to fetch transactions");
      }

      let correctBalance = 0;
      for (const tx of allTransactions || []) {
        if (tx.type === 'wallet_funding') {
          correctBalance += parseFloat(tx.amount);
        } else {
          // Deduct for other transaction types (airtime, data, electricity, etc.)
          correctBalance -= parseFloat(tx.amount);
        }
      }

      // Update the user's balance to the correct amount
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ wallet_balance: correctBalance })
        .eq("id", userId);

      if (updateError) {
        throw new Error("Failed to update wallet balance");
      }

      // Log the correction
      await supabase.from("admin_logs").insert([{
        admin_id: null,
        action: "fix_wallet_balance",
        details: {
          user_id: userId,
          previous_balance: userProfile.wallet_balance,
          corrected_balance: correctBalance,
          correction_amount: correctBalance - parseFloat(userProfile.wallet_balance),
          reason: "Automatic balance correction based on transaction history"
        },
      }]);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Wallet balance corrected successfully",
          data: {
            user_id: userId,
            previous_balance: userProfile.wallet_balance,
            corrected_balance: correctBalance,
            correction_amount: correctBalance - parseFloat(userProfile.wallet_balance)
          }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      throw new Error("Invalid action. Use 'calculate_correct_balance'");
    }

  } catch (error: any) {
    console.error("Fix wallet balance error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || "Failed to fix wallet balance",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});