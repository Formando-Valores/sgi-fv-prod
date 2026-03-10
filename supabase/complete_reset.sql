-- =====================================================
-- COMPLETE RESET: Drop and Recreate Functions and Policies
-- =====================================================
-- This script uses CASCADE to drop functions along with
-- all dependent RLS policies, then recreates everything.
--
-- WHY CASCADE?
-- The functions is_org_member(), is_org_admin(), and get_user_org_id()
-- are used by RLS policies. PostgreSQL won't let you drop them
-- unless you also drop the dependent policies.
--
-- CASCADE automatically drops all dependent objects (policies)
-- This is safe because we recreate all policies afterward.
-- =====================================================

-- Step 1: Drop functions with CASCADE (will drop dependent policies)
DROP FUNCTION IF EXISTS public.is_org_member(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_org_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_org_id() CASCADE;

-- Step 2: Recreate functions with correct parameter names
CREATE OR REPLACE FUNCTION public.is_org_member(check_org_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = check_org_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_org_admin(check_org_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = check_org_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS uuid AS $$
BEGIN
  RETURN (
    SELECT org_id FROM profiles
    WHERE id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Recreate RLS policies for organizations
CREATE POLICY "Members can view their org"
  ON organizations FOR SELECT
  USING (is_org_member(id));

-- Step 4: Recreate RLS policies for profiles
CREATE POLICY "Users can view profiles in their org"
  ON profiles FOR SELECT
  USING (
    id = auth.uid() OR 
    (org_id IS NOT NULL AND is_org_member(org_id))
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- Step 5: Recreate RLS policies for org_members
CREATE POLICY "Users can view own membership"
  ON org_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Members can view org members"
  ON org_members FOR SELECT
  USING (is_org_member(org_id));

CREATE POLICY "Admins can manage org members"
  ON org_members FOR ALL
  USING (is_org_admin(org_id));

-- Step 6: Recreate RLS policies for processes (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'processes') THEN
    -- Drop existing policies first to avoid conflicts
    DROP POLICY IF EXISTS "Members can view org processes" ON processes;
    DROP POLICY IF EXISTS "Admins can insert processes" ON processes;
    DROP POLICY IF EXISTS "Admins can update processes" ON processes;
    DROP POLICY IF EXISTS "Admins can delete processes" ON processes;
    
    -- Recreate policies
    EXECUTE 'CREATE POLICY "Members can view org processes"
      ON processes FOR SELECT
      USING (is_org_member(org_id))';
    
    EXECUTE 'CREATE POLICY "Admins can insert processes"
      ON processes FOR INSERT
      WITH CHECK (is_org_admin(org_id))';
    
    EXECUTE 'CREATE POLICY "Admins can update processes"
      ON processes FOR UPDATE
      USING (is_org_admin(org_id))';
    
    EXECUTE 'CREATE POLICY "Admins can delete processes"
      ON processes FOR DELETE
      USING (is_org_admin(org_id))';
  END IF;
END $$;

-- Step 7: Recreate RLS policies for process_events (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'process_events') THEN
    -- Drop existing policies first to avoid conflicts
    DROP POLICY IF EXISTS "Members can view org process events" ON process_events;
    DROP POLICY IF EXISTS "Admins can insert process events" ON process_events;
    DROP POLICY IF EXISTS "Admins can update process events" ON process_events;
    
    -- Recreate policies
    EXECUTE 'CREATE POLICY "Members can view org process events"
      ON process_events FOR SELECT
      USING (is_org_member(org_id))';
    
    EXECUTE 'CREATE POLICY "Admins can insert process events"
      ON process_events FOR INSERT
      WITH CHECK (is_org_admin(org_id))';
    
    EXECUTE 'CREATE POLICY "Admins can update process events"
      ON process_events FOR UPDATE
      USING (is_org_admin(org_id))';
  END IF;
END $$;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these after executing the script to verify success:

-- Check functions exist:
-- SELECT proname FROM pg_proc WHERE proname IN ('is_org_member', 'is_org_admin', 'get_user_org_id');

-- Check policies on organizations:
-- SELECT policyname FROM pg_policies WHERE tablename = 'organizations';

-- Check policies on profiles:
-- SELECT policyname FROM pg_policies WHERE tablename = 'profiles';

-- Check policies on org_members:
-- SELECT policyname FROM pg_policies WHERE tablename = 'org_members';

-- Check policies on processes:
-- SELECT policyname FROM pg_policies WHERE tablename = 'processes';

-- Check policies on process_events:
-- SELECT policyname FROM pg_policies WHERE tablename = 'process_events';
