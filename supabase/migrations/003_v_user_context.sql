-- ============================================
-- SGI FV - Migration 003: v_user_context View
-- ============================================
-- Data: 2026-02-22
-- Descrição: View para contexto do usuário autenticado
-- ============================================

-- Criar view v_user_context para consulta fácil do contexto do usuário
CREATE OR REPLACE VIEW public.v_user_context AS
SELECT 
  p.id as user_id,
  p.email,
  p.nome_completo,
  p.org_id,
  om.role as org_role,
  o.slug as org_slug,
  o.name as org_name
FROM profiles p
LEFT JOIN org_members om ON om.user_id = p.id AND om.org_id = p.org_id
LEFT JOIN organizations o ON o.id = p.org_id;

-- Grant access to authenticated users
GRANT SELECT ON public.v_user_context TO authenticated;

COMMENT ON VIEW public.v_user_context IS 'Contexto completo do usuário para uso no frontend';
