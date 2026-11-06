-- MISSÃO 003: impedir que RPC is_default_org_admin permita enumerar administradores globais.
-- Sessões autenticadas só podem consultar o próprio user_id; service_role mantém
-- a capacidade server-side de verificar um utilizador-alvo.
CREATE OR REPLACE FUNCTION public.is_default_org_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_role text := COALESCE(auth.jwt() ->> 'role', '');
BEGIN
  IF caller_id IS NOT NULL THEN
    IF check_user_id IS DISTINCT FROM caller_id THEN
      RETURN false;
    END IF;
  ELSIF caller_role <> 'service_role' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.org_members om
    JOIN public.organizations o ON o.id = om.org_id
    WHERE om.user_id = check_user_id
      AND om.role IN ('owner', 'admin')
      AND o.slug = 'default'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_default_org_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_default_org_admin(uuid) TO authenticated, service_role;
