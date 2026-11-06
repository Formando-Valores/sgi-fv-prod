-- MISSÃO 003: impedir que um administrador de uma organização elimine contas
-- que também pertencem a outras organizações ou que tenham papel privilegiado.
CREATE OR REPLACE FUNCTION public.delete_user_completely(target_user_id uuid)
RETURNS TABLE(deleted_profiles integer, deleted_memberships integer, deleted_auth integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  caller_id uuid := auth.uid();
  profile_org_id uuid;
  target_org_id uuid;
  caller_is_global_admin boolean := false;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE = '42501';
  END IF;

  IF target_user_id IS NULL OR target_user_id = caller_id THEN
    RAISE EXCEPTION 'Não é permitido excluir a própria conta ou um identificador vazio' USING ERRCODE = '42501';
  END IF;

  SELECT p.org_id INTO profile_org_id
  FROM public.profiles p
  WHERE p.id = target_user_id
  LIMIT 1;

  caller_is_global_admin := public.is_default_org_admin(caller_id);

  IF NOT caller_is_global_admin THEN
    -- A organização de destino tem de ser uma organização comum ao alvo e ao
    -- administrador que executa a operação; não confiar apenas em profiles.org_id.
    SELECT target_member.org_id
      INTO target_org_id
    FROM public.org_members target_member
    JOIN public.org_members caller_member
      ON caller_member.org_id = target_member.org_id
    WHERE target_member.user_id = target_user_id
      AND caller_member.user_id = caller_id
      AND caller_member.role IN ('owner', 'admin')
    ORDER BY (target_member.org_id = profile_org_id) DESC, target_member.created_at ASC
    LIMIT 1;

    -- Compatibilidade com perfis antigos sem linha em org_members.
    IF target_org_id IS NULL
       AND profile_org_id IS NOT NULL
       AND public.is_org_admin(profile_org_id::text) THEN
      target_org_id := profile_org_id;
    END IF;

    IF target_org_id IS NULL OR NOT public.is_org_admin(target_org_id::text) THEN
      RAISE EXCEPTION 'Sem permissão para excluir este usuário' USING ERRCODE = '42501';
    END IF;

    -- Um administrador local não pode remover uma conta que tenha vínculos
    -- noutras organizações, pois a operação apaga a conta globalmente.
    IF EXISTS (
      SELECT 1
      FROM public.org_members om
      WHERE om.user_id = target_user_id
        AND om.org_id <> target_org_id
    ) THEN
      RAISE EXCEPTION 'Este utilizador pertence a outras organizações; a exclusão global exige administrador global'
        USING ERRCODE = '42501';
    END IF;

    -- Só o administrador global pode apagar owners/admins.
    IF EXISTS (
      SELECT 1
      FROM public.org_members om
      WHERE om.user_id = target_user_id
        AND om.role IN ('owner', 'admin')
    ) THEN
      RAISE EXCEPTION 'A exclusão de utilizadores com papel privilegiado exige administrador global'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  DELETE FROM public.org_members
  WHERE user_id = target_user_id;
  GET DIAGNOSTICS deleted_memberships = ROW_COUNT;

  DELETE FROM public.profiles
  WHERE id = target_user_id;
  GET DIAGNOSTICS deleted_profiles = ROW_COUNT;

  DELETE FROM auth.users
  WHERE id = target_user_id;
  GET DIAGNOSTICS deleted_auth = ROW_COUNT;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_completely(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_user_completely(uuid) TO authenticated, service_role;
