-- ============================================
-- SGI FV - Migration 047: Harden RLS functions against invalid UUIDs
-- ============================================
-- Data: 2026-07-06
-- Descrição:
--   - Change is_org_member and is_org_admin to accept text (not uuid)
--   - Add exception handling for invalid UUID casts
--   - Prevents 22P02 errors when empty string is passed as org_id
-- ============================================

-- STEP 1: Drop all policies that depend on the old uuid-version functions

-- org_members
DROP POLICY IF EXISTS "Org admins can view all org members" ON public.org_members;
DROP POLICY IF EXISTS "Org admins can insert members" ON public.org_members;
DROP POLICY IF EXISTS "Org admins can update members" ON public.org_members;
DROP POLICY IF EXISTS "Org admins can delete members" ON public.org_members;
DROP POLICY IF EXISTS "Admins can manage members" ON public.org_members;

-- profiles
DROP POLICY IF EXISTS "Org admins can update org profiles" ON public.profiles;
DROP POLICY IF EXISTS "Org admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Org admins can delete org profiles" ON public.profiles;

-- organizations
DROP POLICY IF EXISTS "Scoped users can view organizations" ON public.organizations;
DROP POLICY IF EXISTS "Members can view their organization" ON public.organizations;
DROP POLICY IF EXISTS "Members can view org memberships" ON public.org_members;
DROP POLICY IF EXISTS "Members can view org profiles" ON public.profiles;

-- processes
DROP POLICY IF EXISTS "Admins can insert processes" ON public.processes;
DROP POLICY IF EXISTS "Admins can update processes" ON public.processes;
DROP POLICY IF EXISTS "Admins can delete processes" ON public.processes;

-- process_events
DROP POLICY IF EXISTS "Members can view org process events" ON public.process_events;
DROP POLICY IF EXISTS "Members can insert own process events" ON public.process_events;
DROP POLICY IF EXISTS "Admins can insert process events" ON public.process_events;
DROP POLICY IF EXISTS "Admins can update process events" ON public.process_events;

-- STEP 2: Drop old uuid-version functions
DROP FUNCTION IF EXISTS public.is_org_admin(uuid);
DROP FUNCTION IF EXISTS public.is_org_member(uuid);

-- STEP 3: Create new text-version functions with exception handling
CREATE OR REPLACE FUNCTION public.is_org_member(check_org_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_members.org_id = check_org_id::uuid
      AND org_members.user_id = auth.uid()
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(check_org_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_members.org_id = check_org_id::uuid
      AND org_members.user_id = auth.uid()
      AND org_members.role IN ('admin', 'owner')
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_org_member(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(text) TO authenticated;

-- STEP 4: Recreate all policies
-- Cast uuid columns to text explicitly for the text-version functions

-- org_members policies
CREATE POLICY "Org admins can view all org members"
  ON public.org_members FOR SELECT
  USING (public.is_org_admin(org_id::text));

CREATE POLICY "Org admins can insert members"
  ON public.org_members FOR INSERT
  WITH CHECK (public.is_org_admin(org_id::text));

CREATE POLICY "Org admins can update members"
  ON public.org_members FOR UPDATE
  USING (public.is_org_admin(org_id::text) OR public.is_default_org_admin(auth.uid()))
  WITH CHECK (public.is_org_admin(org_id::text) OR public.is_default_org_admin(auth.uid()));

CREATE POLICY "Org admins can delete members"
  ON public.org_members FOR DELETE
  USING ((public.is_org_admin(org_id::text) OR public.is_default_org_admin(auth.uid())) AND role <> 'owner');

-- profiles policies
CREATE POLICY "Org admins can update org profiles"
  ON public.profiles FOR UPDATE
  USING (public.is_org_admin(org_id::text));

CREATE POLICY "Org admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (public.is_org_admin(org_id::text));

CREATE POLICY "Org admins can delete org profiles"
  ON public.profiles FOR DELETE
  USING (public.is_org_admin(org_id::text));

-- organizations policies
CREATE POLICY "Scoped users can view organizations"
  ON public.organizations FOR SELECT
  USING (public.is_org_member(id::text) OR public.is_default_org_admin(auth.uid()));

-- processes policies
CREATE POLICY "Admins can insert processes"
  ON public.processes FOR INSERT
  WITH CHECK (public.is_org_admin(org_id::text) OR public.is_default_org_admin(auth.uid()));

CREATE POLICY "Admins can update processes"
  ON public.processes FOR UPDATE
  USING (public.is_org_admin(org_id::text) OR public.is_default_org_admin(auth.uid()))
  WITH CHECK (public.is_org_admin(org_id::text) OR public.is_default_org_admin(auth.uid()));

CREATE POLICY "Admins can delete processes"
  ON public.processes FOR DELETE
  USING (public.is_org_admin(org_id::text) OR public.is_default_org_admin(auth.uid()));

-- process_events policies
CREATE POLICY "Members can view org process events"
  ON public.process_events FOR SELECT
  USING (public.is_org_member(org_id::text));

CREATE POLICY "Members can insert own process events"
  ON public.process_events FOR INSERT
  WITH CHECK (
    public.is_org_member(org_id::text)
    AND actor_user_id = auth.uid()
    AND created_by = auth.uid()
  );

-- Note: "Scoped roles can manage/delete processes" and
-- "Scoped roles can insert/update process events" from migration 026
-- use can_manage_entity(uuid) — not is_org_admin/is_org_member.
-- They remain untouched.
