-- Create referral_rewards table
CREATE TABLE IF NOT EXISTS referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  reward_type text NOT NULL,
  reward_details jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS referral_rewards_user_id_idx ON referral_rewards(user_id);
CREATE INDEX IF NOT EXISTS referral_rewards_reward_type_idx ON referral_rewards(reward_type);
CREATE INDEX IF NOT EXISTS referral_rewards_status_idx ON referral_rewards(status);
CREATE INDEX IF NOT EXISTS referral_rewards_created_at_idx ON referral_rewards(created_at);

-- Enable Row Level Security
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read their own rewards" 
  ON referral_rewards
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all rewards" 
  ON referral_rewards
  FOR ALL
  TO authenticated
  USING (is_admin_user());