# Fix: org_members Role Issue

## Problem

The `org_members` table has an incorrect role value:

```json
{
  "org_id": "f1d977d1-a4c8-44b9-951b-064b9e632ef9",
  "user_id": "b5fcc0ab-ca8d-47d9-b76a-afa641f9b16f",
  "role": "authenticated",  // ❌ WRONG!
  "id": "b5fcc0ab-ca8d-47d9-b76a-afa641f9b16f"  // ❌ Same as user_id
}
```

### Issues Found:

1. **Role is "authenticated"** - This is not a valid role. It appears the Supabase auth role was used instead of the application role.
2. **id equals user_id** - The `id` field should be a unique UUID for the membership record, not the same as `user_id`.

## Valid Roles

The `org_members.role` field should be one of:

| Role | Description |
|------|-------------|
| `owner` | Organization owner, full permissions |
| `admin` | Administrator, can manage processes and members |
| `staff` | Staff member, can view and update processes |
| `client` | Client, limited view access |

## Why This Happened

The role value "authenticated" likely came from:
1. Copying the Supabase auth role instead of setting the application role
2. A bug in the user creation/linkage script
3. Missing CHECK constraint allowing any value

## How to Fix

### Option 1: Quick Fix (Recommended)

Run in Supabase SQL Editor:

```sql
-- Update the role
UPDATE org_members
SET role = 'admin'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'germanoreis2024@gmail.com'
);

-- Verify
SELECT role, u.email 
FROM org_members om
JOIN auth.users u ON u.id = om.user_id
WHERE u.email = 'germanoreis2024@gmail.com';
```

### Option 2: Complete Fix

Run the complete fix script: `supabase/fix_org_members_role.sql`

This will:
1. Check the current table structure
2. Update the role to 'admin'
3. Add a CHECK constraint to prevent future invalid values
4. Fix the `id` field if needed
5. Verify everything is correct

## How to Verify

After running the fix, check:

```sql
SELECT 
  om.id,
  om.org_id,
  om.user_id,
  om.role,
  u.email,
  o.name as org_name
FROM org_members om
JOIN auth.users u ON u.id = om.user_id
JOIN organizations o ON o.id = om.org_id;
```

Expected result:
- `role` should be `admin` (not `authenticated`)
- `id` should be different from `user_id`

## CHECK Constraint

To prevent future invalid roles, the fix adds this constraint:

```sql
ALTER TABLE org_members ADD CONSTRAINT org_members_role_check 
  CHECK (role IN ('owner', 'admin', 'staff', 'client'));
```

This ensures only valid roles can be inserted/updated.

## Impact on RLS Policies

The RLS policies check the role to determine permissions:

```sql
-- Example policy check
WHERE (SELECT role FROM org_members WHERE user_id = auth.uid()) IN ('owner', 'admin')
```

With `role = 'authenticated'`, these policies fail and return empty results or 400 errors.

## Files Created

- `supabase/fix_org_members_role.sql` - Complete fix with verification
- `supabase/quick_fix_role.sql` - Quick one-liner fix
- `FIX_ORG_MEMBERS_ROLE.md` - This documentation
