-- Professional Payment Accounts table
-- Stores IBAN/bank details for professionals who receive service payments directly
CREATE TABLE IF NOT EXISTS professional_payment_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  document TEXT,
  iban TEXT NOT NULL,
  bank_name TEXT,
  service_unit TEXT NOT NULL CHECK (service_unit IN ('ADMINISTRATIVO', 'JURÍDICO / ADVOCACIA', 'TECNOLÓGICO / AI')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  stripe_connect_account_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE professional_payment_accounts ENABLE ROW LEVEL SECURITY;

-- Admins/staff can manage all accounts
CREATE POLICY "staff_manage_accounts"
  ON professional_payment_accounts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.user_id = auth.uid()
      AND org_members.role IN ('owner', 'admin', 'staff')
    )
  );

-- Professionals can view their own account
CREATE POLICY "professional_view_own"
  ON professional_payment_accounts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
