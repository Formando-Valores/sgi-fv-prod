-- ============================================
-- SGI FV - Migration 018: Payment audit events
-- ============================================
-- Data: 2026-04-21
-- Descrição: Campos de auditoria/correlação para pagamentos e eventos de processo
-- ============================================

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_event_type text,
  ADD COLUMN IF NOT EXISTS last_event_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payments_process_id_unique'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_process_id_unique UNIQUE (process_id);
  END IF;
END
$$;

ALTER TABLE public.process_events
  ADD COLUMN IF NOT EXISTS event_code text,
  ADD COLUMN IF NOT EXISTS correlation_process_id uuid,
  ADD COLUMN IF NOT EXISTS correlation_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS correlation_stripe_event_id text;

CREATE INDEX IF NOT EXISTS idx_process_events_event_code
  ON public.process_events(event_code);

CREATE INDEX IF NOT EXISTS idx_process_events_corr_process
  ON public.process_events(correlation_process_id);

CREATE INDEX IF NOT EXISTS idx_process_events_corr_checkout
  ON public.process_events(correlation_checkout_session_id);

CREATE INDEX IF NOT EXISTS idx_process_events_corr_stripe_event
  ON public.process_events(correlation_stripe_event_id);

COMMENT ON COLUMN public.payments.last_event_type IS 'Último tipo de evento Stripe aplicado no pagamento';
COMMENT ON COLUMN public.payments.last_event_at IS 'Timestamp do último evento Stripe aplicado';
COMMENT ON COLUMN public.process_events.event_code IS 'Código canônico de auditoria do evento funcional';
COMMENT ON COLUMN public.process_events.correlation_process_id IS 'Correlation id do processo';
COMMENT ON COLUMN public.process_events.correlation_checkout_session_id IS 'Correlation id da sessão de checkout Stripe';
COMMENT ON COLUMN public.process_events.correlation_stripe_event_id IS 'Correlation id do evento Stripe';
