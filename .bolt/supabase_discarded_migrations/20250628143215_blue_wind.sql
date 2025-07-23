-- Create support_tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject text NOT NULL,
  category text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'medium',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_message_at timestamptz DEFAULT now(),
  assigned_to uuid REFERENCES profiles(id),
  
  -- Add constraints for allowed values
  CONSTRAINT support_tickets_category_check CHECK (
    category IN ('transaction', 'order', 'referral', 'general', 'technical')
  ),
  CONSTRAINT support_tickets_status_check CHECK (
    status IN ('open', 'pending_user_reply', 'pending_admin_reply', 'closed')
  ),
  CONSTRAINT support_tickets_priority_check CHECK (
    priority IN ('low', 'medium', 'high', 'critical')
  )
);

-- Create ticket_messages table
CREATE TABLE IF NOT EXISTS ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id),
  message text NOT NULL,
  is_admin_reply boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create trigger to update last_message_at and updated_at when a new message is added
CREATE OR REPLACE FUNCTION update_ticket_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE support_tickets
  SET last_message_at = NEW.created_at,
      updated_at = NEW.created_at,
      status = CASE 
                WHEN NEW.is_admin_reply THEN 'pending_user_reply'
                ELSE 'pending_admin_reply'
              END
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ticket_on_new_message
AFTER INSERT ON ticket_messages
FOR EACH ROW
EXECUTE FUNCTION update_ticket_timestamps();

-- Create trigger to update updated_at on support_tickets
CREATE OR REPLACE FUNCTION update_support_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON support_tickets
FOR EACH ROW
EXECUTE FUNCTION update_support_tickets_updated_at();

-- Enable Row Level Security
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for support_tickets
-- Users can view their own tickets
CREATE POLICY "Users can view their own tickets"
  ON support_tickets
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can create tickets
CREATE POLICY "Users can create tickets"
  ON support_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own tickets (e.g., to close them)
CREATE POLICY "Users can update their own tickets"
  ON support_tickets
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all tickets
CREATE POLICY "Admins can view all tickets"
  ON support_tickets
  FOR SELECT
  TO authenticated
  USING (is_admin_user());

-- Admins can update all tickets
CREATE POLICY "Admins can update all tickets"
  ON support_tickets
  FOR UPDATE
  TO authenticated
  USING (is_admin_user());

-- Create policies for ticket_messages
-- Users can view messages for their own tickets
CREATE POLICY "Users can view messages for their own tickets"
  ON ticket_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = ticket_id
      AND support_tickets.user_id = auth.uid()
    )
  );

-- Users can add messages to their own tickets
CREATE POLICY "Users can add messages to their own tickets"
  ON ticket_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = ticket_id
      AND support_tickets.user_id = auth.uid()
    ) AND
    sender_id = auth.uid() AND
    is_admin_reply = false
  );

-- Admins can view all messages
CREATE POLICY "Admins can view all messages"
  ON ticket_messages
  FOR SELECT
  TO authenticated
  USING (is_admin_user());

-- Admins can add messages to any ticket
CREATE POLICY "Admins can add messages to any ticket"
  ON ticket_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin_user() AND
    sender_id = auth.uid()
  );

-- Create index for better performance
CREATE INDEX IF NOT EXISTS support_tickets_user_id_idx ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON support_tickets(status);
CREATE INDEX IF NOT EXISTS support_tickets_category_idx ON support_tickets(category);
CREATE INDEX IF NOT EXISTS support_tickets_priority_idx ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS support_tickets_last_message_at_idx ON support_tickets(last_message_at);
CREATE INDEX IF NOT EXISTS ticket_messages_ticket_id_idx ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS ticket_messages_sender_id_idx ON ticket_messages(sender_id);
CREATE INDEX IF NOT EXISTS ticket_messages_created_at_idx ON ticket_messages(created_at);