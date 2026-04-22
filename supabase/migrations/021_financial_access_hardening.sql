-- ============================================
-- SGI FV - Migration 021: Financial access hardening
-- ============================================
-- Data: 2026-04-22
-- Descrição:
--   1) Reforça segregação cliente/admin na tabela payments com vínculo ao processo.
--   2) Mantém visão operacional admin apenas para processos pagos e liberados.
--   3) Registra trilha de auditoria para consultas financeiras sensíveis.
-- ============================================

-- ---------- payments (RLS reforçado) ----------
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients can view own payments" ON public.payments;
CREATE POLICY "Clients can view own payments"
  ON public.payments FOR SELECT
  USING (
    client_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.processes p
      JOIN public.org_members om ON om.org_id = p.org_id
      WHERE p.id = payments.process_id
        AND om.user_id = auth.uid()
        AND om.role = 'client'
        AND p.responsavel_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org admins can view paid or released payments" ON public.payments;
CREATE POLICY "Org admins can view paid or released payments"
  ON public.payments FOR SELECT
  USING (
    status IN ('paid', 'released')
    AND EXISTS (
      SELECT 1
      FROM public.processes p
      JOIN public.org_members om ON om.org_id = p.org_id
      WHERE p.id = payments.process_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'staff')
        AND p.payment_status = 'paid'
        AND p.process_status = 'liberado'
    )
  );

DROP POLICY IF EXISTS "Org admins can insert payments" ON public.payments;
CREATE POLICY "Org admins can insert payments"
  ON public.payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.processes p
      JOIN public.org_members om ON om.org_id = p.org_id
      WHERE p.id = payments.process_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'staff')
    )
    AND payments.client_id = (
      SELECT p.responsavel_user_id
      FROM public.processes p
      WHERE p.id = payments.process_id
    )
  );

DROP POLICY IF EXISTS "Org admins can update payments" ON public.payments;
CREATE POLICY "Org admins can update payments"
  ON public.payments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.processes p
      JOIN public.org_members om ON om.org_id = p.org_id
      WHERE p.id = payments.process_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.processes p
      JOIN public.org_members om ON om.org_id = p.org_id
      WHERE p.id = payments.process_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'staff')
    )
    AND payments.client_id = (
      SELECT p.responsavel_user_id
      FROM public.processes p
      WHERE p.id = payments.process_id
    )
  );

-- ---------- Auditoria financeira ----------
CREATE TABLE IF NOT EXISTS public.financial_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  event_code text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.financial_audit_events IS 'Auditoria de acessos/consultas sensíveis no módulo financeiro.';
COMMENT ON COLUMN public.financial_audit_events.actor_user_id IS 'Usuário autenticado que executou a consulta sensível.';
COMMENT ON COLUMN public.financial_audit_events.event_code IS 'Código canônico da ação auditada no financeiro.';

CREATE INDEX IF NOT EXISTS idx_financial_audit_events_actor_user_id
  ON public.financial_audit_events(actor_user_id);

CREATE INDEX IF NOT EXISTS idx_financial_audit_events_event_code
  ON public.financial_audit_events(event_code);

CREATE INDEX IF NOT EXISTS idx_financial_audit_events_created_at
  ON public.financial_audit_events(created_at DESC);

ALTER TABLE public.financial_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own financial audit events" ON public.financial_audit_events;
CREATE POLICY "Users can insert own financial audit events"
  ON public.financial_audit_events FOR INSERT
  WITH CHECK (actor_user_id = auth.uid());

DROP POLICY IF EXISTS "Org admins can view financial audit events" ON public.financial_audit_events;
CREATE POLICY "Org admins can view financial audit events"
  ON public.financial_audit_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.org_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Users can view own financial audit events" ON public.financial_audit_events;
CREATE POLICY "Users can view own financial audit events"
  ON public.financial_audit_events FOR SELECT
  USING (actor_user_id = auth.uid());
