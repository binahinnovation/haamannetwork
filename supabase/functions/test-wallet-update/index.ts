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
    const { userId, amount } = await req.json();

    if (!userId || !amount) {
      throw new Error("Missing userId or amount");
    }

    console.log(`Testing wallet update for user ${userId} with amount ${amount}`);

    // Get current user profile
    const { data: userProfile, error: userError } = await supabase
      .from("profiles")
      .select("id, wallet_balance, email")
      .eq("id", userId)
      .single();

    if (userError || !userProfile) {
      throw new Error("User profile not found");
    }

    console.log(`Current balance: ${userProfile.wallet_balance}`);

    // Update user's wallet balance
    const newBalance = parseFloat(userProfile.wallet_balance) + parseFloat(amount);
    
    console.log(`New balance will be: ${newBalance}`);
    
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ wallet_balance: newBalance })
      .eq("id", userProfile.id);

    if (updateError) {
      console.error("Error updating wallet balance:", updateError);
      throw new Error("Failed to update wallet balance");
    }

    console.log("Wallet balance updated successfully");

    // Create a test transaction record
    const transactionData = {
      user_id: userProfile.id,
      type: "wallet_funding",
      amount: parseFloat(amount),
      status: "success",
      reference: `TEST-${Date.now()}`,
      details: {
        payment_method: "test",
        test_transaction: true,
        timestamp: new Date().toISOString()
      },
    };

    const { error: transactionError } = await supabase
      .from("transactions")
      .insert([transactionData]);

    if (transactionError) {
      console.error("Error creating transaction record:", transactionError);
      throw new Error("Failed to create transaction record");
    }

    console.log("Test transaction created successfully");

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: "Test wallet update completed successfully",
        data: {
          userId: userProfile.id,
          previousBalance: userProfile.wallet_balance,
          newBalance: newBalance,
          amountAdded: amount
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Test wallet update error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || "Failed to test wallet update",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});