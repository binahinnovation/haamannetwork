export type User = {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  walletBalance: number;
  isAdmin: boolean;
  referralCode: string;
  referredBy?: string;
  totalReferrals: number;
  referralEarnings: number;
  createdAt: string;
  virtualAccountBankName?: string;
  virtualAccountNumber?: string;
  virtualAccountReference?: string;
  opayAccountNumber?: string;
  opayAccountName?: string;
  palmpayAccountNumber?: string;
  palmpayAccountName?: string;
  paymentpointCustomerId?: string;
  bvn?: string;
  hasPin?: boolean;
};

export type Transaction = {
  id: string;
  userId: string;
  type: 'airtime' | 'data' | 'electricity' | 'waec' | 'wallet_funding' | 'product_purchase' | 'referral_bonus' | 'referral_reward' | 'shop_setup_fee' | 'shop_subscription';
  amount: number;
  status: 'success' | 'pending' | 'failed';
  reference: string;
  details: {
    [key: string]: any;
  };
  createdAt: string;
  flutterwaveTxRef?: string;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  original_price?: number;
  image_url: string;
  category: string;
  in_stock: boolean;
  rating: number;
  reviews: number;
  discount: number;
  is_new: boolean;
  is_featured: boolean;
  created_at: string;
  // Vendor marketplace fields
  shop_id?: string | null;
  is_vendor_product: boolean;
  // Joined fields from queries
  shop_name?: string;
  shop_is_verified?: boolean;
};

export type Order = {
  id: string;
  user_id: string;
  products: Array<{
    product_id: string;
    name: string;
    price: number;
    quantity: number;
    image_url: string;
  }>;
  total_amount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  payment_method: 'wallet' | 'pay_on_delivery';
  shipping_address: {
    name: string;
    address: string;
    city: string;
    state: string;
    phone: string;
  };
  estimated_delivery_date: string;
  tracking_number: string;
  created_at: string;
  updated_at: string;
};

export type DataPlan = {
  id: string;
  network: 'mtn' | 'airtel' | 'glo' | '9mobile';
  name: string;
  description: string;
  amount: number;
  validity: string;
  discount_percentage?: number;
  show_discount_badge?: boolean;
};

export type WaecCard = {
  id: string;
  pin: string;
  serialNumber: string;
  expiresAt: string;
  isUsed: boolean;
  userId?: string;
  transactionId?: string;
};

export type DiscoProvider = 'ikeja' | 'eko' | 'ibadan' | 'enugu' | 'portharcourt' | 'abuja' | 'kaduna' | 'kano' | 'jos';

export type MeterType = 'prepaid' | 'postpaid';

export type ReferralData = {
  id: string;
  referrerId: string;
  referredUserId: string;
  referralCode: string;
  bonusAmount: number;
  status: 'pending' | 'paid';
  createdAt: string;
};

export type VirtualAccount = {
  bankName: string;
  accountNumber: string;
  reference: string;
};

export type ReferralReward = {
  id: string;
  user_id: string;
  reward_type: 'data_bundle' | 'airtime' | 'wallet_credit';
  reward_details: {
    data_size?: string;
    network?: string;
    amount?: number;
  };
  status: 'pending' | 'claimed' | 'processed';
  created_at: string;
};

export type SupportTicket = {
  id: string;
  user_id: string;
  subject: string;
  category: 'transaction' | 'order' | 'referral' | 'general' | 'technical';
  status: 'open' | 'pending_user_reply' | 'pending_admin_reply' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  updated_at: string;
  last_message_at: string;
  assigned_to?: string;
  profiles?: {
    name: string;
    email: string;
    phone?: string;
  };
};

export type TicketMessage = {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  is_admin_reply: boolean;
  created_at: string;
  sender_name?: string;
  profiles?: {
    name: string;
  };
};


// Re-export vendor types
export * from './vendor';
