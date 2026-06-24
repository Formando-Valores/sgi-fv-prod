-- ============================================
-- SGI FV - Migration 029: Role Changer
-- ============================================
-- Data: 2026-06-23
-- Descricao:
--   - Adiciona colunas name e role em profiles
--   - Expande CHECK constraint de org_members.role
--     para suportar senior, pleno, operador
-- ============================================

-- 1. Add missing columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text;

-- 2. Sync existing data: copy nome_completo -> name where name is null
UPDATE profiles SET name = nome_completo WHERE name IS NULL AND nome_completo IS NOT NULL;

-- 3. Expand org_members role constraint
ALTER TABLE org_members DROP CONSTRAINT IF EXISTS org_members_role_check;
ALTER TABLE org_members ADD CONSTRAINT org_members_role_check
  CHECK (role IN ('owner', 'admin', 'senior', 'pleno', 'operador', 'staff', 'client'));
