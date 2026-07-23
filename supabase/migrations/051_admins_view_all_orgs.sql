-- Allow any org admin/owner to view ALL organizations (needed for context-switch impersonation)
DROP POLICY IF EXISTS "Scoped users can view organizations" ON organizations;

CREATE POLICY "Scoped users can view organizations" ON organizations
  FOR SELECT
  USING (
    public.is_org_member(id::text)
    OR public.is_default_org_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('admin', 'owner')
    )
  );
