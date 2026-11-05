-- ============================================================
-- Migration 066: sino de novidades do painel (novos utilizadores e pagamentos)
-- ============================================================
-- Eventos calculados a partir das tabelas existentes (sem duplicar dados):
--   * new_member   → public.org_members.created_at (novo membro/cliente na organização)
--   * payment_paid → public.processes com payment_status = 'paid' (paid_at), valor do
--                    último registo pago em public.payments (ou processes.amount/os_value)
-- Guarda, por utilizador e organização, a data em que viu as novidades pela última vez.
--
-- Acesso: papéis owner, admin, senior, pleno (e staff, equivalente a pleno no front)
-- da organização, e o administrador global (is_default_org_admin).
-- Todas as funções com search_path fixo.
--
-- ROLLBACK (executar manualmente para reverter):
--   DROP FUNCTION IF EXISTS public.mark_org_activity_seen(uuid);
--   DROP FUNCTION IF EXISTS public.get_org_activity(uuid, integer);
--   DROP FUNCTION IF EXISTS public.org_activity_events(uuid, timestamptz, timestamptz);
--   DROP TABLE IF EXISTS public.org_activity_seen;
--   DROP FUNCTION IF EXISTS public.can_view_org_activity(uuid);
--   DROP INDEX IF EXISTS public.idx_org_members_org_created;
--   DROP INDEX IF EXISTS public.idx_processes_org_paid_at;
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_org_members_org_created ON public.org_members(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_processes_org_paid_at ON public.processes(org_id, paid_at DESC) WHERE payment_status = 'paid';

-- ------------------------------------------------------------
-- "Último visto" por utilizador/organização
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_activity_seen (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, org_id)
);

COMMENT ON TABLE public.org_activity_seen IS 'Sino do painel: data em que cada utilizador viu as novidades da organização pela última vez.';

-- ------------------------------------------------------------
-- Quem pode ver o sino da organização
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_org_activity(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL
    AND p_org_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.org_members om
        WHERE om.org_id = p_org_id
          AND om.user_id = auth.uid()
          AND om.role IN ('owner', 'admin', 'senior', 'pleno', 'staff')
      )
      OR public.is_default_org_admin(auth.uid())
    );
$$;

REVOKE ALL ON FUNCTION public.can_view_org_activity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_org_activity(uuid) TO authenticated, service_role;

ALTER TABLE public.org_activity_seen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_activity_seen_select_own ON public.org_activity_seen;
CREATE POLICY org_activity_seen_select_own ON public.org_activity_seen
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.can_view_org_activity(org_id));

DROP POLICY IF EXISTS org_activity_seen_insert_own ON public.org_activity_seen;
CREATE POLICY org_activity_seen_insert_own ON public.org_activity_seen
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_view_org_activity(org_id));

DROP POLICY IF EXISTS org_activity_seen_update_own ON public.org_activity_seen;
CREATE POLICY org_activity_seen_update_own ON public.org_activity_seen
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.can_view_org_activity(org_id))
  WITH CHECK (user_id = auth.uid() AND public.can_view_org_activity(org_id));

REVOKE ALL ON public.org_activity_seen FROM anon;
REVOKE DELETE ON public.org_activity_seen FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.org_activity_seen TO authenticated;
GRANT ALL ON public.org_activity_seen TO service_role;

-- ------------------------------------------------------------
-- Eventos de uma organização num intervalo (uso interno: sino e relatório semanal)
-- Não é exposta a authenticated: o acesso passa por get_org_activity (com verificação
-- de papel) ou pela service role (Edge Function weekly-org-report).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.org_activity_events(
  p_org_id uuid,
  p_since timestamptz,
  p_until timestamptz DEFAULT now()
)
RETURNS TABLE (
  event_id text,
  event_type text,
  occurred_at timestamptz,
  title text,
  person_name text,
  person_email text,
  member_role text,
  process_id uuid,
  protocolo text,
  amount numeric,
  currency text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    'member:' || om.org_id::text || ':' || om.user_id::text AS event_id,
    'new_member'::text AS event_type,
    om.created_at AS occurred_at,
    'Novo utilizador'::text AS title,
    COALESCE(NULLIF(pr.nome_completo, ''), pr.email, 'Utilizador') AS person_name,
    pr.email AS person_email,
    om.role AS member_role,
    NULL::uuid AS process_id,
    NULL::text AS protocolo,
    NULL::numeric AS amount,
    NULL::text AS currency
  FROM public.org_members om
  LEFT JOIN public.profiles pr ON pr.id = om.user_id
  WHERE om.org_id = p_org_id
    AND om.created_at >= p_since
    AND om.created_at < p_until

  UNION ALL

  SELECT
    'payment:' || p.id::text AS event_id,
    'payment_paid'::text AS event_type,
    p.paid_at AS occurred_at,
    'Novo pagamento'::text AS title,
    COALESCE(NULLIF(p.cliente_nome, ''), cp.nome_completo, cp.email, 'Cliente') AS person_name,
    cp.email AS person_email,
    NULL::text AS member_role,
    p.id AS process_id,
    p.protocolo,
    COALESCE(pay.amount, p.amount, p.os_value) AS amount,
    UPPER(COALESCE(pay.currency, p.currency, 'EUR')) AS currency
  FROM public.processes p
  LEFT JOIN public.profiles cp ON cp.id = p.cliente_user_id
  LEFT JOIN LATERAL (
    SELECT py.amount, py.currency
    FROM public.payments py
    WHERE py.process_id = p.id AND py.status = 'paid'
    ORDER BY py.paid_at DESC NULLS LAST
    LIMIT 1
  ) pay ON true
  WHERE p.org_id = p_org_id
    AND p.payment_status = 'paid'
    AND p.paid_at IS NOT NULL
    AND p.paid_at >= p_since
    AND p.paid_at < p_until;
$$;

REVOKE ALL ON FUNCTION public.org_activity_events(uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.org_activity_events(uuid, timestamptz, timestamptz) TO service_role;

-- ------------------------------------------------------------
-- Sino: últimos eventos (30 dias) + indicação de "não visto"
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_org_activity(p_org_id uuid, p_limit integer DEFAULT 30)
RETURNS TABLE (
  event_id text,
  event_type text,
  occurred_at timestamptz,
  title text,
  person_name text,
  person_email text,
  member_role text,
  process_id uuid,
  protocolo text,
  amount numeric,
  currency text,
  is_unseen boolean,
  last_seen_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_last_seen timestamptz;
BEGIN
  IF NOT public.can_view_org_activity(p_org_id) THEN
    RAISE EXCEPTION 'Sem permissão para ver as novidades desta organização.' USING ERRCODE = '42501';
  END IF;

  SELECT s.last_seen_at INTO v_last_seen
  FROM public.org_activity_seen s
  WHERE s.user_id = auth.uid() AND s.org_id = p_org_id;

  RETURN QUERY
  SELECT e.event_id, e.event_type, e.occurred_at, e.title, e.person_name, e.person_email,
         e.member_role, e.process_id, e.protocolo, e.amount, e.currency,
         (v_last_seen IS NULL OR e.occurred_at > v_last_seen) AS is_unseen,
         v_last_seen AS last_seen_at
  FROM public.org_activity_events(p_org_id, now() - interval '30 days', now() + interval '1 minute') e
  ORDER BY e.occurred_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 30), 1), 100);
END;
$$;

REVOKE ALL ON FUNCTION public.get_org_activity(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_org_activity(uuid, integer) TO authenticated, service_role;

-- ------------------------------------------------------------
-- Sino: "Marcar como visto"
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_org_activity_seen(p_org_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  IF NOT public.can_view_org_activity(p_org_id) THEN
    RAISE EXCEPTION 'Sem permissão para esta organização.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.org_activity_seen (user_id, org_id, last_seen_at, updated_at)
  VALUES (auth.uid(), p_org_id, v_now, v_now)
  ON CONFLICT (user_id, org_id)
  DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at, updated_at = EXCLUDED.updated_at;

  RETURN v_now;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_org_activity_seen(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_org_activity_seen(uuid) TO authenticated;
