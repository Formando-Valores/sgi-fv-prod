-- ============================================
-- SGI FV - Migration 008: Fallback de INSERT em organizations
-- ============================================
-- Motivo: o app pode reconhecer admin por regra de frontend (ADMIN_CREDENTIALS),
-- mas o banco exige política RLS baseada em dados SQL.
--
-- Esta policy garante criação de organização por qualquer usuário autenticado,
-- evitando bloqueio operacional em ambientes já em produção.

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can insert organizations" ON organizations;
CREATE POLICY "Authenticated users can insert organizations"
  ON organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

GRANT INSERT ON organizations TO authenticated;
