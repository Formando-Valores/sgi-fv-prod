-- Fase 1: Habilitar RLS nas tabelas financeiras sem protecao
-- Vulnerabilidade critica: org_financial_settings e org_complementary_tiers sem RLS

-- 1. Habilitar RLS em org_financial_settings
ALTER TABLE public.org_financial_settings ENABLE ROW LEVEL SECURITY;

-- Policy: membros da org veem suas configuracoes financeiras
CREATE POLICY "org_members_view_financial_settings"
  ON public.org_financial_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.user_id = auth.uid()
        AND om.org_id = org_financial_settings.org_id
        AND om.role IN ('owner', 'admin')
    )
  );

-- Policy: owner/admin da org pode atualizar configuracoes financeiras
CREATE POLICY "org_admins_manage_financial_settings"
  ON public.org_financial_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.user_id = auth.uid()
        AND om.org_id = org_financial_settings.org_id
        AND om.role IN ('owner', 'admin')
    )
  );

-- 2. Habilitar RLS em org_complementary_tiers
ALTER TABLE public.org_complementary_tiers ENABLE ROW LEVEL SECURITY;

-- Policy: membros da org veem seus tiers complementares
CREATE POLICY "org_members_view_complementary_tiers"
  ON public.org_complementary_tiers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.user_id = auth.uid()
        AND om.org_id = org_complementary_tiers.org_id
        AND om.role IN ('owner', 'admin')
    )
  );

-- Policy: owner/admin da org pode gerenciar tiers complementares
CREATE POLICY "org_admins_manage_complementary_tiers"
  ON public.org_complementary_tiers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.user_id = auth.uid()
        AND om.org_id = org_complementary_tiers.org_id
        AND om.role IN ('owner', 'admin')
    )
  );

-- 3. Habilitar RLS em financial_audit_notifications
ALTER TABLE public.financial_audit_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: membros da org veem suas notificacoes de auditoria
CREATE POLICY "org_members_view_audit_notifications"
  ON public.financial_audit_notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.user_id = auth.uid()
        AND om.org_id = financial_audit_notifications.org_id
        AND om.role IN ('owner', 'admin')
    )
  );

-- Policy: sistema pode inserir notificacoes de auditoria (via service_role)
CREATE POLICY "service_role_insert_audit_notifications"
  ON public.financial_audit_notifications FOR INSERT
  WITH CHECK (true);
