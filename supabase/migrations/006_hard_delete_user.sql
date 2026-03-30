-- ============================================
-- SGI FV - Migration 006: Hard delete de usuário
-- ============================================
-- Permite exclusão definitiva de usuário em profiles, org_members e auth.users
-- via RPC security definer para admins.

-- 1) Policy de DELETE em profiles para admins da organização
DROP POLICY IF EXISTS "Org admins can delete org profiles" ON profiles;
CREATE POLICY "Org admins can delete org profiles"
  ON profiles FOR DELETE
  USING (is_org_admin(org_id));

-- 2) Função RPC para exclusão completa
CREATE OR REPLACE FUNCTION public.delete_user_completely(target_user_id uuid)
RETURNS TABLE(
  deleted_profiles integer,
  deleted_memberships integer,
  deleted_auth integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_id uuid;
  target_org_id uuid;
  target_email text;
  caller_is_global_admin boolean;
BEGIN
  caller_id := auth.uid();

  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT p.org_id, p.email
  INTO target_org_id, target_email
  FROM profiles p
  WHERE p.id = target_user_id
  LIMIT 1;

  IF target_org_id IS NULL THEN
    SELECT om.org_id
    INTO target_org_id
    FROM org_members om
    WHERE om.user_id = target_user_id
    LIMIT 1;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM org_members om
    JOIN organizations o ON o.id = om.org_id
    WHERE om.user_id = caller_id
      AND om.role IN ('admin', 'owner')
      AND o.slug = 'default'
  )
  INTO caller_is_global_admin;

  IF NOT caller_is_global_admin AND target_org_id IS NOT NULL AND NOT is_org_admin(target_org_id) THEN
    RAISE EXCEPTION 'Sem permissão para excluir este usuário';
  END IF;

  DELETE FROM org_members
  WHERE user_id = target_user_id;
  GET DIAGNOSTICS deleted_memberships = ROW_COUNT;

  IF target_email IS NULL THEN
    SELECT p.email INTO target_email FROM profiles p WHERE p.id = target_user_id LIMIT 1;
  END IF;

  DELETE FROM profiles
  WHERE id = target_user_id
     OR (target_email IS NOT NULL AND email = target_email);
  GET DIAGNOSTICS deleted_profiles = ROW_COUNT;

  DELETE FROM auth.users
  WHERE id = target_user_id;
  GET DIAGNOSTICS deleted_auth = ROW_COUNT;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_completely(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_completely(uuid) TO authenticated;
