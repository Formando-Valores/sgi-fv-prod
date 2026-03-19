-- ============================================
-- SGI FV - Migration 007: INSERT em organizations
-- ============================================
-- Corrige permissão de criação de organizações para admins globais
-- (admins/owners da organização padrão).

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org admins can insert organizations" ON organizations;
CREATE POLICY "Org admins can insert organizations"
  ON organizations FOR INSERT
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

-- Mantém permissão operacional para service_role (bypass RLS por padrão no Supabase).
GRANT INSERT ON organizations TO authenticated;
