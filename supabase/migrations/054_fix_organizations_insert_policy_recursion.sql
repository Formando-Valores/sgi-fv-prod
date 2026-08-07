-- ============================================
-- SGI FV - Migration 054: corrigir recursão na policy de INSERT de organizations
-- ============================================
-- Causa raiz: a migration 007 criou "Org admins can insert organizations"
-- com JOIN em organizations dentro de policy da própria organizations:
--   ... FROM org_members om JOIN organizations o ON o.id = om.org_id ...
-- Isso gera "infinite recursion detected in policy for relation organizations"
-- ao tentar criar uma nova organização.
--
-- As migrations 011/012 removeram apenas SELECT/UPDATE/DELETE recursivos
-- (policies "Default org admins ..." e "Org admins can view/update/delete"),
-- mas NÃO removeram a policy de INSERT recursiva da 007.
-- Mesmo com a policy segura "Authenticated users can insert organizations"
-- (008), o Postgres avalia todas as policies permissive (combinadas por OR)
-- e a recursão da 007 estoura o erro.
--
-- Esta migration remove a policy recursiva de INSERT e garante (idempotente)
-- a policy segura de INSERT para qualquer usuário autenticado.

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Remove a policy INSERT recursiva criada pela migration 007
DROP POLICY IF EXISTS "Org admins can insert organizations" ON organizations;

-- Garante a policy INSERT segura (fallback da migration 008) de forma idempotente
DROP POLICY IF EXISTS "Authenticated users can insert organizations" ON organizations;
CREATE POLICY "Authenticated users can insert organizations"
  ON organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

GRANT INSERT ON organizations TO authenticated;
