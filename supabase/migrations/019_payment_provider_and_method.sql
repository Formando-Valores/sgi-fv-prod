-- ============================================
-- SGI FV - Migration 019: Payment provider and method traceability
-- ============================================
-- Data: 2026-04-21
-- Descrição: Adiciona provedor de pagamento explícito e reforça método na tabela payments
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'payment_provider_enum'
  ) THEN
    CREATE TYPE payment_provider_enum AS ENUM (
      'stripe'
    );
  END IF;
END
$$;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_provider payment_provider_enum,
  ALTER COLUMN payment_method TYPE payment_method_enum USING payment_method::payment_method_enum;

UPDATE public.payments
SET payment_provider = 'stripe'
WHERE payment_provider IS NULL;

ALTER TABLE public.payments
  ALTER COLUMN payment_provider SET NOT NULL,
  ALTER COLUMN payment_provider SET DEFAULT 'stripe';

COMMENT ON COLUMN public.payments.payment_provider IS 'Provedor responsável pela transação (inicialmente Stripe).';
COMMENT ON COLUMN public.payments.payment_method IS 'Método utilizado dentro do provedor (ex.: stripe_checkout, pix, card).';

CREATE INDEX IF NOT EXISTS idx_payments_provider_method ON public.payments(payment_provider, payment_method);
