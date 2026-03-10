-- =====================================================
-- QUICK FIX: Update org_members role to admin
-- =====================================================
-- Run this if you just need to fix the role quickly
-- =====================================================

-- Update the role from 'authenticated' to 'admin'
UPDATE org_members
SET role = 'admin'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'germanoreis2024@gmail.com'
);

-- Verify the change
SELECT 
  om.role,
  u.email,
  o.name as org_name
FROM org_members om
JOIN auth.users u ON u.id = om.user_id
JOIN organizations o ON o.id = om.org_id
WHERE u.email = 'germanoreis2024@gmail.com';
