# Fix: User-Organization Linkage

## Problem

The dashboard shows "Carregando..." infinitely because:

1. **RLS is disabled** on the `processes` table (`rowsecurity: false`)
2. **User is not linked** to any organization:
   - No profile in `profiles` table
   - No membership in `org_members` table
   - Queries return `null` for `org_name` and `role`

## Root Cause

When a user registers via Supabase Auth, only the `auth.users` record is created. The application requires:
- A `profiles` record linking the user to an organization
- An `org_members` record defining the user's role

Without these, RLS policies block all data access.

## Solution

### For a Single User

1. Open **Supabase SQL Editor**
2. Run the script: `supabase/fix_user_linkage.sql`
3. Verify the output shows the user linked to an organization

### For ALL Users

1. Open **Supabase SQL Editor**
2. Run the script: `supabase/fix_all_users_linkage.sql`
3. Verify all users are linked

## What the Scripts Do

1. **Enable RLS** on the `processes` table
2. **Ensure default organization exists** ("Organização Padrão")
3. **Create/update profile** linking user to org
4. **Create org membership** with admin role
5. **Verify** the linkage with a SELECT query

## Verification

After running, verify with:

```sql
SELECT 
  u.email,
  p.org_id,
  o.name as org_name,
  om.role
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
LEFT JOIN org_members om ON om.user_id = u.id
LEFT JOIN organizations o ON o.id = om.org_id;
```

Expected result:
- `org_id`: UUID (not null)
- `org_name`: "Organização Padrão"
- `role`: "admin"

## For Multiple Users

If you have multiple users that need different organizations:

1. First create the organizations:
```sql
INSERT INTO organizations (name, slug) VALUES
  ('Empresa A', 'empresa-a'),
  ('Empresa B', 'empresa-b');
```

2. Then link each user individually:
```sql
DO $$
DECLARE
  org_id uuid;
  user_id uuid;
BEGIN
  SELECT id INTO org_id FROM organizations WHERE slug = 'empresa-a';
  SELECT id INTO user_id FROM auth.users WHERE email = 'user@empresa-a.com';
  
  INSERT INTO profiles (id, email, org_id)
  VALUES (user_id, 'user@empresa-a.com', org_id)
  ON CONFLICT (id) DO UPDATE SET org_id = org_id;
  
  INSERT INTO org_members (org_id, user_id, role)
  VALUES (org_id, user_id, 'admin')
  ON CONFLICT (org_id, user_id) DO NOTHING;
END $$;
```

## Troubleshooting

### Error: "User not found"
- Verify the email is correct
- Check if the user has registered via Supabase Auth

### Error: "Default organization not found"
- Run the organization creation step separately first

### Dashboard still loading
- Clear browser cache and refresh
- Check browser console for new errors
- Verify RLS policies exist for `processes` table
