import { maskawaAPI } from './maskawaApi';
import { smeplugAPI } from './smeplugApi';
import { supabase } from './supabase';
import { generateTransactionReference } from './utils';

export type ServiceType = 'airtime' | 'data' | 'electricity';

export interface ServiceTransaction {
  id: string;
  user_id: string;
  type: ServiceType;
  amount: number;
  status: 'pending' | 'success' | 'failed';
  reference: string;
  details: any;
  external_reference?: string;
  created_at: string;
}

class ServiceAPI {
  async processAirtimeTransaction(
    userId: string,
    data: {
      network: string;
      amount: number;
      phoneNumber: string;
    }
  ): Promise<ServiceTransaction> {
    const reference = generateTransactionReference();

    // Determine airtime provider from admin settings (default: maskawa)
    let airtimeProvider: 'maskawa' | 'smeplug' = 'maskawa';
    try {
      const { data: providerSetting } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'airtime_provider')
        .single();
      if (providerSetting?.value === 'smeplug' || providerSetting?.value === 'maskawa') {
        airtimeProvider = providerSetting.value as 'maskawa' | 'smeplug';
      }
    } catch (_) {
      // Ignore and use default
    }
    
    // Create pending transaction
    const transaction = {
      user_id: userId,
      type: 'airtime' as ServiceType,
      amount: data.amount,
      status: 'pending' as const,
      reference,
      details: {
        network: data.network,
        phone: data.phoneNumber,
        service_provider: airtimeProvider,
      },
    };

    const { data: dbTransaction, error: dbError } = await supabase
      .from('transactions')
      .insert([transaction])
      .select()
      .single();

    if (dbError) {
      console.error('Database error creating transaction:', dbError);
      throw new Error('Failed to create transaction record. Please try again.');
    }

    try {
      // Route to selected provider
      const apiResponse =
        airtimeProvider === 'smeplug'
          ? await smeplugAPI.buyAirtime({
              network: data.network as any,
              amount: data.amount,
              phone: data.phoneNumber,
              customer_reference: reference,
            })
          : await maskawaAPI.buyAirtime({
              network: data.network as any,
              amount: data.amount,
              mobile_number: data.phoneNumber,
            });

      // Update transaction as successful
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          status: 'success',
          details: {
            ...transaction.details,
            api_response: apiResponse,
            external_reference:
              // SME Plug
              (apiResponse as any)?.data?.reference || (apiResponse as any)?.reference ||
              // MASKAWA
              (apiResponse as any)?.id,
          },
        })
        .eq('id', dbTransaction.id);

      if (updateError) {
        console.error('Database error updating transaction:', updateError);
        // Don't throw here as the API call was successful
      }

      return {
        ...dbTransaction,
        status: 'success',
        details: {
          ...transaction.details,
          api_response: apiResponse,
          external_reference: apiResponse?.data?.reference || apiResponse?.reference,
        },
      };

    } catch (error: any) {
      console.error('Airtime purchase error:', error);

      // Update transaction as failed
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          status: 'failed',
          details: {
            ...transaction.details,
            error: error.message,
          },
        })
        .eq('id', dbTransaction.id);

      if (updateError) {
        console.error('Database error updating failed transaction:', updateError);
      }

      // Provide user-friendly error messages based on the specific error
      if (error.message.includes('API token not configured') || 
          error.message.includes('YOUR_MASKAWA_TOKEN_HERE')) {
        throw new Error('Payment service not configured. Please contact support to set up the payment system.');
      }
      
      if (error.message.includes('API configuration not found') ||
          error.message.includes('API configuration is incomplete')) {
        throw new Error('Payment service configuration missing. Please contact support.');
      }
      
      if (error.message.includes('Unable to connect') || 
          error.message.includes('Network connection error') ||
          error.message.includes('timeout') || 
          error.message.includes('Failed to fetch')) {
        throw new Error('Unable to connect to payment service. Please check your internet connection and try again.');
      }
      
      if (error.message.includes('API authentication failed') ||
          error.message.includes('API access denied')) {
        throw new Error('Payment service authentication error. Please contact support.');
      }
      
      if (error.message.includes('API server error') ||
          error.message.includes('Service configuration error')) {
        throw new Error('Payment service temporarily unavailable. Please try again later or contact support.');
      }

      // For any other errors, use the original message or a generic fallback
      throw new Error(error.message || 'Transaction failed. Please try again or contact support if the issue persists.');
    }
  }

  async processDataTransaction(
    userId: string,
    data: {
      network: string;
      plan: string;
      phoneNumber: string;
      amount: number;
    }
  ): Promise<ServiceTransaction> {
    const reference = generateTransactionReference();
    
    // Create pending transaction
    const transaction = {
      user_id: userId,
      type: 'data' as ServiceType,
      amount: data.amount,
      status: 'pending' as const,
      reference,
      details: {
        network: data.network,
        plan: data.plan,
        phone: data.phoneNumber,
        service_provider: 'smeplug',
      },
    };

    const { data: dbTransaction, error: dbError } = await supabase
      .from('transactions')
      .insert([transaction])
      .select()
      .single();

    if (dbError) {
      console.error('Database error creating transaction:', dbError);
      throw new Error('Failed to create transaction record. Please try again.');
    }

    try {
      // Determine provider per plan using external_id
      let planProvider: 'smeplug' | 'maskawa' = 'smeplug';
      try {
        const externalIdNum = parseInt(data.plan);
        const { data: planRow } = await supabase
          .from('data_plans')
          .select('provider')
          .eq('external_id', externalIdNum)
          .maybeSingle();
        if (planRow?.provider === 'maskawa' || planRow?.provider === 'smeplug') {
          planProvider = planRow.provider as 'smeplug' | 'maskawa';
        }
      } catch (_) {
        // ignore; default smeplug
      }

      // Update details with chosen provider
      await supabase
        .from('transactions')
        .update({
          details: { ...transaction.details, service_provider: planProvider },
        })
        .eq('reference', reference);

      const apiResponse =
        planProvider === 'smeplug'
          ? await smeplugAPI.buyData({
              network: data.network as any,
              phone: data.phoneNumber,
              plan_id: data.plan,
              customer_reference: reference,
            })
          : await maskawaAPI.buyData({
              network: data.network as any,
              mobile_number: data.phoneNumber,
              plan: data.plan,
            });

      // Update transaction as successful
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          status: 'success',
          details: {
            ...transaction.details,
            api_response: apiResponse,
            external_reference:
              // SME Plug
              (apiResponse as any)?.data?.reference || (apiResponse as any)?.reference ||
              // MASKAWA
              (apiResponse as any)?.id,
          },
        })
        .eq('id', dbTransaction.id);

      if (updateError) {
        console.error('Database error updating transaction:', updateError);
        // Don't throw here as the API call was successful
      }

      return {
        ...dbTransaction,
        status: 'success',
        details: {
          ...transaction.details,
          api_response: apiResponse,
          external_reference: apiResponse?.data?.reference || apiResponse?.reference,
        },
      };

    } catch (error: any) {
      console.error('Data purchase error:', error);

      // Update transaction as failed
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          status: 'failed',
          details: {
            ...transaction.details,
            error: error.message,
          },
        })
        .eq('id', dbTransaction.id);

      if (updateError) {
        console.error('Database error updating failed transaction:', updateError);
      }

      // Provide user-friendly error messages based on the specific error
      if (error.message.includes('API token not configured') || 
          error.message.includes('YOUR_MASKAWA_TOKEN_HERE')) {
        throw new Error('Payment service not configured. Please contact support to set up the payment system.');
      }
      
      if (error.message.includes('API configuration not found') ||
          error.message.includes('API configuration is incomplete')) {
        throw new Error('Payment service configuration missing. Please contact support.');
      }
      
      if (error.message.includes('Unable to connect') || 
          error.message.includes('Network connection error') ||
          error.message.includes('timeout') || 
          error.message.includes('Failed to fetch')) {
        throw new Error('Unable to connect to payment service. Please check your internet connection and try again.');
      }
      
      if (error.message.includes('API authentication failed') ||
          error.message.includes('API access denied')) {
        throw new Error('Payment service authentication error. Please contact support.');
      }
      
      if (error.message.includes('API server error') ||
          error.message.includes('Service configuration error')) {
        throw new Error('Payment service temporarily unavailable. Please try again later or contact support.');
      }

      // For any other errors, use the original message or a generic fallback
      throw new Error(error.message || 'Transaction failed. Please try again or contact support if the issue persists.');
    }
  }

  async processElectricityTransaction(
    userId: string,
    data: {
      disco: string;
      amount: number;
      meterNumber: string;
      meterType: string;
    }
  ): Promise<ServiceTransaction> {
    const reference = generateTransactionReference();
    
    // Create pending transaction
    const transaction = {
      user_id: userId,
      type: 'electricity' as ServiceType,
      amount: data.amount,
      status: 'pending' as const,
      reference,
      details: {
        disco: data.disco,
        meterNumber: data.meterNumber,
        meterType: data.meterType,
        service_provider: 'maskawa',
      },
    };

    const { data: dbTransaction, error: dbError } = await supabase
      .from('transactions')
      .insert([transaction])
      .select()
      .single();

    if (dbError) {
      console.error('Database error creating transaction:', dbError);
      throw new Error('Failed to create transaction record. Please try again.');
    }

    try {
      // Call MASKAWA API
      const apiResponse = await maskawaAPI.buyElectricity({
        disco_name: data.disco as any,
        amount: data.amount,
        meter_number: data.meterNumber,
        meter_type: data.meterType as any,
      });

      // Update transaction as successful
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          status: 'success',
          details: {
            ...transaction.details,
            api_response: apiResponse,
            external_reference: apiResponse?.reference || apiResponse?.id,
          },
        })
        .eq('id', dbTransaction.id);

      if (updateError) {
        console.error('Database error updating transaction:', updateError);
        // Don't throw here as the API call was successful
      }

      return {
        ...dbTransaction,
        status: 'success',
      };
    } catch (error: any) {
      console.error('API error during electricity purchase:', error);
      
      // Update transaction as failed
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          status: 'failed',
          details: {
            ...transaction.details,
            error: error instanceof Error ? error.message : 'Unknown error',
            error_time: new Date().toISOString(),
          },
        })
        .eq('id', dbTransaction.id);

      if (updateError) {
        console.error('Database error updating failed transaction:', updateError);
      }

      // Provide user-friendly error messages based on the specific error
      if (error.message.includes('API token not configured') || 
          error.message.includes('YOUR_MASKAWA_TOKEN_HERE')) {
        throw new Error('Payment service not configured. Please contact support to set up the payment system.');
      }
      
      if (error.message.includes('API configuration not found') ||
          error.message.includes('API configuration is incomplete')) {
        throw new Error('Payment service configuration missing. Please contact support.');
      }
      
      if (error.message.includes('Unable to connect') || 
          error.message.includes('Network connection error') ||
          error.message.includes('timeout') || 
          error.message.includes('Failed to fetch')) {
        throw new Error('Unable to connect to payment service. Please check your internet connection and try again.');
      }
      
      if (error.message.includes('API authentication failed') ||
          error.message.includes('API access denied')) {
        throw new Error('Payment service authentication error. Please contact support.');
      }
      
      if (error.message.includes('API server error') ||
          error.message.includes('Service configuration error')) {
        throw new Error('Payment service temporarily unavailable. Please try again later or contact support.');
      }

      // For any other errors, use the original message or a generic fallback
      throw new Error(error.message || 'Transaction failed. Please try again or contact support if the issue persists.');
    }
  }
}

export const serviceAPI = new ServiceAPI();