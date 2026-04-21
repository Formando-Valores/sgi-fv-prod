-- ============================================
-- SGI FV - Migration 017: Payments traceability
-- ============================================
-- Data: 2026-04-21
-- Descrição: Estrutura de rastreabilidade completa de pagamentos
-- ============================================

-- ============================================
-- 1) ENUMS
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'payment_status_enum'
  ) THEN
    CREATE TYPE payment_status_enum AS ENUM (
      'pending',
      'paid',
      'failed',
      'refunded',
      'canceled',
      'released'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'process_status_enum'
  ) THEN
    CREATE TYPE process_status_enum AS ENUM (
      'cadastro',
      'triagem',
      'analise',
      'concluido',
      'aguardando_pagamento',
      'pago',
      'liberado'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'payment_method_enum'
  ) THEN
    CREATE TYPE payment_method_enum AS ENUM (
      'stripe_checkout',
      'pix',
      'boleto',
      'card',
      'transfer',
      'other'
    );
  END IF;
END
$$;

-- ============================================
-- 2) NOVAS COLUNAS EM processes
-- ============================================
ALTER TABLE processes
  ADD COLUMN IF NOT EXISTS payment_status payment_status_enum NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS process_status process_status_enum,
  ADD COLUMN IF NOT EXISTS amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- Migração do status antigo para o novo campo enum compatível
UPDATE processes
SET process_status = CASE
  WHEN status = 'cadastro' THEN 'cadastro'::process_status_enum
  WHEN status = 'triagem' THEN 'triagem'::process_status_enum
  WHEN status = 'analise' THEN 'analise'::process_status_enum
  WHEN status = 'concluido' THEN 'concluido'::process_status_enum
  ELSE 'cadastro'::process_status_enum
END
WHERE process_status IS NULL;

ALTER TABLE processes
  ALTER COLUMN process_status SET NOT NULL,
  ALTER COLUMN process_status SET DEFAULT 'cadastro';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'processes_currency_code_chk'
  ) THEN
    ALTER TABLE processes
      ADD CONSTRAINT processes_currency_code_chk
      CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$');
  END IF;
END
$$;

COMMENT ON COLUMN processes.payment_status IS 'Status do pagamento do processo (pendente, pago, falha, estorno, cancelado, liberado)';
COMMENT ON COLUMN processes.process_status IS 'Novo status de processo em enum compatível com legado + fluxo de pagamento';
COMMENT ON COLUMN processes.amount IS 'Valor do processo/cobrança';
COMMENT ON COLUMN processes.currency IS 'Moeda ISO-4217 (ex.: BRL, USD)';
COMMENT ON COLUMN processes.stripe_checkout_session_id IS 'ID da sessão de checkout do Stripe vinculada ao processo';
COMMENT ON COLUMN processes.stripe_payment_intent_id IS 'ID do payment_intent do Stripe vinculado ao processo';
COMMENT ON COLUMN processes.paid_at IS 'Timestamp de confirmação de pagamento do processo';

-- ============================================
-- 3) TABELA payments
-- ============================================
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status payment_status_enum NOT NULL DEFAULT 'pending',
  payment_method payment_method_enum,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  raw_webhook_event_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

COMMENT ON TABLE public.payments IS 'Rastreabilidade completa de pagamentos por processo/cliente';

-- ============================================
-- 4) ÍNDICES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_payments_process_id ON payments(process_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_checkout_session_id ON payments(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id ON payments(stripe_payment_intent_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_raw_webhook_event_id
  ON payments(raw_webhook_event_id)
  WHERE raw_webhook_event_id IS NOT NULL;

-- ============================================
-- 5) RLS EM payments
-- ============================================
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients can view own payments" ON payments;
CREATE POLICY "Clients can view own payments"
  ON payments FOR SELECT
  USING (
    client_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM processes p
      JOIN org_members om ON om.org_id = p.org_id
      WHERE p.id = payments.process_id
        AND om.user_id = auth.uid()
        AND om.role = 'client'
    )
  );

DROP POLICY IF EXISTS "Org admins can view paid or released payments" ON payments;
CREATE POLICY "Org admins can view paid or released payments"
  ON payments FOR SELECT
  USING (
    status IN ('paid', 'released')
    AND EXISTS (
      SELECT 1
      FROM processes p
      JOIN org_members om ON om.org_id = p.org_id
      WHERE p.id = payments.process_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Org admins can insert payments" ON payments;
CREATE POLICY "Org admins can insert payments"
  ON payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM processes p
      JOIN org_members om ON om.org_id = p.org_id
      WHERE p.id = payments.process_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Org admins can update payments" ON payments;
CREATE POLICY "Org admins can update payments"
  ON payments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM processes p
      JOIN org_members om ON om.org_id = p.org_id
      WHERE p.id = payments.process_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM processes p
      JOIN org_members om ON om.org_id = p.org_id
      WHERE p.id = payments.process_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );
