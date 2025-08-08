import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

// Network mappings for SME Plug API
const NETWORK_MAPPINGS = {
  'mtn': 1,
  'airtel': 2,
  'glo': 3,
  '9mobile': 4
} as const;

interface AirtimePurchaseRequest {
  network_id: number;
  phone: string;
  amount: number;
  customer_reference?: string;
}

interface AirtimePurchaseResponse {
  status: boolean;
  data?: {
    reference: string;
    msg: string;
  };
  error?: string;
}

interface DataPurchaseRequest {
  network_id: number;
  plan_id: number;
  phone: string;
  customer_reference?: string;
}

interface DataPurchaseResponse {
  status: boolean;
  data?: {
    reference: string;
    msg: string;
  };
  error?: string;
}

interface TransactionResponse {
  status: string;
  reference: string;
  customer_reference: string;
  type: string;
  beneficiary: string;
  memo: string;
  response: string;
  price: string | null;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, ...params } = await req.json()
    
    // Get SME Plug API token from Supabase Edge Function secrets
    const token = Deno.env.get('VITE_SME_PLUG_TOKEN')
    if (!token) {
      throw new Error('SME Plug API token not configured. Please set VITE_SME_PLUG_TOKEN in Supabase Edge Function secrets.')
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
        
        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Failed to fetch networks: ${response.status} - ${errorText}`)
        }
        
        result = await response.json()
        break

      case 'get_data_plans':
        response = await fetch(`${baseUrl}/data/plans`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
        
        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Failed to fetch data plans: ${response.status} - ${errorText}`)
        }
        
        result = await response.json()
        break

      case 'buy_airtime':
        // Validate required parameters
        if (!params.network || !params.phone || !params.amount) {
          throw new Error('Missing required parameters: network, phone, amount')
        }

        // Map network name to network_id
        const networkId = NETWORK_MAPPINGS[params.network as keyof typeof NETWORK_MAPPINGS]
        if (!networkId) {
          throw new Error(`Invalid network: ${params.network}. Supported networks: ${Object.keys(NETWORK_MAPPINGS).join(', ')}`)
        }

        // Prepare airtime purchase request
        const airtimeData: AirtimePurchaseRequest = {
          network_id: networkId,
          phone: params.phone,
          amount: params.amount,
          customer_reference: params.customer_reference || `haaman-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        }
        
        console.log('Making airtime purchase request:', JSON.stringify(airtimeData, null, 2))
        
        response = await fetch(`${baseUrl}/airtime/purchase`, {
          method: 'POST',
          headers,
          body: JSON.stringify(airtimeData),
        })
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error('SME Plug API error:', errorText)
          throw new Error(`SME Plug API error: ${response.status} - ${errorText}`)
        }
        
        const airtimeResponse: AirtimePurchaseResponse = await response.json()
        
        if (!airtimeResponse.status) {
          throw new Error(airtimeResponse.error || 'Airtime purchase failed')
        }
        
        result = {
          success: true,
          data: airtimeResponse.data,
          message: airtimeResponse.data?.msg || 'Airtime purchase successful'
        }
        break

      case 'buy_data':
        // Validate required parameters
        if (!params.network || !params.phone || !params.plan_id) {
          throw new Error('Missing required parameters: network, phone, plan_id')
        }

        // Map network name to network_id
        const dataNetworkId = NETWORK_MAPPINGS[params.network as keyof typeof NETWORK_MAPPINGS]
        if (!dataNetworkId) {
          throw new Error(`Invalid network: ${params.network}. Supported networks: ${Object.keys(NETWORK_MAPPINGS).join(', ')}`)
        }

        // Convert plan_id to number
        const planId = parseInt(params.plan_id)
        if (isNaN(planId)) {
          throw new Error(`Invalid plan_id: ${params.plan_id}. Must be a valid number.`)
        }

        // Prepare data purchase request
        const dataPurchaseData: DataPurchaseRequest = {
          network_id: dataNetworkId,
          plan_id: planId,
          phone: params.phone,
          customer_reference: params.customer_reference || `haaman-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        }
        
        console.log('Making data purchase request:', JSON.stringify(dataPurchaseData, null, 2))
        
        response = await fetch(`${baseUrl}/data/purchase`, {
          method: 'POST',
          headers,
          body: JSON.stringify(dataPurchaseData),
        })
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error('SME Plug API error:', errorText)
          throw new Error(`SME Plug API error: ${response.status} - ${errorText}`)
        }
        
        const dataResponse: DataPurchaseResponse = await response.json()
        
        if (!dataResponse.status) {
          throw new Error(dataResponse.error || 'Data purchase failed')
        }
        
        result = {
          success: true,
          data: dataResponse.data,
          message: dataResponse.data?.msg || 'Data purchase successful'
        }
        break

      case 'requery_transaction':
        const reference = params.reference
        if (!reference) {
          throw new Error('Missing required parameter: reference')
        }
        
        response = await fetch(`${baseUrl}/transactions/${reference}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
        
        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Failed to requery transaction: ${response.status} - ${errorText}`)
        }
        
        const transactionResponse: TransactionResponse = await response.json()
        
        result = {
          success: true,
          data: transactionResponse,
          message: 'Transaction requery successful'
        }
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
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
}) 