-- ============================================
-- SGI FV - Migration 022: Dual protection hardening (UI + Backend/RLS)
-- ============================================
-- Data: 2026-04-25
-- Descrição:
--   - Reforça escopo por organização e por perfil (cliente x administrativo)
--   - Impede leitura/escrita fora do tenant
--   - Evita exposição de dados administrativos para clientes
-- ============================================

-- ---------- helpers ----------
CREATE OR REPLACE FUNCTION public.is_default_org_admin(check_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.org_members om
    JOIN public.organizations o ON o.id = om.org_id
    WHERE om.user_id = check_user_id
      AND om.role IN ('owner', 'admin')
      AND (o.slug = 'default' OR lower(o.name) LIKE '%padr%')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.is_default_org_admin(uuid) TO authenticated;

-- ---------- organizations ----------
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view organizations" ON public.organizations;
DROP POLICY IF EXISTS "Members can view their organization" ON public.organizations;

CREATE POLICY "Scoped users can view organizations"
  ON public.organizations FOR SELECT
  USING (
    public.is_org_member(id)
    OR public.is_default_org_admin(auth.uid())
  );

-- ---------- profiles ----------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view profiles in their org" ON public.profiles;
CREATE POLICY "Scoped users can view profiles in org"
  ON public.profiles FOR SELECT
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.org_members om
      WHERE om.org_id = profiles.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'staff')
    )
    OR public.is_default_org_admin(auth.uid())
  );

-- ---------- org_members ----------
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org admins can update members" ON public.org_members;
CREATE POLICY "Org admins can update members"
  ON public.org_members FOR UPDATE
  USING (
    public.is_org_admin(org_id)
    OR public.is_default_org_admin(auth.uid())
  )
  WITH CHECK (
    public.is_org_admin(org_id)
    OR public.is_default_org_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Org admins can delete members" ON public.org_members;
CREATE POLICY "Org admins can delete members"
  ON public.org_members FOR DELETE
  USING (
    (public.is_org_admin(org_id) OR public.is_default_org_admin(auth.uid()))
    AND role <> 'owner'
  );

-- ---------- processes ----------
ALTER TABLE public.processes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org team can view org processes" ON public.processes;
CREATE POLICY "Org team can view org processes"
  ON public.processes FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.org_members om
      WHERE om.org_id = processes.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'staff')
    )
    OR public.is_default_org_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Clients can view their own processes" ON public.processes;
CREATE POLICY "Clients can view their own processes"
  ON public.processes FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.org_members om
      WHERE om.org_id = processes.org_id
        AND om.user_id = auth.uid()
        AND om.role = 'client'
    )
    AND (
      processes.cliente_user_id = auth.uid()
      OR processes.responsavel_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can insert processes" ON public.processes;
CREATE POLICY "Admins can insert processes"
  ON public.processes FOR INSERT
  WITH CHECK (
    public.is_org_admin(org_id)
    OR public.is_default_org_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can update processes" ON public.processes;
CREATE POLICY "Admins can update processes"
  ON public.processes FOR UPDATE
  USING (
    public.is_org_admin(org_id)
    OR public.is_default_org_admin(auth.uid())
  )
  WITH CHECK (
    public.is_org_admin(org_id)
    OR public.is_default_org_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can delete processes" ON public.processes;
CREATE POLICY "Admins can delete processes"
  ON public.processes FOR DELETE
  USING (
    public.is_org_admin(org_id)
    OR public.is_default_org_admin(auth.uid())
  );

-- ---------- process_events ----------
ALTER TABLE public.process_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org team can view org process events" ON public.process_events;
CREATE POLICY "Org team can view org process events"
  ON public.process_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.org_members om
      WHERE om.org_id = process_events.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'staff')
    )
    OR public.is_default_org_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can insert process events" ON public.process_events;
CREATE POLICY "Admins can insert process events"
  ON public.process_events FOR INSERT
  WITH CHECK (
    public.is_org_admin(org_id)
    OR public.is_default_org_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can update process events" ON public.process_events;
CREATE POLICY "Admins can update process events"
  ON public.process_events FOR UPDATE
  USING (
    public.is_org_admin(org_id)
    OR public.is_default_org_admin(auth.uid())
  )
  WITH CHECK (
    public.is_org_admin(org_id)
    OR public.is_default_org_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Clients can view events for own processes" ON public.process_events;
CREATE POLICY "Clients can view events for own processes"
  ON public.process_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.org_members om
      WHERE om.org_id = process_events.org_id
        AND om.user_id = auth.uid()
        AND om.role = 'client'
    )
    AND EXISTS (
      SELECT 1
      FROM public.processes p
      WHERE p.id = process_events.process_id
        AND (
          p.cliente_user_id = auth.uid()
          OR p.responsavel_user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Clients can insert events on own processes" ON public.process_events;
CREATE POLICY "Clients can insert events on own processes"
  ON public.process_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.org_members om
      WHERE om.org_id = process_events.org_id
        AND om.user_id = auth.uid()
        AND om.role = 'client'
    )
    AND EXISTS (
      SELECT 1
      FROM public.processes p
      WHERE p.id = process_events.process_id
        AND (
          p.cliente_user_id = auth.uid()
          OR p.responsavel_user_id = auth.uid()
        )
    )
  );

-- ---------- payments ----------
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
        AND (
          p.cliente_user_id = auth.uid()
          OR p.responsavel_user_id = auth.uid()
        )
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
