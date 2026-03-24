import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, Paymentpoint-Signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get("Paymentpoint-Signature");
    const secretKey = Deno.env.get("PAYMENTPOINT_WEBHOOK_SECRET");

    if (!secretKey) {
      throw new Error("PAYMENTPOINT_WEBHOOK_SECRET not configured");
    }

    // Step 1: Read raw body for signature verification
    const rawBody = await req.text();
    
    // Step 2: Verify signature
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    const messageData = encoder.encode(rawBody);

    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );

    const signatureBytes = await crypto.subtle.sign("HMAC", key, messageData);
    const calculatedSignature = Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (calculatedSignature !== signature) {
      console.error("Invalid signature. Received:", signature, "Calculated:", calculatedSignature);
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 3: Parse payload
    const payload = JSON.parse(rawBody);
    console.log("Webhook payload received:", payload);

    if (payload.notification_status !== "payment_successful" || payload.transaction_status !== "success") {
      return new Response(JSON.stringify({ status: "skipped", message: "Not a successful payment" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const receiverAccount = payload.receiver?.account_number;
    const amount = payload.amount_paid || payload.settlement_amount;
    const transactionId = payload.transaction_id;

    if (!receiverAccount || !amount) {
      throw new Error("Missing required transaction data");
    }

    // Step 4: Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 5: Find user by account number
    const { data: user, error: userError } = await supabase
      .from("profiles")
      .select("id, name")
      .or(`opay_account_number.eq.${receiverAccount},palmpay_account_number.eq.${receiverAccount}`)
      .single();

    if (userError || !user) {
      console.error("User not found for account:", receiverAccount);
      throw new Error("User not found for account number");
    }

    // Step 6: Process deposit using secure RPC
    const { data: depositResult, error: depositError } = await supabase.rpc("process_secure_deposit", {
      p_user_id: user.id,
      p_amount: amount,
      p_deposit_details: {
        provider: "paymentpoint",
        bank: payload.receiver?.bank,
        sender_name: payload.sender?.name,
        sender_bank: payload.sender?.bank,
        description: payload.description,
        full_payload: payload
      },
      p_external_transaction_id: transactionId
    });

    if (depositError) {
      console.error("Deposit Error:", depositError);
      throw new Error("Failed to process deposit");
    }

    console.log(`Successfully credited user ${user.id} with ${amount}`);

    return new Response(JSON.stringify({ success: true, message: "Webhook processed" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Webhook Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
