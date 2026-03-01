-- =====================================================
-- FIX: Link ALL existing users to default organization
-- =====================================================
-- Run this in Supabase SQL Editor
-- Purpose: Link all users without org membership to default org
-- =====================================================

-- Step 1: Enable RLS on processes table
ALTER TABLE processes ENABLE ROW LEVEL SECURITY;

-- Step 2: Ensure default organization exists
INSERT INTO organizations (name, slug)
VALUES ('Organização Padrão', 'default')
ON CONFLICT (slug) DO NOTHING;

-- Step 3: Link ALL existing users to default organization
DO $$
DECLARE
  default_org_id uuid;
  user_record RECORD;
  linked_count integer := 0;
BEGIN
  -- Get default org id
  SELECT id INTO default_org_id FROM organizations WHERE slug = 'default';
  
  IF default_org_id IS NULL THEN
    RAISE EXCEPTION 'Default organization not found';
  END IF;
  
  -- For each user
  FOR user_record IN SELECT id, email FROM auth.users LOOP
    -- Create or update profile
    INSERT INTO profiles (id, email, org_id)
    VALUES (user_record.id, user_record.email, default_org_id)
    ON CONFLICT (id) DO UPDATE SET org_id = default_org_id;
    
    -- Create org membership
    INSERT INTO org_members (org_id, user_id, role)
    VALUES (default_org_id, user_record.id, 'admin')
    ON CONFLICT (org_id, user_id) DO NOTHING;
    
    linked_count := linked_count + 1;
    RAISE NOTICE 'Linked user: %', user_record.email;
  END LOOP;
  
  RAISE NOTICE 'Total users linked: %', linked_count;
END $$;

-- Step 4: Verify all linkages
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
ORDER BY u.email;
