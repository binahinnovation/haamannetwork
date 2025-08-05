import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

interface NetworksResponse {
  status: boolean;
  networks: {
    [key: string]: string;
  };
}

interface DataPlansResponse {
  status: boolean;
  data: {
    [key: string]: any[];
  };
}

interface VTURequest {
  network_id: number;
  phone_number: string;
  amount: number;
  type: number;
}

interface DataRequest {
  network_id: number;
  phone_number: string;
  plan_id: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, ...params } = await req.json()
    
    // Get SME Plug API token from environment
    const token = Deno.env.get('SMEPLUG_TOKEN')
    if (!token) {
      throw new Error('SME Plug API token not configured')
    }

    const baseUrl = 'https://smeplug.ng/api/v1'
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    }

    let response: Response
    let result: any

    switch (action) {
      case 'get_networks':
        response = await fetch(`${baseUrl}/networks`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
        result = await response.json()
        break

      case 'get_data_plans':
        response = await fetch(`${baseUrl}/data/plans`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
        result = await response.json()
        break

      case 'buy_airtime':
        const vtuData: VTURequest = {
          network_id: params.network_id,
          phone_number: params.phone_number,
          amount: params.amount,
          type: 1 // VTU type
        }
        
        response = await fetch(`${baseUrl}/vtu`, {
          method: 'POST',
          headers,
          body: JSON.stringify(vtuData),
        })
        
        // SME Plug returns empty response for success
        if (response.ok) {
          result = { status: true, message: 'Transaction successful' }
        } else {
          const errorText = await response.text()
          result = { status: false, message: errorText || 'Transaction failed' }
        }
        break

      case 'buy_data':
        // Note: This endpoint might need adjustment based on actual SME Plug data purchase API
        const dataRequest: DataRequest = {
          network_id: params.network_id,
          phone_number: params.phone_number,
          plan_id: params.plan_id,
        }
        
        response = await fetch(`${baseUrl}/data`, {
          method: 'POST',
          headers,
          body: JSON.stringify(dataRequest),
        })
        
        if (response.ok) {
          result = { status: true, message: 'Data purchase successful' }
        } else {
          const errorText = await response.text()
          result = { status: false, message: errorText || 'Data purchase failed' }
        }
        break

      case 'requery_transaction':
        const reference = params.reference
        response = await fetch(`${baseUrl}/transactions/${reference}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
        result = await response.json()
        break

      default:
        throw new Error(`Unknown action: ${action}`)
    }

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('SME Plug Proxy Error:', error)
    
    return new Response(
      JSON.stringify({
        status: false,
        error: error.message || 'Internal server error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})