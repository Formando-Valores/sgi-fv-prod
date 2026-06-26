-- Add new payment_status values for validation flow
-- Existing: pending, paid, failed, refunded, canceled, released
-- New: processing, pending_validation, validated, accepted, rejected

-- Create payment_proofs table for manual payment receipt upload
CREATE TABLE IF NOT EXISTS payment_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  amount DECIMAL(12,2),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending_validation'
    CHECK (status IN ('pending_validation', 'validated', 'rejected')),
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE payment_proofs ENABLE ROW LEVEL SECURITY;

-- Clients can insert their own proofs
CREATE POLICY "clients_insert_own_proofs"
  ON payment_proofs FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending_validation'
  );

-- Clients can see their own proofs
CREATE POLICY "clients_select_own_proofs"
  ON payment_proofs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins/staff can see all proofs (via org_members)
CREATE POLICY "staff_select_all_proofs"
  ON payment_proofs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.user_id = auth.uid()
      AND org_members.role IN ('owner', 'admin', 'staff')
    )
    OR
    EXISTS (
      SELECT 1 FROM processes
      WHERE processes.id = payment_proofs.process_id
      AND processes.responsavel_user_id = auth.uid()
    )
  );

-- Admins/staff can update proof status (validate/reject)
CREATE POLICY "staff_update_proofs"
  ON payment_proofs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.user_id = auth.uid()
      AND org_members.role IN ('owner', 'admin', 'staff')
    )
  )
  WITH CHECK (
    status IN ('validated', 'rejected')
    AND validated_by = auth.uid()
  );

-- Create storage bucket for payment proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment_proofs', 'payment_proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to payment_proofs bucket
CREATE POLICY "authenticated_upload_payment_proofs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'payment_proofs');

-- Allow users to read their own files
CREATE POLICY "users_read_own_proofs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment_proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow staff to read all proof files
CREATE POLICY "staff_read_all_proofs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment_proofs'
    AND EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.user_id = auth.uid()
      AND org_members.role IN ('owner', 'admin', 'staff')
    )
  );
