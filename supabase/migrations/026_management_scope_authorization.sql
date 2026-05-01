-- ============================================
-- SGI FV - Migration 026: Management scope authorization
-- ============================================
-- Data: 2026-05-01
-- Descrição:
--   - Separa visualização global (view_all) de gestão (manage) por entidade
--   - Reforça autorização de gestão no backend (RLS)
--   - Bloqueia gestão fora do escopo por perfil
-- ============================================

CREATE OR REPLACE FUNCTION public.current_user_hierarchy()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(lower(trim(hierarchy)), ''), 'cliente')
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.current_user_hierarchy() TO authenticated;

CREATE OR REPLACE FUNCTION public.can_manage_entity(target_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_hierarchy text;
BEGIN
  user_hierarchy := public.current_user_hierarchy();

  IF user_hierarchy = 'admin' THEN
    RETURN true;
  END IF;

  IF user_hierarchy = 'senior' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = target_org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    );
  END IF;

  IF user_hierarchy = 'pleno' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = target_org_id
        AND om.user_id = auth.uid()
        AND om.role = 'staff'
    );
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_entity(uuid) TO authenticated;

DROP POLICY IF EXISTS "Admins can update processes" ON public.processes;
CREATE POLICY "Scoped roles can manage processes"
  ON public.processes FOR UPDATE
  USING (public.can_manage_entity(org_id))
  WITH CHECK (public.can_manage_entity(org_id));

DROP POLICY IF EXISTS "Admins can delete processes" ON public.processes;
CREATE POLICY "Scoped roles can delete processes"
  ON public.processes FOR DELETE
  USING (public.can_manage_entity(org_id));

DROP POLICY IF EXISTS "Admins can insert process events" ON public.process_events;
CREATE POLICY "Scoped roles can insert process events"
  ON public.process_events FOR INSERT
  WITH CHECK (public.can_manage_entity(org_id));

DROP POLICY IF EXISTS "Admins can update process events" ON public.process_events;
CREATE POLICY "Scoped roles can update process events"
  ON public.process_events FOR UPDATE
  USING (public.can_manage_entity(org_id))
  WITH CHECK (public.can_manage_entity(org_id));
