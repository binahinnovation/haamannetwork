import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';
import { supabase } from '../lib/supabase';

type AuthUser = User;

type AuthState = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  realtimeSubscription: any | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, phone: string, referralCode?: string, bvn?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<AuthUser>) => Promise<void>;
  updateWalletBalance: (newBalance: number) => Promise<void>; // DEPRECATED - kept for compatibility
  processSecurePurchase: (amount: number, transactionType: string, transactionDetails?: any, externalTransactionId?: string) => Promise<any>;
  processSecureDeposit: (amount: number, depositDetails?: any, externalTransactionId?: string) => Promise<any>;
  processSecureRefund: (amount: number, originalTransactionId: string, refundReason: string, refundDetails?: any) => Promise<any>;
  getSecureBalance: () => Promise<number>;
  getSpendingLimitInfo: () => Promise<any>;
  getDailySpending: () => Promise<any>;
  checkAuth: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  createVirtualAccount: (userId: string, email: string, firstName: string, lastName: string, phoneNumber?: string, bvn?: string) => Promise<void>;
  initRealtimeSubscription: () => void;
  cleanupRealtimeSubscription: () => void;
  verifyReferralCode: (code: string) => Promise<boolean>;
  setTransactionPin: (pin: string, currentPin?: string) => Promise<void>;
  verifyTransactionPin: (pin: string) => Promise<boolean>;
  checkPinStatus: () => Promise<{hasPin: boolean, isLocked: boolean, lockedUntil: string | null}>;
  resetTransactionPin: () => Promise<void>;
  resetTransactionPinForAdmin: (userId: string) => Promise<{ success: boolean }>;
};

// Function to generate a random alphanumeric string for referral codes
const generateRandomReferralCode = (length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `HN-${result}`;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      realtimeSubscription: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) throw error;

          if (data.user) {
            // Get user profile from database
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', data.user.id)
              .single();

            if (profileError) {
              // Only create profile if it doesn't exist (PGRST116 error code)
              if (profileError.code === 'PGRST116') {
                // Generate a unique referral code
                const referralCode = generateRandomReferralCode();
                
                const newProfile = {
                  id: data.user.id,
                  name: data.user.user_metadata?.name || 'User',
                  email: data.user.email!,
                  phone: data.user.user_metadata?.phone || '',
                  wallet_balance: 0,
                  is_admin: false,
                  referral_code: referralCode,
                  referred_by: null,
                  total_referrals: 0,
                  referral_earnings: 0,
                  created_at: new Date().toISOString(),
                };

                const { data: insertedProfile, error: insertError } = await supabase
                  .from('profiles')
                  .insert([newProfile])
                  .select()
                  .single();

                if (insertError) {
                  // If insert fails due to duplicate key, try to fetch the existing profile
                  if (insertError.code === '23505') {
                    const { data: existingProfile, error: fetchError } = await supabase
                      .from('profiles')
                      .select('*')
                      .eq('id', data.user.id)
                      .single();

                    if (fetchError) throw fetchError;
                    
                    set({
                      user: {
                        id: existingProfile.id,
                        name: existingProfile.name,
                        email: existingProfile.email,
                        phone: existingProfile.phone,
                        walletBalance: existingProfile.wallet_balance,
                        isAdmin: existingProfile.is_admin,
                        referralCode: existingProfile.referral_code,
                        referredBy: existingProfile.referred_by,
                        totalReferrals: existingProfile.total_referrals,
                        referralEarnings: existingProfile.referral_earnings,
                        createdAt: existingProfile.created_at,
                        virtualAccountBankName: existingProfile.virtual_account_bank_name,
                        virtualAccountNumber: existingProfile.virtual_account_number,
                        virtualAccountReference: existingProfile.virtual_account_reference,
                        bvn: existingProfile.bvn,
                        hasPin: !!existingProfile.transaction_pin,
                      },
                      isAuthenticated: true,
                      isLoading: false,
                    });
                    
                    // Initialize realtime subscription
                    get().initRealtimeSubscription();
                  } else {
                    throw insertError;
                  }
                } else {
                  set({
                    user: {
                      id: insertedProfile.id,
                      name: insertedProfile.name,
                      email: insertedProfile.email,
                      phone: insertedProfile.phone,
                      walletBalance: insertedProfile.wallet_balance,
                      isAdmin: insertedProfile.is_admin,
                      referralCode: insertedProfile.referral_code,
                      referredBy: insertedProfile.referred_by,
                      totalReferrals: insertedProfile.total_referrals,
                      referralEarnings: insertedProfile.referral_earnings,
                      createdAt: insertedProfile.created_at,
                      virtualAccountBankName: insertedProfile.virtual_account_bank_name,
                      virtualAccountNumber: insertedProfile.virtual_account_number,
                      virtualAccountReference: insertedProfile.virtual_account_reference,
                      bvn: insertedProfile.bvn,
                      hasPin: false,
                    },
                    isAuthenticated: true,
                    isLoading: false,
                  });
                  
                  // Initialize realtime subscription
                  get().initRealtimeSubscription();
                }
              } else {
                // For other errors, throw them
                throw profileError;
              }
            } else {
              set({
                user: {
                  id: profile.id,
                  name: profile.name,
                  email: profile.email,
                  phone: profile.phone,
                  walletBalance: profile.wallet_balance,
                  isAdmin: profile.is_admin,
                  referralCode: profile.referral_code,
                  referredBy: profile.referred_by,
                  totalReferrals: profile.total_referrals,
                  referralEarnings: profile.referral_earnings,
                  createdAt: profile.created_at,
                  virtualAccountBankName: profile.virtual_account_bank_name,
                  virtualAccountNumber: profile.virtual_account_number,
                  virtualAccountReference: profile.virtual_account_reference,
                  bvn: profile.bvn,
                  hasPin: !!profile.transaction_pin,
                },
                isAuthenticated: true,
                isLoading: false,
              });
              
              // Initialize realtime subscription
              get().initRealtimeSubscription();
            }
          }
        } catch (error: any) {
          set({ isLoading: false });
          throw new Error(error.message || 'Login failed');
        }
      },

      signup: async (email: string, password: string, name: string, phone: string, referralCode?: string, bvn?: string) => {
        set({ isLoading: true });
        try {
          // Validate required fields
          if (!phone || !phone.trim()) {
            throw new Error('Phone number is required');
          }
          
          // Check if phone number already exists
          const { data: existingPhone, error: phoneError } = await supabase
            .from('profiles')
            .select('id')
            .eq('phone', phone.trim())
            .maybeSingle();
            
          if (phoneError && phoneError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
            console.error('Error checking phone number:', phoneError);
          } else if (existingPhone) {
            throw new Error('This phone number is already registered. Please use a different phone number.');
          }
          
          // Verify referral code if provided
          let referrerProfile = null;
          if (referralCode && referralCode.trim() !== '') {
            // Format the referral code properly before querying
            const formattedReferralCode = referralCode.trim();
            
            const { data: referrer, error: referrerError } = await supabase
              .from('profiles')
              .select('*')
              .eq('referral_code', formattedReferralCode)
              .maybeSingle();
              
            if (referrerError) {
              console.error('Error getting referrer profile:', referrerError);
              // Don't throw an error, just log it and continue with signup
            } else if (referrer) {
              referrerProfile = referrer;
            } else {
              throw new Error('Invalid referral code. Please check and try again.');
            }
          }

          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                name,
                phone,
                referralCode,
                bvn,
              },
            },
          });

          if (error) throw error;

          if (data.user && data.user.id) {
            // Generate unique random referral code
            const userReferralCode = generateRandomReferralCode();
            
            // Check if user has a session (means they're confirmed and logged in)
            // If email confirmation is enabled, data.session will be null until email is confirmed
            if (!data.session) {
              // User created but needs to confirm email
              // We'll create the profile but not log them in
              try {
                await supabase.rpc('create_user_profile', {
                  user_id: data.user.id,
                  user_name: name,
                  user_email: email,
                  user_phone: phone,
                  user_referral_code: userReferralCode,
                  user_referred_by: referrerProfile?.id || null,
                  user_bvn: bvn || null
                });
              } catch (profileError) {
                console.error('Profile creation error during signup:', profileError);
                // Don't throw error here, profile can be created later on login
              }
              
              set({ isLoading: false });
              return; // Don't log them in, they need to confirm email first
            }

            const { data: insertedProfile, error: profileError } = await supabase
              .rpc('create_user_profile', {
                user_id: data.user.id,
                user_name: name,
                user_email: email,
                user_phone: phone,
                user_referral_code: userReferralCode,
                user_referred_by: referrerProfile?.id || null,
                user_bvn: bvn || null
              });

            if (profileError) {
              console.error('Profile creation error:', profileError);
              throw new Error('Failed to create user profile: ' + profileError.message);
            }

            // The function returns JSON, so we need to parse it
            const profileData = insertedProfile;
            
            if (!profileData) {
              throw new Error('Failed to create user profile');
            }

            // Handle potential duplicate profile (though less likely with the function)
            if (false) { // Keeping the old logic structure but disabling it
              // If profile creation fails due to duplicate key, fetch existing profile
              if (false) {
                const { data: existingProfile, error: fetchError } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('id', data.user!.id)
                  .single();

                if (fetchError) throw fetchError;

                set({
                  user: {
                    id: existingProfile.id,
                    name: existingProfile.name,
                    email: existingProfile.email,
                    phone: existingProfile.phone,
                    walletBalance: existingProfile.wallet_balance,
                    isAdmin: existingProfile.is_admin,
                    referralCode: existingProfile.referral_code,
                    referredBy: existingProfile.referred_by,
                    totalReferrals: existingProfile.total_referrals,
                    referralEarnings: existingProfile.referral_earnings,
                    createdAt: existingProfile.created_at,
                    virtualAccountBankName: existingProfile.virtual_account_bank_name,
                    virtualAccountNumber: existingProfile.virtual_account_number,
                    virtualAccountReference: existingProfile.virtual_account_reference,
                    bvn: existingProfile.bvn,
                    hasPin: !!existingProfile.transaction_pin,
                  },
                  isAuthenticated: true,
                  isLoading: false,
                });
                
                // Initialize realtime subscription
                get().initRealtimeSubscription();
                return;
              } else {
                throw profileError;
              }
            }

            // Update referrer's total referrals count using the Edge Function
            if (referrerProfile) {
              try {
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                if (!supabaseUrl) {
                  throw new Error('Supabase URL not configured');
                }
                
                const response = await fetch(`${supabaseUrl}/functions/v1/update-referral-count`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                  },
                  body: JSON.stringify({
                    referrerId: referrerProfile.id,
                    referredUserId: data.user.id,
                    referredUserName: name,
                    referralCode: referralCode
                  }),
                });
                
                if (!response.ok) {
                  const errorText = await response.text();
                  console.error('Error updating referral count:', errorText);
                }
              } catch (error) {
                console.error('Error calling update-referral-count function:', error);
                // Don't throw here, as the signup was successful
              }
            }

            // Set user in state (profileData is JSON from the function)
            const user = {
              id: profileData.id,
              name: profileData.name,
              email: profileData.email,
              phone: profileData.phone,
              walletBalance: profileData.wallet_balance,
              isAdmin: profileData.is_admin,
              referralCode: profileData.referral_code,
              referredBy: profileData.referred_by,
              totalReferrals: profileData.total_referrals,
              referralEarnings: profileData.referral_earnings,
              createdAt: profileData.created_at,
              virtualAccountBankName: profileData.virtual_account_bank_name,
              virtualAccountNumber: profileData.virtual_account_number,
              virtualAccountReference: profileData.virtual_account_reference,
              bvn: profileData.bvn,
              hasPin: false,
            };

            set({
              user,
              isAuthenticated: true,
              isLoading: false,
            });
            
            // Initialize realtime subscription
            get().initRealtimeSubscription();

            // Create virtual account if BVN is provided
            if (bvn) {
              try {
                // Split name into first and last name
                const nameParts = name.split(' ');
                const firstName = nameParts[0];
                const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
                
                await get().createVirtualAccount(
                  user.id,
                  email,
                  firstName,
                  lastName,
                  phone,
                  bvn
                );
              } catch (error) {
                console.error('Error creating virtual account:', error);
                // Don't throw here, as the signup was successful
              }
            }
          }
        } catch (error: any) {
          set({ isLoading: false });
          throw new Error(error.message || 'Signup failed');
        }
      },

      logout: async () => {
        // Clean up realtime subscription
        get().cleanupRealtimeSubscription();
        
        await supabase.auth.signOut();
        set({ user: null, isAuthenticated: false });
      },

      updateUser: async (data) => {
        const state = get();
        if (!state.user) return;

        try {
          // Update in database
          const { error } = await supabase
            .from('profiles')
            .update(data)
            .eq('id', state.user.id);

          if (error) throw error;

          // Update local state
          set((state) => ({
            user: state.user ? { ...state.user, ...data } : null,
          }));
        } catch (error) {
          console.error('Error updating user:', error);
          throw error;
        }
      },

      // DEPRECATED: Direct balance updates are now forbidden for security
      updateWalletBalance: async (_newBalance) => {
        console.error('SECURITY WARNING: Direct wallet balance updates are disabled. Use processSecurePurchase, processSecureDeposit, or processSecureRefund instead.');
        throw new Error('Direct wallet balance updates are disabled for security. Use secure transaction functions.');
      },

      // NEW SECURE FUNCTIONS WITH TRANSACTION LOCKING AND SPENDING LIMITS
      processSecurePurchase: async (amount: number, transactionType: string, transactionDetails: any = {}, externalTransactionId?: string) => {
        const state = get();
        if (!state.user) throw new Error('User not authenticated');

        try {
          // Use the new secure function with transaction locking and spending limits
          const { data, error } = await supabase.rpc('process_secure_purchase_with_limits', {
            p_user_id: state.user.id,
            p_amount: amount,
            p_transaction_type: transactionType,
            p_transaction_details: transactionDetails,
            p_external_transaction_id: externalTransactionId
          });

          if (error) throw error;

          if (!data.success) {
            throw new Error(data.error || 'Transaction failed');
          }

          // Update local state with new balance
          set((state) => ({
            user: state.user ? { ...state.user, walletBalance: data.balance_after } : null,
          }));

          return data;
        } catch (error) {
          console.error('Error processing secure purchase:', error);
          throw error;
        }
      },

      // NEW: Function to get user's spending limit and current usage
      getSpendingLimitInfo: async () => {
        const state = get();
        if (!state.user) throw new Error('User not authenticated');

        try {
          const { data, error } = await supabase.rpc('get_user_spending_limit', {
            p_user_id: state.user.id
          });

          if (error) throw error;

          if (!data.success) {
            throw new Error(data.error || 'Failed to get spending limit');
          }

          return data;
        } catch (error) {
          console.error('Error getting spending limit:', error);
          throw error;
        }
      },

      // NEW: Function to get user's daily spending
      getDailySpending: async () => {
        const state = get();
        if (!state.user) throw new Error('User not authenticated');

        try {
          const { data, error } = await supabase.rpc('get_user_daily_spending', {
            p_user_id: state.user.id
          });

          if (error) throw error;

          if (!data.success) {
            throw new Error(data.error || 'Failed to get daily spending');
          }

          return data;
        } catch (error) {
          console.error('Error getting daily spending:', error);
          throw error;
        }
      },

      processSecureDeposit: async (amount: number, depositDetails: any = {}, externalTransactionId?: string) => {
        const state = get();
        if (!state.user) throw new Error('User not authenticated');

        try {
          const { data, error } = await supabase.rpc('process_secure_deposit', {
            p_user_id: state.user.id,
            p_amount: amount,
            p_deposit_details: depositDetails,
            p_external_transaction_id: externalTransactionId
          });

          if (error) throw error;

          if (!data.success) {
            throw new Error(data.error || 'Deposit failed');
          }

          // Update local state with new balance
          set((state) => ({
            user: state.user ? { ...state.user, walletBalance: data.balance_after } : null,
          }));

          return data;
        } catch (error) {
          console.error('Error processing secure deposit:', error);
          throw error;
        }
      },

      processSecureRefund: async (amount: number, originalTransactionId: string, refundReason: string, refundDetails: any = {}) => {
        const state = get();
        if (!state.user) throw new Error('User not authenticated');

        try {
          const { data, error } = await supabase.rpc('process_secure_refund', {
            p_user_id: state.user.id,
            p_amount: amount,
            p_original_transaction_id: originalTransactionId,
            p_refund_reason: refundReason,
            p_refund_details: refundDetails
          });

          if (error) throw error;

          if (!data.success) {
            throw new Error(data.error || 'Refund failed');
          }

          // Update local state with new balance
          set((state) => ({
            user: state.user ? { ...state.user, walletBalance: data.balance_after } : null,
          }));

          return data;
        } catch (error) {
          console.error('Error processing secure refund:', error);
          throw error;
        }
      },

      getSecureBalance: async () => {
        const state = get();
        if (!state.user) throw new Error('User not authenticated');

        try {
          const { data, error } = await supabase.rpc('get_secure_user_balance', {
            p_user_id: state.user.id
          });

          if (error) throw error;

          if (!data.success) {
            throw new Error(data.error || 'Failed to get balance');
          }

          // Update local state with current balance
          set((state) => ({
            user: state.user ? { ...state.user, walletBalance: data.balance } : null,
          }));

          return data.balance;
        } catch (error) {
          console.error('Error getting secure balance:', error);
          throw error;
        }
      },

      refreshUserData: async () => {
        const state = get();
        if (!state.user) return;

        try {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', state.user.id)
            .single();

          if (error) {
            console.error("Error fetching profile:", error);
            throw error;
          }

          if (profile) {
            set({
              user: {
                id: profile.id,
                name: profile.name,
                email: profile.email,
                phone: profile.phone,
                walletBalance: profile.wallet_balance,
                isAdmin: profile.is_admin,
                referralCode: profile.referral_code,
                referredBy: profile.referred_by,
                totalReferrals: profile.total_referrals,
                referralEarnings: profile.referral_earnings,
                createdAt: profile.created_at,
                virtualAccountBankName: profile.virtual_account_bank_name,
                virtualAccountNumber: profile.virtual_account_number,
                virtualAccountReference: profile.virtual_account_reference,
                bvn: profile.bvn,
                hasPin: !!profile.transaction_pin,
              },
            });
          }
        } catch (error) {
          console.error('Error refreshing user data:', error);
        }
      },

      checkAuth: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profileError && profileError.code === 'PGRST116') {
            // Profile doesn't exist, create one
            const referralCode = generateRandomReferralCode();
            
            const newProfile = {
              id: session.user.id,
              name: session.user.user_metadata?.name || 'User',
              email: session.user.email!,
              phone: session.user.user_metadata?.phone || '',
              wallet_balance: 0,
              is_admin: false,
              referral_code: referralCode,
              referred_by: null,
              total_referrals: 0,
              referral_earnings: 0,
              created_at: new Date().toISOString(),
            };

            const { data: insertedProfile, error: insertError } = await supabase
              .from('profiles')
              .insert([newProfile])
              .select()
              .single();

            if (insertError) {
              // If insert fails due to duplicate key, try to fetch the existing profile
              if (insertError.code === '23505') {
                const { data: existingProfile, error: fetchError } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('id', session.user.id)
                  .single();

                if (!fetchError && existingProfile) {
                  set({
                    user: {
                      id: existingProfile.id,
                      name: existingProfile.name,
                      email: existingProfile.email,
                      phone: existingProfile.phone,
                      walletBalance: existingProfile.wallet_balance,
                      isAdmin: existingProfile.is_admin,
                      referralCode: existingProfile.referral_code,
                      referredBy: existingProfile.referred_by,
                      totalReferrals: existingProfile.total_referrals,
                      referralEarnings: existingProfile.referral_earnings,
                      createdAt: existingProfile.created_at,
                      virtualAccountBankName: existingProfile.virtual_account_bank_name,
                      virtualAccountNumber: existingProfile.virtual_account_number,
                      virtualAccountReference: existingProfile.virtual_account_reference,
                      bvn: existingProfile.bvn,
                      hasPin: !!existingProfile.transaction_pin,
                    },
                    isAuthenticated: true,
                  });
                  
                  // Initialize realtime subscription
                  get().initRealtimeSubscription();
                }
              }
            } else if (insertedProfile) {
              set({
                user: {
                  id: insertedProfile.id,
                  name: insertedProfile.name,
                  email: insertedProfile.email,
                  phone: insertedProfile.phone,
                  walletBalance: insertedProfile.wallet_balance,
                  isAdmin: insertedProfile.is_admin,
                  referralCode: insertedProfile.referral_code,
                  referredBy: insertedProfile.referred_by,
                  totalReferrals: insertedProfile.total_referrals,
                  referralEarnings: insertedProfile.referral_earnings,
                  createdAt: insertedProfile.created_at,
                  virtualAccountBankName: insertedProfile.virtual_account_bank_name,
                  virtualAccountNumber: insertedProfile.virtual_account_number,
                  virtualAccountReference: insertedProfile.virtual_account_reference,
                  bvn: insertedProfile.bvn,
                  hasPin: false,
                },
                isAuthenticated: true,
              });
              
              // Initialize realtime subscription
              get().initRealtimeSubscription();
            }
          } else if (profile) {
            set({
              user: {
                id: profile.id,
                name: profile.name,
                email: profile.email,
                phone: profile.phone,
                walletBalance: profile.wallet_balance,
                isAdmin: profile.is_admin,
                referralCode: profile.referral_code,
                referredBy: profile.referred_by,
                totalReferrals: profile.total_referrals,
                referralEarnings: profile.referral_earnings,
                createdAt: profile.created_at,
                virtualAccountBankName: profile.virtual_account_bank_name,
                virtualAccountNumber: profile.virtual_account_number,
                virtualAccountReference: profile.virtual_account_reference,
                bvn: profile.bvn,
                hasPin: !!profile.transaction_pin,
              },
              isAuthenticated: true,
            });
            
            // Initialize realtime subscription
            get().initRealtimeSubscription();
          }
        } else {
          set({ user: null, isAuthenticated: false });
          // Clean up any existing subscription
          get().cleanupRealtimeSubscription();
        }
      },

      createVirtualAccount: async (userId, email, firstName, lastName, phoneNumber, bvn) => {
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          if (!supabaseUrl) {
            throw new Error('Supabase URL not configured');
          }

          // Get the current session for authentication
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            throw new Error('User not authenticated');
          }

          const response = await fetch(`${supabaseUrl}/functions/v1/create-virtual-account`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              userId,
              email,
              firstName,
              lastName,
              phoneNumber,
              bvn,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to create virtual account: ${errorText}`);
          }

          const result = await response.json();
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to create virtual account');
          }

          // Update user state with virtual account details
          set((state) => ({
            user: state.user ? {
              ...state.user,
              virtualAccountBankName: result.data.bank_name,
              virtualAccountNumber: result.data.account_number,
              virtualAccountReference: result.data.reference,
              bvn: bvn,
            } : null,
          }));

          return result.data;
        } catch (error) {
          console.error('Error creating virtual account:', error);
          throw error;
        }
      },
      
      // New function to initialize realtime subscription
      initRealtimeSubscription: () => {
        const state = get();
        
        // Clean up any existing subscription first
        get().cleanupRealtimeSubscription();
        
        if (!state.user) return;
        
        try {
          // Subscribe to changes in the profiles table for the current user
          const subscription = supabase
            .channel(`profile-changes-${state.user.id}`)
            .on(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles',
                filter: `id=eq.${state.user.id}`,
              },
              (payload) => {
                console.log('Real-time profile update received:', payload);
                
                // Update the user's wallet balance in the local state
                if (payload.new && payload.new.wallet_balance !== undefined) {
                  const newBalance = parseFloat(payload.new.wallet_balance);
                  console.log('Updating wallet balance from', state.user?.walletBalance, 'to', newBalance);
                  
                  set((state) => ({
                    user: state.user ? {
                      ...state.user,
                      walletBalance: newBalance,
                      // Also update referral stats if they've changed
                      totalReferrals: payload.new.total_referrals !== undefined ? 
                        payload.new.total_referrals : 
                        state.user?.totalReferrals || 0,
                      referralEarnings: payload.new.referral_earnings !== undefined ? 
                        parseFloat(payload.new.referral_earnings) : 
                        state.user?.referralEarnings || 0,
                    } : null,
                  }));
                }
                
                // Update referral stats specifically if they've changed
                if (payload.new && 
                   (payload.new.total_referrals !== undefined || 
                    payload.new.referral_earnings !== undefined)) {
                  set((state) => ({
                    user: state.user ? {
                      ...state.user,
                      totalReferrals: payload.new.total_referrals !== undefined ? 
                        payload.new.total_referrals : 
                        state.user?.totalReferrals || 0,
                      referralEarnings: payload.new.referral_earnings !== undefined ? 
                        parseFloat(payload.new.referral_earnings) : 
                        state.user?.referralEarnings || 0,
                    } : null,
                  }));
                }

                // Update transaction PIN status if it's changed
                if (payload.new && payload.new.transaction_pin !== undefined) {
                  set((state) => ({
                    user: state.user ? {
                      ...state.user,
                      hasPin: !!payload.new.transaction_pin,
                    } : null,
                  }));
                }

                // Update virtual account info if it's changed
                if (payload.new && (
                  payload.new.virtual_account_number !== undefined ||
                  payload.new.virtual_account_bank_name !== undefined ||
                  payload.new.virtual_account_reference !== undefined ||
                  payload.new.bvn !== undefined
                )) {
                  set((state) => ({
                    user: state.user ? {
                      ...state.user,
                      virtualAccountNumber: payload.new.virtual_account_number || state.user?.virtualAccountNumber,
                      virtualAccountBankName: payload.new.virtual_account_bank_name || state.user?.virtualAccountBankName,
                      virtualAccountReference: payload.new.virtual_account_reference || state.user?.virtualAccountReference,
                      bvn: payload.new.bvn !== undefined ? payload.new.bvn : state.user?.bvn,
                    } : null,
                  }));
                }
              }
            )
            .subscribe((status) => {
              console.log('Real-time subscription status:', status);
            });
          
          // Store the subscription for later cleanup
          set({ realtimeSubscription: subscription });
          
          console.log('Real-time subscription initialized for user:', state.user.id);
          
        } catch (error) {
          console.error('Error setting up realtime subscription:', error);
        }
      },
      
      // Function to clean up realtime subscription
      cleanupRealtimeSubscription: () => {
        const { realtimeSubscription } = get();
        
        if (realtimeSubscription) {
          supabase.removeChannel(realtimeSubscription);
          set({ realtimeSubscription: null });
        }
      },

      // Function to verify a referral code
      verifyReferralCode: async (code: string) => {
        try {
          // Check if code is empty
          if (!code.trim()) {
            return false;
          }
          
          // Format the code properly before checking
          const formattedCode = code.trim();
          
          // Check if the referral code exists in the database
          const { data, error } = await supabase
            .from('profiles')
            .select('id, name')
            .eq('referral_code', formattedCode)
            .maybeSingle();
          
          if (error) {
            console.error('Error verifying referral code:', error);
            return false;
          }
          
          return !!data; // Return true if data exists, false otherwise
        } catch (error) {
          console.error('Error verifying referral code:', error);
          return false;
        }
      },

      // Transaction PIN functions
      setTransactionPin: async (pin: string, currentPin?: string) => {
        const state = get();
        if (!state.user) throw new Error('User not authenticated');

        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          if (!supabaseUrl) {
            throw new Error('Supabase URL not configured');
          }

          // Get the current session for authentication
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            throw new Error('User not authenticated');
          }

          const response = await fetch(`${supabaseUrl}/functions/v1/handle-pin`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              action: 'set_pin',
              userId: state.user.id,
              pin,
              currentPin,
            }),
          });

          const result = await response.json();
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to set transaction PIN');
          }

          // Update user state with PIN status
          set((state) => ({
            user: state.user ? {
              ...state.user,
              hasPin: true,
            } : null,
          }));
        } catch (error) {
          console.error('Error setting transaction PIN:', error);
          throw error;
        }
      },

      verifyTransactionPin: async (pin: string) => {
        const state = get();
        if (!state.user) throw new Error('User not authenticated');

        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          if (!supabaseUrl) {
            throw new Error('Supabase URL not configured');
          }

          // Get the current session for authentication
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            throw new Error('User not authenticated');
          }

          const response = await fetch(`${supabaseUrl}/functions/v1/handle-pin`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              action: 'verify_pin',
              userId: state.user.id,
              pin,
            }),
          });

          const result = await response.json();
          return result.success;
        } catch (error) {
          console.error('Error verifying transaction PIN:', error);
          throw error;
        }
      },

      checkPinStatus: async () => {
        const state = get();
        if (!state.user) throw new Error('User not authenticated');

        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          if (!supabaseUrl) {
            throw new Error('Supabase URL not configured');
          }

          // Get the current session for authentication
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            throw new Error('User not authenticated');
          }

          const response = await fetch(`${supabaseUrl}/functions/v1/handle-pin`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              action: 'check_pin_status',
              userId: state.user.id,
            }),
          });

          const result = await response.json();
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to check PIN status');
          }

          // Update user state with PIN status
          set((state) => ({
            user: state.user ? {
              ...state.user,
              hasPin: result.hasPin,
            } : null,
          }));

          return {
            hasPin: result.hasPin,
            isLocked: result.isLocked,
            lockedUntil: result.lockedUntil,
          };
        } catch (error) {
          console.error('Error checking PIN status:', error);
          throw error;
        }
      },

      resetTransactionPin: async () => {
        const state = get();
        if (!state.user) throw new Error('User not authenticated');

        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          if (!supabaseUrl) {
            throw new Error('Supabase URL not configured');
          }

          // Get the current session for authentication
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            throw new Error('User not authenticated');
          }

          const response = await fetch(`${supabaseUrl}/functions/v1/handle-pin`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              action: 'reset_pin',
              userId: state.user.id,
            }),
          });

          const result = await response.json();
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to reset transaction PIN');
          }

          // Update user state with PIN status
          set((state) => ({
            user: state.user ? {
              ...state.user,
              hasPin: false,
            } : null,
          }));
        } catch (error) {
          console.error('Error resetting transaction PIN:', error);
          throw error;
        }
      },

      // New function for admin to reset a user's PIN
      resetTransactionPinForAdmin: async (userId: string) => {
        const state = get();
        if (!state.user || !state.user.isAdmin) {
          throw new Error('Admin privileges required');
        }

        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          if (!supabaseUrl) {
            throw new Error('Supabase URL not configured');
          }

          // Get the current session for authentication
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            throw new Error('User not authenticated');
          }

          const response = await fetch(`${supabaseUrl}/functions/v1/handle-pin`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              action: 'reset_pin',
              userId: userId,
              adminId: state.user.id, // Include admin ID for logging
            }),
          });

          const result = await response.json();
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to reset user transaction PIN');
          }

          // Log the admin action
          await supabase.from('admin_logs').insert([{
            admin_id: state.user.id,
            action: 'reset_user_pin',
            details: { 
              target_user_id: userId,
              timestamp: new Date().toISOString()
            },
          }]);

          return { success: true };
        } catch (error) {
          console.error('Error resetting user transaction PIN:', error);
          throw error;
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
);