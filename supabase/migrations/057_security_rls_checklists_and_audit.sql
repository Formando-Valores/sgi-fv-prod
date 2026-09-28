-- ============================================================
-- Fase 1 de segurança (Plano de Fecho V1) — S-03
-- Corrige duas falhas de isolamento multi-tenant detetadas na
-- auditoria de RLS de 21/09/2026.
--
-- Ver docs/plano-fecho-v1.md e docs/auditoria-seguranca-fase1.md
-- ============================================================

-- ------------------------------------------------------------
-- FALHA 1 — service_order_document_checklists sem RLS
--
-- A tabela foi criada na migration 027 com coluna org_id, mas
-- nunca teve RLS ativado nem policies, ao contrário da tabela
-- irmã process_document_attachments criada no mesmo ficheiro.
--
-- É lida diretamente do browser em
-- src/lib/processes.ts:1121 (listRequiredChecklistDocuments),
-- filtrada apenas por .eq('org_id', org_id) na aplicação — o que
-- qualquer utilizador autenticado contorna chamando o PostgREST
-- com outro org_id.
--
-- As policies abaixo replicam exatamente o modelo já usado em
-- process_document_attachments (migration 027, linhas 43-86).
-- ------------------------------------------------------------

ALTER TABLE public.service_order_document_checklists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view service order checklists"
  ON public.service_order_document_checklists;
CREATE POLICY "Org members can view service order checklists"
  ON public.service_order_document_checklists FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.user_id = auth.uid()
        AND om.org_id = service_order_document_checklists.org_id
    )
  );

DROP POLICY IF EXISTS "Org admins can insert service order checklists"
  ON public.service_order_document_checklists;
CREATE POLICY "Org admins can insert service order checklists"
  ON public.service_order_document_checklists FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.user_id = auth.uid()
        AND om.org_id = service_order_document_checklists.org_id
        AND om.role IN ('owner','admin')
    )
  );

DROP POLICY IF EXISTS "Org admins can update service order checklists"
  ON public.service_order_document_checklists;
CREATE POLICY "Org admins can update service order checklists"
  ON public.service_order_document_checklists FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.user_id = auth.uid()
        AND om.org_id = service_order_document_checklists.org_id
        AND om.role IN ('owner','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.user_id = auth.uid()
        AND om.org_id = service_order_document_checklists.org_id
        AND om.role IN ('owner','admin')
    )
  );

DROP POLICY IF EXISTS "Org admins can delete service order checklists"
  ON public.service_order_document_checklists;
CREATE POLICY "Org admins can delete service order checklists"
  ON public.service_order_document_checklists FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.user_id = auth.uid()
        AND om.org_id = service_order_document_checklists.org_id
        AND om.role IN ('owner','admin')
    )
  );

COMMENT ON TABLE public.service_order_document_checklists IS
  'Checklist de documentos exigidos por serviço. RLS por org_id desde a migration 057.';


-- ------------------------------------------------------------
-- FALHA 2 — policy de INSERT sem restrição de role
--
-- A migration 056 criou:
--
--   CREATE POLICY "service_role_insert_audit_notifications"
--     ON public.financial_audit_notifications FOR INSERT
--     WITH CHECK (true);
--
-- O nome indica a intenção de a restringir ao service_role, mas a
-- policy não tem cláusula TO, pelo que se aplica a PUBLIC — ou
-- seja, qualquer utilizador autenticado pode inserir notificações
-- de auditoria financeira arbitrárias, para qualquer org_id.
--
-- Além disso a policy é desnecessária: o service_role ignora RLS
-- por definição. Removê-la fecha a falha sem afetar as Edge
-- Functions, que usam service_role.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "service_role_insert_audit_notifications"
  ON public.financial_audit_notifications;

-- Os inserts continuam a funcionar via service_role nas Edge
-- Functions. Se no futuro for preciso permitir insert a partir do
-- browser, criar uma policy explícita com TO authenticated e um
-- WITH CHECK que valide org_id contra org_members.
