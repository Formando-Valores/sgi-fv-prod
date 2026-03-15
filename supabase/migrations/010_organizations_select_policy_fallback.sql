-- ============================================
-- SGI FV - Migration 010: fallback de visualização de organizações
-- ============================================
-- Objetivo: evitar cenário em que a organização é criada, mas some da listagem
-- por falta de policy de SELECT para o usuário autenticado.

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view organizations" ON organizations;
CREATE POLICY "Authenticated users can view organizations"
  ON organizations FOR SELECT
  USING (auth.uid() IS NOT NULL);

GRANT SELECT ON organizations TO authenticated;
