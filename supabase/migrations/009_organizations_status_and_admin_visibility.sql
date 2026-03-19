-- ============================================
-- SGI FV - Migration 009: status da organização + visibilidade global para admin padrão
-- ============================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Permite que admins/owners da org padrão visualizem todas as organizações.
DROP POLICY IF EXISTS "Default org admins can view all organizations" ON organizations;
CREATE POLICY "Default org admins can view all organizations"
  ON organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM org_members om
      JOIN organizations o ON o.id = om.org_id
      WHERE om.user_id = auth.uid()
        AND om.role IN ('admin', 'owner')
        AND o.slug = 'default'
    )
  );

-- Permite gestão (UPDATE/DELETE) de qualquer organização para admins da org padrão.
DROP POLICY IF EXISTS "Default org admins can update organizations" ON organizations;
CREATE POLICY "Default org admins can update organizations"
  ON organizations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM org_members om
      JOIN organizations o ON o.id = om.org_id
      WHERE om.user_id = auth.uid()
        AND om.role IN ('admin', 'owner')
        AND o.slug = 'default'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM org_members om
      JOIN organizations o ON o.id = om.org_id
      WHERE om.user_id = auth.uid()
        AND om.role IN ('admin', 'owner')
        AND o.slug = 'default'
    )
  );

DROP POLICY IF EXISTS "Default org admins can delete organizations" ON organizations;
CREATE POLICY "Default org admins can delete organizations"
  ON organizations FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM org_members om
      JOIN organizations o ON o.id = om.org_id
      WHERE om.user_id = auth.uid()
        AND om.role IN ('admin', 'owner')
        AND o.slug = 'default'
    )
  );

GRANT SELECT, UPDATE, DELETE ON organizations TO authenticated;
