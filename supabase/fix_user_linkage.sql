-- =====================================================
-- FIX: Enable RLS on processes and link user to org
-- =====================================================
-- Run this in Supabase SQL Editor
-- Purpose: Fix missing user-organization linkage and enable RLS
-- =====================================================

-- Step 1: Enable RLS on processes table
ALTER TABLE processes ENABLE ROW LEVEL SECURITY;

-- Step 2: Ensure default organization exists
INSERT INTO organizations (name, slug)
VALUES ('Organização Padrão', 'default')
ON CONFLICT (slug) DO NOTHING;

-- Step 3: Link specific user to default organization
DO $$
DECLARE
  default_org_id uuid;
  my_user_id uuid;
  my_email text := 'germanoreis2024@gmail.com';
BEGIN
  -- Get default org id
  SELECT id INTO default_org_id FROM organizations WHERE slug = 'default';
  
  IF default_org_id IS NULL THEN
    RAISE EXCEPTION 'Default organization not found';
  END IF;
  
  -- Get user id
  SELECT id INTO my_user_id FROM auth.users WHERE email = my_email;
  
  IF my_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found: %', my_email;
  END IF;
  
  -- Create or update profile
  INSERT INTO profiles (id, email, org_id, nome_completo)
  VALUES (my_user_id, my_email, default_org_id, 'Usuário')
  ON CONFLICT (id) DO UPDATE 
  SET org_id = default_org_id,
      email = my_email;
  
  -- Create org membership
  INSERT INTO org_members (org_id, user_id, role)
  VALUES (default_org_id, my_user_id, 'admin')
  ON CONFLICT (org_id, user_id) DO UPDATE
  SET role = 'admin';
  
  RAISE NOTICE 'User % linked to organization % as admin', my_email, default_org_id;
END $$;

-- Step 4: Verify the linkage
SELECT 
  u.email,
  p.nome_completo,
  p.org_id,
  o.name as org_name,
  om.role
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
LEFT JOIN org_members om ON om.user_id = u.id
LEFT JOIN organizations o ON o.id = om.org_id
WHERE u.email = 'germanoreis2024@gmail.com';
