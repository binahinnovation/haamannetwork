/**
 * Supabase Edge Function: Process Subscriptions
 * 
 * This function processes subscription billing for all vendor shops that are due.
 * It should be called daily via a cron job or scheduled task.
 * 
 * Requirements: 3.1, 8.4
 * - Run daily to check subscription due dates
 * - Process billing for due shops
 * - Respect admin_override flag
 */

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
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration not found");
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Optional: Verify authorization for manual triggers
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      // If authorization is provided, verify it's a valid admin
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        console.log("Invalid or missing auth token, proceeding with service role");
      } else {
        // Check if user is admin
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", user.id)
          .single();
          
        if (!profile?.is_admin) {
          return new Response(
            JSON.stringify({ success: false, error: "Unauthorized - Admin access required" }),
            {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }
    }

    console.log("Starting subscription billing process...");

    // Call the database function to process all due subscriptions
    const { data: result, error: processError } = await supabase
      .rpc('process_all_due_subscriptions');

    if (processError) {
      console.error("Error processing subscriptions:", processError);
      throw new Error(`Failed to process subscriptions: ${processError.message}`);
    }

    console.log("Subscription processing result:", JSON.stringify(result));

    // Log the billing run
    await supabase.from("admin_logs").insert([{
      admin_id: null,
      action: "subscription_billing_run",
      details: {
        processed: result?.processed || 0,
        success: result?.success || 0,
        failed: result?.failed || 0,
        timestamp: new Date().toISOString(),
      },
    }]);

    // Return success response with summary
    return new Response(
      JSON.stringify({
        success: true,
        message: "Subscription billing completed",
        summary: {
          processed: result?.processed || 0,
          successful: result?.success || 0,
          failed: result?.failed || 0,
        },
        results: result?.results || [],
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Subscription processing error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to process subscriptions",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
