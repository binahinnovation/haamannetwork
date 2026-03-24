import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();
    if (!userId) throw new Error("User ID is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const paymentPointApiKey = Deno.env.get("PAYMENTPOINT_API_KEY");
    const paymentPointSecret = Deno.env.get("PAYMENTPOINT_SECRET_KEY");
    const paymentPointBusinessId = Deno.env.get("PAYMENTPOINT_BUSINESS_ID") || paymentPointApiKey;

    if (!paymentPointApiKey || !paymentPointSecret || !paymentPointBusinessId) {
      throw new Error("PaymentPoint configuration missing (API Key, Secret Key, or Business ID)");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch user profile
    const { data: user, error: userError } = await supabase
      .from("profiles")
      .select("email, name, phone")
      .eq("id", userId)
      .single();

    if (userError || !user) throw new Error("User not found");

    // Prepare PaymentPoint API request
    const payload = {
      email: user.email,
      name: user.name,
      phoneNumber: user.phone || "",
      bankCode: ["20946", "20897"], // OPay and PalmPay
      businessId: paymentPointBusinessId,
    };

    console.log("Sending request to PaymentPoint with businessId:", paymentPointBusinessId);

    const response = await fetch("https://api.paymentpoint.co/api/v1/createVirtualAccount", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${paymentPointSecret}`,
        "api-key": paymentPointApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok || !result.status) {
      console.error("PaymentPoint API Error Response:", result);
      throw new Error(result.message || result.error || "Failed to create PaymentPoint accounts");
    }

    // Extract account details from PaymentPoint response
    const accounts = result.bankAccounts || [];
    const opay = accounts.find((a: any) => a.bankName.toLowerCase().includes("opay"));
    const palmpay = accounts.find((a: any) => a.bankName.toLowerCase().includes("palmpay"));

    const updateData: any = {
      paymentpoint_customer_id: result.customerId || null,
    };

    if (opay) {
      updateData.opay_account_number = opay.accountNumber;
      updateData.opay_account_name = opay.accountName;
    }

    if (palmpay) {
      updateData.palmpay_account_number = palmpay.accountNumber;
      updateData.palmpay_account_name = palmpay.accountName;
    }

    // Update user profile
    const { error: updateError } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", userId);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ 
      success: true, 
      data: {
        customerId: result.customerId,
        opay: opay ? { accountNumber: opay.accountNumber, accountName: opay.accountName } : null,
        palmpay: palmpay ? { accountNumber: palmpay.accountNumber, accountName: palmpay.accountName } : null,
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("PaymentPoint Execution Error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
