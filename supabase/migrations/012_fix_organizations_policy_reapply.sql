-- ============================================
-- SGI FV - Migration 012: reparo idempotente das policies de organizations
-- ============================================
-- Cenário corrigido:
-- 1) policy recursiva ainda ativa após migrações anteriores
-- 2) erro 42710 ao reaplicar migration 011 (policy já existe)

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Remove quaisquer versões anteriores (recursivas ou já criadas)
DROP POLICY IF EXISTS "Default org admins can view all organizations" ON organizations;
DROP POLICY IF EXISTS "Default org admins can update organizations" ON organizations;
DROP POLICY IF EXISTS "Default org admins can delete organizations" ON organizations;

DROP POLICY IF EXISTS "Org admins can view all organizations" ON organizations;
DROP POLICY IF EXISTS "Org admins can update organizations" ON organizations;
DROP POLICY IF EXISTS "Org admins can delete organizations" ON organizations;

DROP POLICY IF EXISTS "Authenticated users can view organizations" ON organizations;

-- SELECT seguro para evitar bloqueio de listagem no painel
CREATE POLICY "Authenticated users can view organizations"
  ON organizations FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- UPDATE/DELETE sem recursão (consulta apenas org_members)
CREATE POLICY "Org admins can update organizations"
  ON organizations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM org_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM org_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Org admins can delete organizations"
  ON organizations FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM org_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('admin', 'owner')
    )
  );

GRANT SELECT, UPDATE, DELETE ON organizations TO authenticated;
