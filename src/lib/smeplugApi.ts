import { supabase } from './supabase';

// Network mappings for SME Plug API
export const NETWORK_MAPPINGS = {
  'mtn': 1,
  'airtel': 2,
  'glo': 3,
  '9mobile': 4,
} as const;

interface AirtimePurchaseRequest {
  network: keyof typeof NETWORK_MAPPINGS;
  amount: number;
  phone: string;
  customer_reference?: string;
}

interface AirtimePurchaseResponse {
  success: boolean;
  data?: {
    reference: string;
    msg: string;
  };
  message?: string;
  error?: string;
}

interface DataPurchaseRequest {
  network: keyof typeof NETWORK_MAPPINGS;
  phone: string;
  plan_id: string;
  customer_reference?: string;
}

interface DataPurchaseResponse {
  success: boolean;
  data?: {
    reference: string;
    msg: string;
  };
  message?: string;
  error?: string;
}

interface TransactionResponse {
  success: boolean;
  data?: {
    status: string;
    reference: string;
    customer_reference: string;
    type: string;
    beneficiary: string;
    memo: string;
    response: string;
    price: string | null;
  };
  message?: string;
  error?: string;
}

class SMEPlugAPI {
  private getEdgeFunctionUrl() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('Supabase URL not configured');
    }
    return `${supabaseUrl}/functions/v1/smeplug-proxy`;
  }

  private async makeEdgeFunctionRequest(action: string, data: any) {
    try {
      const url = this.getEdgeFunctionUrl();
      const token = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!token) {
        throw new Error('Supabase anon key not configured');
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, ...data }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Request failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.success && result.error) {
        throw new Error(result.error || 'API request failed');
      }

      return result;

    } catch (error: any) {
      console.error('SME Plug Edge function request error:', error);
      
      if (error.message === 'Failed to fetch') {
        throw new Error('Unable to connect to payment service. Please check your internet connection and try again.');
      }
      
      if (error.message.includes('NetworkError') || 
          error.message.includes('ERR_NETWORK') ||
          error.message.includes('ERR_INTERNET_DISCONNECTED')) {
        throw new Error('Network connection error. Please check your internet connection and try again.');
      }

      throw error;
    }
  }

  async buyAirtime(data: AirtimePurchaseRequest): Promise<AirtimePurchaseResponse> {
    return await this.makeEdgeFunctionRequest('buy_airtime', {
      network: data.network,
      phone: data.phone,
      amount: data.amount,
      customer_reference: data.customer_reference,
    });
  }

  async buyData(data: DataPurchaseRequest): Promise<DataPurchaseResponse> {
    return await this.makeEdgeFunctionRequest('buy_data', {
      network: data.network,
      phone: data.phone,
      plan_id: data.plan_id,
      customer_reference: data.customer_reference,
    });
  }

  async getNetworks() {
    return await this.makeEdgeFunctionRequest('get_networks', {});
  }

  async getDataPlans() {
    return await this.makeEdgeFunctionRequest('get_data_plans', {});
  }

  async requeryTransaction(reference: string): Promise<TransactionResponse> {
    return await this.makeEdgeFunctionRequest('requery_transaction', {
      reference,
    });
  }
}

export const smeplugAPI = new SMEPlugAPI(); 