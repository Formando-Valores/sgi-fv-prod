-- ============================================================
-- Fase 1b de segurança (Plano de Fecho V1) — S-03, parte 2
--
-- Falhas de escalada de privilégios e de fuga entre organizações
-- encontradas ao auditar funções SECURITY DEFINER, vistas e policies
-- que dependem de profiles.role / is_default_org_admin.
--
-- V-09 (CRÍTICA) profiles.role é editável pelo próprio utilizador
--      ("Users can update their own profile", sem restrição de colunas).
--      can_manage_entity() e org_stripe_config_superadmin_manage confiavam
--      nesse campo: qualquer utilizador registado punha role='admin' no
--      próprio perfil e passava a LER E ALTERAR a configuração Stripe
--      (chaves cifradas e webhook secret) de TODAS as organizações.
-- V-10 (CRÍTICA) is_default_org_admin() aceitava também qualquer org cujo
--      NOME contenha 'padr'. Como qualquer utilizador autenticado pode criar
--      organizações, criar uma chamada "Padrão" dava privilégios de admin global.
-- V-11 (ALTA)    v_user_context é uma vista de `postgres` (ignora RLS) legível
--      por anon: expõe e-mail, nome, papel e organização de todos os utilizadores.
-- V-12 (CRÍTICA) organizations: policies de UPDATE e DELETE verificavam "é
--      admin/owner de ALGUMA org". Admin da org A alterava e APAGAVA a org B;
--      o DELETE apaga em cascata processos, membros e pagamentos.
-- V-13 (MÉDIA)   process_events e process_document_attachments legíveis por
--      qualquer membro da org, incluindo clientes (ver eventos e anexos de
--      processos de OUTROS clientes).
-- V-14 (MÉDIA)   delete_user_completely chama is_org_admin(uuid), que a
--      migration 047 substituiu por is_org_admin(text): a função falha sempre
--      para quem não é admin global. Latente: se corrigida com um cast simples,
--      utilizadores sem organização escapam à verificação de permissão.
-- ============================================================

-- ------------------------------------------------------------
-- V-10 is_default_org_admin: só a organização com slug 'default'
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_default_org_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
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

-- ------------------------------------------------------------
-- V-09 profiles: o utilizador não altera o próprio role/org_id
-- Chamadas da API (authenticated/anon) só mudam role/org_id se forem
-- admin global ou admin da organização em causa. service_role e
-- migrations (current_user diferente) passam sem restrição.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.profiles_block_privilege_self_edit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF lower(coalesce(NEW.role, '')) NOT IN ('', 'cliente', 'client')
       AND NOT (
         public.is_default_org_admin(auth.uid())
         OR (NEW.org_id IS NOT NULL AND public.is_org_admin(NEW.org_id::text))
       )
    THEN
      RAISE EXCEPTION 'Sem permissão para definir este papel no perfil'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     AND NOT (
       public.is_default_org_admin(auth.uid())
       OR (OLD.org_id IS NOT NULL AND public.is_org_admin(OLD.org_id::text))
     )
  THEN
    RAISE EXCEPTION 'Sem permissão para alterar o papel do perfil'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.org_id IS DISTINCT FROM OLD.org_id
     AND NOT (
       public.is_default_org_admin(auth.uid())
       OR (NEW.org_id IS NOT NULL AND public.is_org_admin(NEW.org_id::text))
     )
  THEN
    RAISE EXCEPTION 'Sem permissão para alterar a organização do perfil'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_block_privilege_self_edit ON public.profiles;
CREATE TRIGGER trg_profiles_block_privilege_self_edit
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_block_privilege_self_edit();

-- ------------------------------------------------------------
-- V-09 can_manage_entity: "admin global" exige ser admin da org default,
-- não apenas ter profiles.role = 'admin'.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_manage_entity(target_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  -- Admin global: profiles.role sozinho não chega (é auto-editável);
  -- exige também ser admin/owner da organização default.
  IF normalized_profile_role IN ('admin', 'administrator', 'administrador', 'owner')
     AND public.is_default_org_admin(auth.uid()) THEN
    RETURN true;
  END IF;

  -- Sênior: gerir apenas na própria organização.
  IF normalized_profile_role IN ('senior', 'usuario senior', 'usuário sênior') THEN
    RETURN membership_role IN ('owner', 'admin');
  END IF;

  -- Pleno: gerir apenas na organização/área em que atua.
  IF normalized_profile_role IN ('pleno', 'usuario pleno', 'usuário pleno', 'staff') THEN
    RETURN membership_role = 'staff';
  END IF;

  RETURN false;
END;
$$;

-- ------------------------------------------------------------
-- V-09 org_stripe_config: superadmin passa a ser admin da org default
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "org_stripe_config_superadmin_manage" ON public.org_stripe_config;
CREATE POLICY "org_stripe_config_superadmin_manage"
  ON public.org_stripe_config FOR ALL
  TO authenticated
  USING (public.is_default_org_admin(auth.uid()))
  WITH CHECK (public.is_default_org_admin(auth.uid()));

-- ------------------------------------------------------------
-- V-11 v_user_context: respeita o RLS de quem consulta; sem acesso anónimo
-- ------------------------------------------------------------
ALTER VIEW public.v_user_context SET (security_invoker = true);
REVOKE ALL ON public.v_user_context FROM anon;

-- ------------------------------------------------------------
-- V-12 organizations: UPDATE/DELETE só na PRÓPRIA organização
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Org admins can update organizations" ON public.organizations;
CREATE POLICY "Org admins can update organizations"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (public.is_org_admin(id::text) OR public.is_default_org_admin(auth.uid()))
  WITH CHECK (public.is_org_admin(id::text) OR public.is_default_org_admin(auth.uid()));

DROP POLICY IF EXISTS "Org admins can delete organizations" ON public.organizations;
CREATE POLICY "Org owners can delete organizations"
  ON public.organizations FOR DELETE
  TO authenticated
  USING (
    public.is_default_org_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = organizations.id
        AND om.user_id = auth.uid()
        AND om.role = 'owner'
    )
  );

-- ------------------------------------------------------------
-- V-13 process_events / process_document_attachments
-- Clientes só veem o que pertence aos seus próprios processos
-- (a policy de clientes de process_events já existia, mas era
-- anulada por "Members can view org process events").
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Members can view org process events" ON public.process_events;

DROP POLICY IF EXISTS "Org members can view process document attachments"
  ON public.process_document_attachments;
CREATE POLICY "Org team can view process document attachments"
  ON public.process_document_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = process_document_attachments.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'staff')
    )
    OR public.is_default_org_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.processes p
      WHERE p.id = process_document_attachments.process_id
        AND (p.cliente_user_id = auth.uid() OR p.responsavel_user_id = auth.uid())
    )
  );

-- ------------------------------------------------------------
-- V-14 delete_user_completely: corrige o tipo e fecha o bypass
-- Sem organização resolvida, só admin global pode apagar.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_user_completely(target_user_id uuid)
RETURNS TABLE(deleted_profiles integer, deleted_memberships integer, deleted_auth integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
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

  caller_is_global_admin := public.is_default_org_admin(caller_id);

  IF NOT caller_is_global_admin
     AND (target_org_id IS NULL OR NOT public.is_org_admin(target_org_id::text)) THEN
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

REVOKE ALL ON FUNCTION public.delete_user_completely(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_user_completely(uuid) TO authenticated;
