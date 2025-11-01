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
    const { userId } = await req.json();

    if (!userId) {
      throw new Error("Missing userId");
    }

    console.log(`Debugging wallet issue for user ${userId}`);

    // Get user profile
    const { data: userProfile, error: userError } = await supabase
      .from("profiles")
      .select("id, wallet_balance, email, name")
      .eq("id", userId)
      .single();

    if (userError || !userProfile) {
      throw new Error("User profile not found");
    }

    // Get recent wallet funding transactions
    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .eq("type", "wallet_funding")
      .order("created_at", { ascending: false })
      .limit(5);

    if (txError) {
      throw new Error("Failed to fetch transactions");
    }

    // Calculate expected balance based on successful transactions
    let expectedBalance = 0;
    const successfulFundings = transactions?.filter(tx => tx.status === 'success') || [];
    
    for (const tx of successfulFundings) {
      expectedBalance += parseFloat(tx.amount);
    }

    // Get all successful transactions to calculate total expected balance
    const { data: allTransactions, error: allTxError } = await supabase
      .from("transactions")
      .select("type, amount, status")
      .eq("user_id", userId)
      .eq("status", "success");

    if (allTxError) {
      throw new Error("Failed to fetch all transactions");
    }

    let calculatedBalance = 0;
    for (const tx of allTransactions || []) {
      if (tx.type === 'wallet_funding') {
        calculatedBalance += parseFloat(tx.amount);
      } else {
        // Deduct for other transaction types (airtime, data, etc.)
        calculatedBalance -= parseFloat(tx.amount);
      }
    }

    const diagnostics = {
      user: {
        id: userProfile.id,
        name: userProfile.name,
        email: userProfile.email,
        current_balance: userProfile.wallet_balance,
      },
      recent_funding_transactions: transactions?.map(tx => ({
        id: tx.id,
        amount: tx.amount,
        status: tx.status,
        created_at: tx.created_at,
        reference: tx.reference,
        details: tx.details,
      })),
      balance_analysis: {
        current_balance: parseFloat(userProfile.wallet_balance),
        expected_balance_from_fundings: expectedBalance,
        calculated_balance_all_transactions: calculatedBalance,
        discrepancy: parseFloat(userProfile.wallet_balance) - calculatedBalance,
      },
      recommendations: []
    };

    // Add recommendations based on findings
    if (Math.abs(diagnostics.balance_analysis.discrepancy) > 0.01) {
      diagnostics.recommendations.push("Balance discrepancy detected - manual balance correction may be needed");
    }

    if (successfulFundings.length > 0 && parseFloat(userProfile.wallet_balance) === 0) {
      diagnostics.recommendations.push("User has successful funding transactions but zero balance - webhook may not be updating balance");
    }

    if (transactions?.some(tx => tx.status === 'success' && !tx.details?.api_response)) {
      diagnostics.recommendations.push("Some transactions missing API response details - may indicate webhook processing issues");
    }

    // Return diagnostic information
    return new Response(
      JSON.stringify({
        success: true,
        diagnostics,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Debug wallet issue error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || "Failed to debug wallet issue",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});