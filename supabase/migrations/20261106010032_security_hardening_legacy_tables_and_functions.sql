-- MISSÃO 003: hardening das tabelas legadas sem consumidores ativos e funções SECURITY DEFINER.
-- As oito tabelas tinham zero linhas, zero triggers e não apresentavam referências no código
-- da aplicação. Permanecem reservadas, mas deixam de ser acessíveis pelo Data API público.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'payment_events',
    'client_associations',
    'service_orders',
    'service_order_checklist',
    'service_catalog',
    'service_checklist_items',
    'service_order_attachments',
    'technical_history'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- Fixar search_path nas funções sinalizadas pelo Security Advisor.
ALTER FUNCTION public.is_org_member_v2(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.is_org_admin_v2(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_user_org_id() SET search_path = public, pg_temp;
ALTER FUNCTION public.is_global_admin() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_protocol() SET search_path = public, pg_temp;
ALTER FUNCTION public.calculate_complementary_contribution(uuid, numeric) SET search_path = public, pg_temp;
ALTER FUNCTION public.has_pending_annual_membership(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.processes_enforce_financial_rules() SET search_path = public, pg_temp;
ALTER FUNCTION public.audit_payment_change() SET search_path = public, pg_temp;

-- Funções SECURITY DEFINER: retirar execução anónima herdada de PUBLIC.
-- Mantém-se authenticated onde a aplicação/policies dependem dessas funções.
REVOKE ALL ON FUNCTION public.can_manage_entity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_entity(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_user_org_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_org_id() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_global_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_global_admin() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_default_org_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_default_org_admin(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_org_admin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_admin(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_org_member(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(text) TO authenticated, service_role;

-- Função trigger de criação de utilizador: não é uma RPC pública.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated, service_role;
