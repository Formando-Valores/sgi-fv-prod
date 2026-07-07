-- Recreate all org_members and profiles policies to be doubly safe
-- Drop/recreate policies that might pass empty UUIDs

-- Drop policies on org_members
DROP POLICY IF EXISTS "Org admins can view all org members" ON org_members;
DROP POLICY IF EXISTS "Org admins can insert members" ON org_members;
DROP POLICY IF EXISTS "Org admins can update members" ON org_members;
DROP POLICY IF EXISTS "Org admins can delete members" ON org_members;
DROP POLICY IF EXISTS "Users can view their own memberships" ON org_members;
DROP POLICY IF EXISTS "Allow self insert on registration" ON org_members;

-- Drop policies on profiles
DROP POLICY IF EXISTS "Org admins can update org profiles" ON profiles;
DROP POLICY IF EXISTS "Org admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Org admins can delete org profiles" ON profiles;
DROP POLICY IF EXISTS "Scoped users can view profiles in org" ON profiles;

-- Drop policies on organizations
DROP POLICY IF EXISTS "Scoped users can view organizations" ON organizations;
DROP POLICY IF EXISTS "Org admins can update organizations" ON organizations;
DROP POLICY IF EXISTS "Org admins can delete organizations" ON organizations;

-- Recreate org_members policies with safe text casts
CREATE POLICY "Org admins can view all org members" ON org_members
  FOR SELECT
  USING (public.is_org_admin(org_id::text));

CREATE POLICY "Org admins can insert members" ON org_members
  FOR INSERT
  WITH CHECK (public.is_org_admin(org_id::text));

CREATE POLICY "Org admins can update members" ON org_members
  FOR UPDATE
  USING (public.is_org_admin(org_id::text) OR public.is_default_org_admin(auth.uid()))
  WITH CHECK (public.is_org_admin(org_id::text) OR public.is_default_org_admin(auth.uid()));

CREATE POLICY "Org admins can delete members" ON org_members
  FOR DELETE
  USING ((public.is_org_admin(org_id::text) OR public.is_default_org_admin(auth.uid())) AND role <> 'owner');

CREATE POLICY "Users can view their own memberships" ON org_members
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Allow self insert on registration" ON org_members
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Recreate profiles policies with safe text casts
CREATE POLICY "Org admins can update org profiles" ON profiles
  FOR UPDATE
  USING (public.is_org_admin(org_id::text));

CREATE POLICY "Org admins can insert profiles" ON profiles
  FOR INSERT
  WITH CHECK (public.is_org_admin(org_id::text));

CREATE POLICY "Org admins can delete org profiles" ON profiles
  FOR DELETE
  USING (public.is_org_admin(org_id::text));

CREATE POLICY "Scoped users can view profiles in org" ON profiles
  FOR SELECT
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = profiles.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'staff')
    )
    OR public.is_default_org_admin(auth.uid())
  );

-- Recreate organizations policies with safe text casts
CREATE POLICY "Scoped users can view organizations" ON organizations
  FOR SELECT
  USING (
    public.is_org_member(id::text)
    OR public.is_default_org_admin(auth.uid())
  );

CREATE POLICY "Org admins can update organizations" ON organizations
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM org_members om
    WHERE om.user_id = auth.uid()
      AND om.role IN ('admin', 'owner')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM org_members om
    WHERE om.user_id = auth.uid()
      AND om.role IN ('admin', 'owner')
  ));

CREATE POLICY "Org admins can delete organizations" ON organizations
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM org_members om
    WHERE om.user_id = auth.uid()
      AND om.role IN ('admin', 'owner')
  ));
