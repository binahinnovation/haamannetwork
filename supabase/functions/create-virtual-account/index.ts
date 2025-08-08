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
    // Get Paystack secret key from environment variables
    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecretKey) {
      throw new Error("Paystack secret key not configured. Set PAYSTACK_SECRET_KEY in Edge Function secrets.");
    }

    const preferredBank = Deno.env.get("PAYSTACK_PREFERRED_BANK") || "titan-paystack"; // fallback; use 'test-bank' in test

    // Initialize Supabase client with service role key for admin access
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { userId, email, firstName, lastName, phoneNumber, bvn, country } = await req.json();

    // Validate required fields
    if (!userId || !email || !firstName || !lastName) {
      throw new Error("Missing required user information");
    }

    // Get site name (optional) for narration/context
    const { data: siteNameSetting } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'site_name')
      .single();

    const siteName = siteNameSetting?.value || 'Haaman Network';

    // Prepare request to Paystack Dedicated Virtual Account (single-step assign)
    const assignPayload: Record<string, any> = {
      email,
      first_name: firstName,
      last_name: lastName,
      phone: phoneNumber || "",
      preferred_bank: preferredBank,
      country: country || 'NG',
    };

    // Include BVN if provided (for categories that require validation)
    if (bvn) {
      assignPayload.bvn = bvn;
    }

    // Make request to Paystack API
    const response = await fetch("https://api.paystack.co/dedicated_account/assign", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(assignPayload),
    });

    const responseData = await response.json();

    if (!response.ok || responseData?.status === false) {
      const message = responseData?.message || responseData?.error || 'Unknown error';
      throw new Error(`Failed to create virtual account: ${message}`);
    }

    // Extract virtual account details
    // Expected structure: data.dedicated_account or data with { bank: { name }, account_number, account_name }
    const dataObj = responseData.data || {};
    const bankName: string = dataObj?.bank?.name || dataObj?.bank_name || 'Paystack Partner Bank';
    const accountNumber: string = dataObj?.account_number;

    if (!accountNumber) {
      throw new Error('Paystack response missing account number');
    }

    // Update user profile with virtual account details
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        virtual_account_bank_name: bankName,
        virtual_account_number: accountNumber,
        virtual_account_reference: null, // Paystack doesn't return tx_ref like Flutterwave
        bvn: bvn || null,
      })
      .eq("id", userId);

    if (updateError) {
      console.error("Error updating user profile:", updateError);
      throw new Error("Failed to update user profile with virtual account details");
    }

    // Log the virtual account creation
    await supabase.from("admin_logs").insert([{
      admin_id: null,
      action: "create_virtual_account",
      details: {
        provider: 'paystack',
        site_name: siteName,
        user_id: userId,
        email,
        bank_name: bankName,
        account_number: accountNumber?.slice(-4),
        preferred_bank: preferredBank,
        bvn_included: !!bvn,
      },
    }]);

    // Return success response with virtual account details
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          bank_name: bankName,
          account_number: accountNumber,
          reference: null,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error creating virtual account:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || "Failed to create virtual account",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});