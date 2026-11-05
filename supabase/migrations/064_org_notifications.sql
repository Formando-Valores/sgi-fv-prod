-- Migration 064 (MISSÃO 002): notificações/alertas por organização
-- Usada pelo stripe-webhook para avisar o painel quando um pagamento entra
-- (payment_received) ou quando o valor pago diverge do esperado (payment_amount_mismatch).

CREATE TABLE IF NOT EXISTS public.org_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'success', 'warning', 'critical')),
  title text NOT NULL,
  body text,
  process_id uuid REFERENCES public.processes(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  read_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_notifications_org_created ON public.org_notifications(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_notifications_unread ON public.org_notifications(org_id) WHERE read_at IS NULL;

ALTER TABLE public.org_notifications ENABLE ROW LEVEL SECURITY;

-- Leitura: administradores da organização e o administrador global
DROP POLICY IF EXISTS org_notifications_select_admin ON public.org_notifications;
CREATE POLICY org_notifications_select_admin ON public.org_notifications
  FOR SELECT TO authenticated
  USING (public.is_org_admin(org_id::text) OR public.is_default_org_admin(auth.uid()));

-- Marcar como lida: mesmos utilizadores (só colunas read_at/read_by via GRANT abaixo)
DROP POLICY IF EXISTS org_notifications_update_admin ON public.org_notifications;
CREATE POLICY org_notifications_update_admin ON public.org_notifications
  FOR UPDATE TO authenticated
  USING (public.is_org_admin(org_id::text) OR public.is_default_org_admin(auth.uid()))
  WITH CHECK (public.is_org_admin(org_id::text) OR public.is_default_org_admin(auth.uid()));

-- INSERT/DELETE apenas pela service role (Edge Functions); sem política para authenticated.
REVOKE ALL ON public.org_notifications FROM anon;
REVOKE INSERT, DELETE, UPDATE ON public.org_notifications FROM authenticated;
GRANT SELECT ON public.org_notifications TO authenticated;
GRANT UPDATE (read_at, read_by) ON public.org_notifications TO authenticated;
GRANT ALL ON public.org_notifications TO service_role;

COMMENT ON TABLE public.org_notifications IS 'Alertas do sistema por organização (ex.: pagamento recebido). Inserção apenas via service role.';
