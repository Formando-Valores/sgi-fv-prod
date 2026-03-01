-- =====================================================
-- FIX: Update org_members role and verify structure
-- =====================================================
-- Problem: The role is set to "authenticated" instead of a valid role
-- Valid roles: 'owner', 'admin', 'staff', 'client'
-- =====================================================

-- Step 1: Check current structure of org_members table
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'org_members'
ORDER BY ordinal_position;

-- Step 2: Check existing constraints
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.org_members'::regclass;

-- Step 3: Check current data
SELECT 
  om.id,
  om.org_id,
  om.user_id,
  om.role,
  u.email
FROM org_members om
JOIN auth.users u ON u.id = om.user_id;

-- Step 4: Update the role from 'authenticated' to 'admin'
UPDATE org_members
SET role = 'admin'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'germanoreis2024@gmail.com'
);

-- Step 5: Verify the update
SELECT 
  om.id,
  om.org_id,
  om.user_id,
  om.role,
  u.email,
  o.name as org_name
FROM org_members om
JOIN auth.users u ON u.id = om.user_id
JOIN organizations o ON o.id = om.org_id
WHERE u.email = 'germanoreis2024@gmail.com';

-- Step 6: Add CHECK constraint if missing (to prevent future invalid roles)
DO $$
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE org_members DROP CONSTRAINT IF EXISTS org_members_role_check;
  
  -- Add the correct constraint
  ALTER TABLE org_members ADD CONSTRAINT org_members_role_check 
    CHECK (role IN ('owner', 'admin', 'staff', 'client'));
  
  RAISE NOTICE 'CHECK constraint added successfully';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error adding constraint: %', SQLERRM;
END $$;

-- Step 7: Verify constraint was added
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.org_members'::regclass
AND conname = 'org_members_role_check';

-- Step 8: Fix the id field if it's the same as user_id
-- The id should be a unique UUID, not the same as user_id
DO $$
DECLARE
  member_record RECORD;
BEGIN
  FOR member_record IN 
    SELECT id, user_id FROM org_members WHERE id = user_id
  LOOP
    UPDATE org_members 
    SET id = gen_random_uuid()
    WHERE id = member_record.id;
    
    RAISE NOTICE 'Updated id for user_id: %', member_record.user_id;
  END LOOP;
END $$;

-- Step 9: Final verification
SELECT 
  om.id,
  om.org_id,
  om.user_id,
  om.role,
  u.email,
  o.name as org_name,
  CASE WHEN om.id = om.user_id THEN 'WARNING: id equals user_id' ELSE 'OK' END as id_status
FROM org_members om
JOIN auth.users u ON u.id = om.user_id
JOIN organizations o ON o.id = om.org_id;
