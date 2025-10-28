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
    // Get Flutterwave secret key from environment variables
    const flutterwaveSecretKey = Deno.env.get("FLUTTERWAVE_SECRET_KEY");
    if (!flutterwaveSecretKey) {
      throw new Error("Flutterwave secret key not configured. Set FLUTTERWAVE_SECRET_KEY in Edge Function secrets.");
    }

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

    const siteName = siteNameSetting?.value || 'ArabNetwork';

    // Generate a tx_ref to map webhook events to this user
    const txRef = `haaman-${userId}-${Date.now()}`;

    // Prepare request payload for Flutterwave virtual account creation
    const flwPayload: Record<string, any> = {
      email,
      tx_ref: txRef,
      phonenumber: phoneNumber || "",
      firstname: firstName,
      lastname: lastName,
      narration: `${siteName} Wallet Funding - ${firstName} ${lastName}`,
      is_permanent: true,
    };

    // Include BVN if provided (for categories that require validation)
    if (bvn) {
      flwPayload.bvn = bvn;
    }

    // Call Flutterwave API
    const flwResponse = await fetch("https://api.flutterwave.com/v3/virtual-account-numbers", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${flutterwaveSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(flwPayload),
    });

    const flwText = await flwResponse.text();
    let flwJson: any;
    try {
      flwJson = JSON.parse(flwText || "{}");
    } catch {
      flwJson = { raw: flwText };
    }

    if (!flwResponse.ok || (flwJson?.status && flwJson.status !== "success")) {
      const message = flwJson?.message || flwJson?.error || flwText || "Unknown error";
      throw new Error(`Failed to create Flutterwave virtual account: ${message}`);
    }

    // Extract virtual account details
    const dataObj = flwJson?.data || {};
    const bankName: string = dataObj?.bank_name || dataObj?.bank?.name || 'Flutterwave Partner Bank';
    const accountNumber: string = dataObj?.account_number;

    if (!accountNumber) {
      throw new Error('Flutterwave response missing account number');
    }

    // Update user profile with virtual account details
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        virtual_account_bank_name: bankName,
        virtual_account_number: accountNumber,
        virtual_account_reference: txRef,
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
        provider: 'flutterwave',
        site_name: siteName,
        user_id: userId,
        email,
        bank_name: bankName,
        account_number: accountNumber?.slice(-4),
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
          reference: txRef,
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