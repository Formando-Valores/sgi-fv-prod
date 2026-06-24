-- ============================================
-- SGI FV - Migration 030: Stripe Customer ID
-- ============================================
-- Adiciona coluna stripe_customer_id na tabela payments
-- para vincular clientes SGI a clientes Stripe,
-- necessario para o funcionamento do Customer Portal.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

CREATE INDEX IF NOT EXISTS idx_payments_stripe_customer_id
  ON public.payments(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
