-- =====================================================
-- FIX: Add missing id column to org_members table
-- =====================================================
-- This script fixes the org_members table structure by adding
-- the missing 'id' column that serves as the primary key.
-- =====================================================

-- Step 1: Check current structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'org_members'
ORDER BY ordinal_position;

-- Step 2: Check if id column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'org_members' 
    AND column_name = 'id'
  ) THEN
    RAISE NOTICE 'Column id does not exist. Will add it.';
  ELSE
    RAISE NOTICE 'Column id already exists.';
  END IF;
END $$;

-- Step 3: Add id column if it doesn't exist
ALTER TABLE org_members 
ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

-- Step 4: Generate UUIDs for existing rows that have NULL id
UPDATE org_members 
SET id = gen_random_uuid() 
WHERE id IS NULL;

-- Step 5: Make id NOT NULL
ALTER TABLE org_members 
ALTER COLUMN id SET NOT NULL;

-- Step 6: Drop existing primary key if any
DO $$
BEGIN
  -- Check if there's an existing primary key
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.org_members'::regclass 
    AND contype = 'p'
  ) THEN
    -- Drop the existing primary key
    ALTER TABLE org_members DROP CONSTRAINT IF EXISTS org_members_pkey;
    RAISE NOTICE 'Dropped existing primary key';
  END IF;
END $$;

-- Step 7: Set id as primary key
ALTER TABLE org_members 
ADD PRIMARY KEY (id);

-- Step 8: Ensure UNIQUE constraint on (org_id, user_id)
ALTER TABLE org_members 
DROP CONSTRAINT IF EXISTS org_members_org_id_user_id_key;

ALTER TABLE org_members 
ADD CONSTRAINT org_members_org_id_user_id_key UNIQUE (org_id, user_id);

-- Step 9: Verify the structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'org_members'
ORDER BY ordinal_position;

-- Step 10: Verify constraints
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.org_members'::regclass
ORDER BY contype, conname;

-- Step 11: Verify data
SELECT 
  om.id,
  om.org_id,
  om.user_id,
  om.role,
  om.created_at,
  u.email
FROM org_members om
JOIN auth.users u ON u.id = om.user_id
WHERE u.email = 'germanoreis2024@gmail.com';
