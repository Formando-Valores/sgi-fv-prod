-- ============================================================
-- Fase 1b de segurança (Plano de Fecho V1) — S-03
--
-- Falhas de isolamento multi-tenant encontradas ao executar
-- scripts/audit-rls-crosstenant.mjs contra um projeto de teste com
-- duas organizações e dados em ambas.
--
-- F-1 (CRÍTICA) org_members: "Allow self insert on registration" tinha
--     CHECK (user_id = auth.uid()) sem restringir org nem role. Qualquer
--     utilizador autenticado podia inserir-se como 'owner' de QUALQUER
--     organização e, a partir daí, ler e alterar tudo dela.
-- F-2 payment_proofs: staff_select_all_proofs / staff_update_proofs
--     verificavam "é owner/admin/staff de ALGUMA organização", sem ligar
--     o comprovativo à organização. Staff da org A lia e validava
--     comprovativos da org B.
-- F-3 professional_payment_accounts: staff_manage_accounts (ALL) com o
--     mesmo defeito. Staff de qualquer org lia e ALTERAVA os IBAN de
--     profissionais de outras organizações.
-- F-4 financial_audit_events: "Org admins can view" idem — admin de
--     qualquer org lia o log financeiro de todas.
-- ============================================================

-- ------------------------------------------------------------
-- Helpers (SECURITY DEFINER para não recursar no RLS de org_members)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.org_has_members(check_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_members WHERE org_id = check_org_id);
$$;

-- O utilizador autenticado tem um dos papéis dados numa organização
-- de que o utilizador alvo também é membro.
CREATE OR REPLACE FUNCTION public.has_role_in_org_of_user(target_user uuid, allowed_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_members me
    JOIN public.org_members t ON t.org_id = me.org_id
    WHERE me.user_id = auth.uid()
      AND me.role = ANY (allowed_roles)
      AND t.user_id = target_user
  );
$$;

-- O utilizador autenticado tem um dos papéis dados na organização
-- dona do processo.
CREATE OR REPLACE FUNCTION public.has_role_in_process_org(target_process uuid, allowed_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.processes p
    JOIN public.org_members me ON me.org_id = p.org_id
    WHERE p.id = target_process
      AND me.user_id = auth.uid()
      AND me.role = ANY (allowed_roles)
  );
$$;

REVOKE ALL ON FUNCTION public.org_has_members(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role_in_org_of_user(uuid, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role_in_process_org(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_has_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role_in_org_of_user(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role_in_process_org(uuid, text[]) TO authenticated;

-- ------------------------------------------------------------
-- F-1 org_members
-- Mantém os dois usos legítimos do cliente:
--   - Login/Register: auto-vínculo como 'client'
--   - criação de organização nova: o criador entra como 'owner', apenas
--     enquanto a organização ainda não tem nenhum membro
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Allow self insert on registration" ON public.org_members;
CREATE POLICY "Allow self insert on registration"
  ON public.org_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      role = 'client'
      OR (role = 'owner' AND NOT public.org_has_members(org_id))
    )
  );

-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- F-2 payment_proofs
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "staff_select_all_proofs" ON public.payment_proofs;
CREATE POLICY "staff_select_all_proofs"
  ON public.payment_proofs FOR SELECT
  TO authenticated
  USING (
    public.has_role_in_process_org(process_id, ARRAY['owner', 'admin', 'staff'])
    OR EXISTS (
      SELECT 1 FROM public.processes
      WHERE processes.id = payment_proofs.process_id
        AND processes.responsavel_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "staff_update_proofs" ON public.payment_proofs;
CREATE POLICY "staff_update_proofs"
  ON public.payment_proofs FOR UPDATE
  TO authenticated
  USING (
    public.has_role_in_process_org(process_id, ARRAY['owner', 'admin', 'staff'])
  )
  WITH CHECK (
    status IN ('validated', 'rejected')
    AND validated_by = auth.uid()
  );

-- ------------------------------------------------------------
-- F-3 professional_payment_accounts
-- Staff só gere contas de profissionais da sua própria organização.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "staff_manage_accounts" ON public.professional_payment_accounts;
CREATE POLICY "staff_manage_accounts"
  ON public.professional_payment_accounts FOR ALL
  TO authenticated
  USING (
    public.has_role_in_org_of_user(user_id, ARRAY['owner', 'admin', 'staff'])
  )
  WITH CHECK (
    public.has_role_in_org_of_user(user_id, ARRAY['owner', 'admin', 'staff'])
  );

-- ------------------------------------------------------------
-- F-4 financial_audit_events
-- A tabela não tem org_id: a organização do evento é a do autor.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Org admins can view financial audit events" ON public.financial_audit_events;
CREATE POLICY "Org admins can view financial audit events"
  ON public.financial_audit_events FOR SELECT
  USING (
    public.has_role_in_org_of_user(actor_user_id, ARRAY['owner', 'admin'])
  );
