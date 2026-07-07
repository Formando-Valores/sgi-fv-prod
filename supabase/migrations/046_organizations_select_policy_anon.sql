-- ============================================
-- SGI FV - Migration 046: SELECT público de organizações
-- ============================================
-- Objetivo: permitir que usuários não autenticados (página de registro)
-- visualizem a lista de organizações disponíveis para seleção.

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view organizations" ON organizations;
CREATE POLICY "Anyone can view organizations"
  ON organizations FOR SELECT
  USING (true);

GRANT SELECT ON organizations TO anon;
