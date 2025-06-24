import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  walletBalance: number;
  isAdmin: boolean;
  referralCode: string;
  referredBy?: string;
  totalReferrals: number;
  referralEarnings: number;
  createdAt: string;
};

type AuthState = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, phone?: string, referralCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<AuthUser>) => Promise<void>;
  updateWalletBalance: (newBalance: number) => Promise<void>;
  checkAuth: () => Promise<void>;
  refreshUserData: () => Promise<void>;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

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
              // Create profile if it doesn't exist
              const newProfile = {
                id: data.user.id,
                name: data.user.user_metadata?.name || 'User',
                email: data.user.email!,
                phone: data.user.user_metadata?.phone || '',
                wallet_balance: 0,
                is_admin: false,
                referral_code: `haaman-${data.user.user_metadata?.name?.replace(/\s+/g, '').toUpperCase() || 'USER'}${data.user.id.slice(-3)}`,
                referred_by: null,
                total_referrals: 0,
                referral_earnings: 0,
                created_at: new Date().toISOString(),
              };

              await supabase.from('profiles').insert([newProfile]);
              
              set({
                user: {
                  id: newProfile.id,
                  name: newProfile.name,
                  email: newProfile.email,
                  phone: newProfile.phone,
                  walletBalance: newProfile.wallet_balance,
                  isAdmin: newProfile.is_admin,
                  referralCode: newProfile.referral_code,
                  referredBy: newProfile.referred_by,
                  totalReferrals: newProfile.total_referrals,
                  referralEarnings: newProfile.referral_earnings,
                  createdAt: newProfile.created_at,
                },
                isAuthenticated: true,
                isLoading: false,
              });
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
                },
                isAuthenticated: true,
                isLoading: false,
              });
            }
          }
        } catch (error: any) {
          set({ isLoading: false });
          throw new Error(error.message || 'Login failed');
        }
      },

      signup: async (email: string, password: string, name: string, phone?: string, referralCode?: string) => {
        set({ isLoading: true });
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                name,
                phone,
                referralCode,
              },
            },
          });

          if (error) throw error;

          if (data.user) {
            // Generate unique referral code
            const userReferralCode = `haaman-${name.replace(/\s+/g, '').toUpperCase()}${data.user.id.slice(-3)}`;
            
            // Check if referral code exists and is valid
            let referrerProfile = null;
            if (referralCode) {
              const { data: referrer } = await supabase
                .from('profiles')
                .select('*')
                .eq('referral_code', referralCode)
                .single();
              
              referrerProfile = referrer;
            }

            // Create user profile
            const profile = {
              id: data.user.id,
              name,
              email,
              phone: phone || '',
              wallet_balance: 0,
              is_admin: false,
              referral_code: userReferralCode,
              referred_by: referrerProfile?.id || null,
              total_referrals: 0,
              referral_earnings: 0,
              created_at: new Date().toISOString(),
            };

            const { error: profileError } = await supabase
              .from('profiles')
              .insert([profile]);

            if (profileError) throw profileError;

            // Update referrer's total referrals count
            if (referrerProfile) {
              await supabase
                .from('profiles')
                .update({ 
                  total_referrals: (referrerProfile.total_referrals || 0) + 1 
                })
                .eq('id', referrerProfile.id);
            }

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
              },
              isAuthenticated: true,
              isLoading: false,
            });
          }
        } catch (error: any) {
          set({ isLoading: false });
          throw new Error(error.message || 'Signup failed');
        }
      },

      logout: async () => {
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

      updateWalletBalance: async (newBalance) => {
        const state = get();
        if (!state.user) return;

        try {
          // Update in database
          const { error } = await supabase
            .from('profiles')
            .update({ wallet_balance: newBalance })
            .eq('id', state.user.id);

          if (error) throw error;

          // Update local state
          set((state) => ({
            user: state.user ? { ...state.user, walletBalance: newBalance } : null,
          }));
        } catch (error) {
          console.error('Error updating wallet balance:', error);
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

          if (error) throw error;

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
            const userReferralCode = `haaman-${session.user.user_metadata?.name?.replace(/\s+/g, '').toUpperCase() || 'USER'}${session.user.id.slice(-3)}`;
            
            const newProfile = {
              id: session.user.id,
              name: session.user.user_metadata?.name || 'User',
              email: session.user.email!,
              phone: session.user.user_metadata?.phone || '',
              wallet_balance: 0,
              is_admin: false,
              referral_code: userReferralCode,
              referred_by: null,
              total_referrals: 0,
              referral_earnings: 0,
              created_at: new Date().toISOString(),
            };

            const { error: insertError } = await supabase
              .from('profiles')
              .insert([newProfile]);

            if (!insertError) {
              set({
                user: {
                  id: newProfile.id,
                  name: newProfile.name,
                  email: newProfile.email,
                  phone: newProfile.phone,
                  walletBalance: newProfile.wallet_balance,
                  isAdmin: newProfile.is_admin,
                  referralCode: newProfile.referral_code,
                  referredBy: newProfile.referred_by,
                  totalReferrals: newProfile.total_referrals,
                  referralEarnings: newProfile.referral_earnings,
                  createdAt: newProfile.created_at,
                },
                isAuthenticated: true,
              });
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
              },
              isAuthenticated: true,
            });
          }
        } else {
          set({ user: null, isAuthenticated: false });
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