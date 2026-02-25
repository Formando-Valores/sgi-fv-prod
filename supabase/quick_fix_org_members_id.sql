-- =====================================================
-- QUICK FIX: Add id column and set as primary key
-- =====================================================
-- Run this script in Supabase SQL Editor for a quick fix
-- =====================================================

-- Add id column with default UUID
ALTER TABLE org_members ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

-- Generate UUIDs for existing rows with NULL id
UPDATE org_members SET id = gen_random_uuid() WHERE id IS NULL;

-- Make id NOT NULL
ALTER TABLE org_members ALTER COLUMN id SET NOT NULL;

-- Drop existing primary key if any
ALTER TABLE org_members DROP CONSTRAINT IF EXISTS org_members_pkey;

-- Set id as primary key
ALTER TABLE org_members ADD PRIMARY KEY (id);

-- Verify the fix
SELECT 
  om.id,
  om.org_id,
  om.user_id,
  om.role,
  u.email
FROM org_members om
JOIN auth.users u ON u.id = om.user_id
WHERE u.email = 'germanoreis2024@gmail.com';
