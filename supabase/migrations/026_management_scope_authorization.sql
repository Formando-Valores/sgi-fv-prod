-- ============================================
-- SGI FV - Migration 026: Management scope authorization
-- ============================================
-- Data: 2026-05-01
-- Descrição:
--   - Separa visualização global (view_all) de gestão (manage) por entidade
--   - Reforça autorização de gestão no backend (RLS)
--   - Bloqueia gestão fora do escopo por perfil
-- ============================================

CREATE OR REPLACE FUNCTION public.can_manage_entity(target_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_profile_role text;
  membership_role text;
BEGIN
  SELECT COALESCE(NULLIF(lower(trim(p.role)), ''), 'cliente')
    INTO normalized_profile_role
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;

  SELECT COALESCE(NULLIF(lower(trim(om.role)), ''), 'client')
    INTO membership_role
  FROM public.org_members om
  WHERE om.org_id = target_org_id
    AND om.user_id = auth.uid()
  LIMIT 1;

  -- Admin global: pode gerir qualquer organização.
  IF normalized_profile_role IN ('admin', 'administrator', 'administrador', 'owner') THEN
    RETURN true;
  END IF;

  -- Sênior: pode visualizar global (fora desta função), mas gerir apenas na própria organização.
  IF normalized_profile_role IN ('senior', 'usuario senior', 'usuário sênior') THEN
    RETURN membership_role IN ('owner', 'admin');
  END IF;

  -- Pleno: gerir apenas na organização/área em que atua.
  IF normalized_profile_role IN ('pleno', 'usuario pleno', 'usuário pleno', 'staff') THEN
    RETURN membership_role = 'staff';
  END IF;

  -- Cliente (e demais perfis): sem gestão administrativa por esta função.
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_entity(uuid) TO authenticated;

DROP POLICY IF EXISTS "Admins can update processes" ON public.processes;
DROP POLICY IF EXISTS "Scoped roles can manage processes" ON public.processes;
CREATE POLICY "Scoped roles can manage processes"
  ON public.processes FOR UPDATE
  USING (public.can_manage_entity(org_id))
  WITH CHECK (public.can_manage_entity(org_id));

DROP POLICY IF EXISTS "Admins can delete processes" ON public.processes;
DROP POLICY IF EXISTS "Scoped roles can delete processes" ON public.processes;
CREATE POLICY "Scoped roles can delete processes"
  ON public.processes FOR DELETE
  USING (public.can_manage_entity(org_id));

DROP POLICY IF EXISTS "Admins can insert process events" ON public.process_events;
DROP POLICY IF EXISTS "Scoped roles can insert process events" ON public.process_events;
CREATE POLICY "Scoped roles can insert process events"
  ON public.process_events FOR INSERT
  WITH CHECK (public.can_manage_entity(org_id));

DROP POLICY IF EXISTS "Admins can update process events" ON public.process_events;
DROP POLICY IF EXISTS "Scoped roles can update process events" ON public.process_events;
CREATE POLICY "Scoped roles can update process events"
  ON public.process_events FOR UPDATE
  USING (public.can_manage_entity(org_id))
  WITH CHECK (public.can_manage_entity(org_id));
