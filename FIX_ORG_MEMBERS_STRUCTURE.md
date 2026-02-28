# Fix: Missing `id` Column in `org_members` Table

## Problem

The application is throwing the error:

```
ERROR: 42703: column om.id does not exist
```

This occurs because the `org_members` table is missing its primary key `id` column. The table was likely created without it, or the column was accidentally dropped.

## Root Cause

The original migration may have created `org_members` with a composite primary key on `(org_id, user_id)` instead of a proper UUID `id` column. While this works for data integrity, it breaks queries that reference `om.id`.

## Correct Table Structure

The `org_members` table should have:

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() |
| `org_id` | uuid | FOREIGN KEY → organizations(id) |
| `user_id` | uuid | FOREIGN KEY → auth.users(id) |
| `role` | text | CHECK (role IN ('owner', 'admin', 'staff', 'client')) |
| `created_at` | timestamptz | DEFAULT now() |

Constraints:
- PRIMARY KEY on `id`
- UNIQUE constraint on `(org_id, user_id)`
- Foreign keys to `organizations` and `auth.users`

## Solution

### Quick Fix

Run in Supabase SQL Editor:

```sql
-- Quick fix: Add id column and set as primary key
ALTER TABLE org_members ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
UPDATE org_members SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE org_members ALTER COLUMN id SET NOT NULL;
ALTER TABLE org_members DROP CONSTRAINT IF EXISTS org_members_pkey;
ALTER TABLE org_members ADD PRIMARY KEY (id);
```

Or execute the script:
- `supabase/quick_fix_org_members_id.sql`

### Full Fix with Verification

For a comprehensive fix with verification steps:
- `supabase/fix_org_members_structure.sql`

## Verification

After running the fix, verify with:

```sql
-- Check structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'org_members'
ORDER BY ordinal_position;

-- Check constraints
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.org_members'::regclass;

-- Check data
SELECT om.id, om.org_id, om.user_id, om.role, u.email
FROM org_members om
JOIN auth.users u ON u.id = om.user_id
LIMIT 5;
```

Expected output should show:
- `id` column of type `uuid`
- Primary key constraint on `id`
- Unique constraint on `(org_id, user_id)`
- All rows have unique UUIDs in the `id` column

## Related Files

- `supabase/migrations/001_multiempresa.sql` - Original table creation
- `supabase/fix_base_tables.sql` - Base table fixes
- `src/contexts/AuthContext.tsx` - Uses org_members for context
