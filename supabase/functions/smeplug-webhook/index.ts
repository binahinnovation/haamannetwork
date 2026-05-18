import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify Bearer token (SME Plug sends this in Authorization header)
    const authHeader = req.headers.get("Authorization");
    const smeplugWebhookToken = Deno.env.get("SMEPLUG_WEBHOOK_TOKEN");
    
    if (!authHeader || !smeplugWebhookToken) {
      console.error("Missing authorization header or webhook token not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the token matches
    const token = authHeader.replace("Bearer ", "");
    if (token !== smeplugWebhookToken) {
      console.error("Invalid webhook token");
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse webhook payload
    const payload = await req.json();
    console.log("SME Plug webhook payload:", JSON.stringify(payload, null, 2));

    /*
    Expected payload structure:
    {
      "transaction": {
        "status": "success" | "failed",
        "reference": "46634e8384c7c68f5baa",
        "customer_reference": "38dhdhdsk",
        "type": "Data purchase" | "Airtime purchase",
        "beneficiary": "090XXXXXXXX",
        "memo": "500MB (SME) - Monthly data purchase for 090XXXXXXXX",
        "response": "500MB (SME) - Monthly data purchase for 090XXXXXXXX",
        "price": "200"
      }
    }
    */

    const transaction = payload.transaction;
    
    if (!transaction) {
      console.error("Missing transaction object in webhook payload");
      return new Response(
        JSON.stringify({ success: false, error: "Invalid payload structure" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      status,
      reference,
      customer_reference,
      type,
      beneficiary,
      memo,
      response: apiResponse,
      price
    } = transaction;

    // Validate required fields
    if (!customer_reference) {
      console.error("Missing customer_reference in webhook payload");
      return new Response(
        JSON.stringify({ success: false, error: "Missing customer_reference" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing webhook for customer_reference: ${customer_reference}, status: ${status}`);

    // Find the transaction in our database using customer_reference
    const { data: dbTransaction, error: fetchError } = await supabase
      .from("transactions")
      .select("*")
      .eq("reference", customer_reference)
      .single();

    if (fetchError || !dbTransaction) {
      console.error("Transaction not found:", fetchError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Transaction not found",
          customer_reference 
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found transaction: ${dbTransaction.id}, current status: ${dbTransaction.status}`);

    // If transaction is already processed (success or failed), skip
    if (dbTransaction.status !== "pending") {
      console.log(`Transaction already processed with status: ${dbTransaction.status}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Transaction already processed",
          status: dbTransaction.status 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process based on webhook status
    if (status === "success") {
      // Update transaction to success
      const { error: updateError } = await supabase
        .from("transactions")
        .update({
          status: "success",
          details: {
            ...dbTransaction.details,
            webhook_received: true,
            webhook_timestamp: new Date().toISOString(),
            smeplug_reference: reference,
            smeplug_response: apiResponse,
            smeplug_memo: memo,
            beneficiary,
            type,
          },
        })
        .eq("id", dbTransaction.id);

      if (updateError) {
        console.error("Error updating transaction to success:", updateError);
        throw updateError;
      }

      console.log(`✅ Transaction ${dbTransaction.id} marked as SUCCESS`);

      // Log to admin logs
      await supabase.from("admin_logs").insert([{
        admin_id: null,
        action: "smeplug_webhook_success",
        details: {
          transaction_id: dbTransaction.id,
          customer_reference,
          smeplug_reference: reference,
          amount: dbTransaction.amount,
          type: dbTransaction.type,
        },
      }]);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Transaction confirmed as successful",
          transaction_id: dbTransaction.id 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (status === "failed") {
      // Transaction failed - need to refund user
      console.log(`❌ Transaction ${dbTransaction.id} FAILED - initiating refund`);

      const userId = dbTransaction.user_id;
      const refundAmount = dbTransaction.amount;

      console.log(`❌ Transaction ${dbTransaction.id} FAILED - initiating refund of ${refundAmount} to user ${userId}`);

      // Securely refund the user using the database function (ensures atomic update and audit logging)
      const { error: refundError } = await supabase.rpc('process_secure_refund', {
        p_user_id: userId,
        p_amount: refundAmount,
        p_original_transaction_id: dbTransaction.id,
        p_refund_reason: 'SME Plug async transaction failed',
        p_refund_details: { smeplug_reference: reference, response: apiResponse }
      });

      if (refundError) {
        console.error("Error securely refunding user wallet:", refundError);
        throw refundError;
      }

      // Update transaction to failed
      const { error: updateError } = await supabase
        .from("transactions")
        .update({
          status: "failed",
          details: {
            ...dbTransaction.details,
            webhook_received: true,
            webhook_timestamp: new Date().toISOString(),
            smeplug_reference: reference,
            smeplug_response: apiResponse,
            smeplug_memo: memo,
            beneficiary,
            type,
            refunded: true,
            refund_amount: refundAmount,
            refund_timestamp: new Date().toISOString(),
          },
        })
        .eq("id", dbTransaction.id);

      if (updateError) {
        console.error("Error updating transaction to failed:", updateError);
        throw updateError;
      }

      console.log(`✅ User ${userId} successfully refunded ${refundAmount}`);

      // Create a refund transaction record
      await supabase.from("transactions").insert([{
        user_id: userId,
        type: "refund",
        amount: refundAmount,
        status: "success",
        reference: `REFUND-${customer_reference}`,
        details: {
          reason: "SME Plug transaction failed",
          original_transaction_id: dbTransaction.id,
          original_reference: customer_reference,
          smeplug_reference: reference,
          refund_timestamp: new Date().toISOString(),
        },
      }]);

      // Log to admin logs
      await supabase.from("admin_logs").insert([{
        admin_id: null,
        action: "smeplug_webhook_failed_refund",
        details: {
          transaction_id: dbTransaction.id,
          customer_reference,
          smeplug_reference: reference,
          user_id: userId,
          refund_amount: refundAmount,
        },
      }]);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Transaction failed, user refunded",
          transaction_id: dbTransaction.id,
          refund_amount: refundAmount 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else {
      // Unknown status
      console.error(`Unknown transaction status: ${status}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Unknown transaction status",
          status 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error: any) {
    console.error("SME Plug webhook processing error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to process webhook",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
