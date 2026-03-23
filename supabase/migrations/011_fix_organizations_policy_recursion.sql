-- ============================================
-- SGI FV - Migration 011: corrigir recursão em policies de organizations
-- ============================================
-- Problema: policies da migration 009 faziam JOIN com organizations dentro de
-- policy da própria organizations, causando:
--   "infinite recursion detected in policy for relation organizations"

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Remove policies recursivas da 009
DROP POLICY IF EXISTS "Default org admins can view all organizations" ON organizations;
DROP POLICY IF EXISTS "Default org admins can update organizations" ON organizations;
DROP POLICY IF EXISTS "Default org admins can delete organizations" ON organizations;

-- Recria sem tocar na tabela organizations (somente org_members)
-- Evita recursão e mantém governança para admins/owners.

CREATE POLICY "Org admins can view all organizations"
  ON organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM org_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('admin', 'owner')
    )
  );

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
