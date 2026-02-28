-- ============================================
-- SGI FV - Migration 002: RLS Policies
-- ============================================
-- Data: 2026-02-20
-- Descrição: Row Level Security para multi-tenant
-- ============================================

-- ============================================
-- 1. HABILITAR RLS
-- ============================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. FUNÇÕES HELPER
-- ============================================

-- Verifica se o usuário é membro de uma organização
CREATE OR REPLACE FUNCTION is_org_member(check_org_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM org_members
    WHERE org_members.org_id = check_org_id
    AND org_members.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verifica se o usuário é admin/owner de uma organização
CREATE OR REPLACE FUNCTION is_org_admin(check_org_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM org_members
    WHERE org_members.org_id = check_org_id
    AND org_members.user_id = auth.uid()
    AND org_members.role IN ('admin', 'owner')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Retorna o org_id do usuário atual (primeira organização encontrada)
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS uuid AS $$
DECLARE
  result_org_id uuid;
BEGIN
  SELECT org_id INTO result_org_id
  FROM org_members
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  RETURN result_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. POLICIES: org_members
-- ============================================

-- Usuários podem ver suas próprias memberships
DROP POLICY IF EXISTS "Users can view their own memberships" ON org_members;
CREATE POLICY "Users can view their own memberships"
  ON org_members FOR SELECT
  USING (user_id = auth.uid());

-- Admins podem ver todos os membros da sua organização
DROP POLICY IF EXISTS "Org admins can view all org members" ON org_members;
CREATE POLICY "Org admins can view all org members"
  ON org_members FOR SELECT
  USING (is_org_admin(org_id));

-- Admins podem inserir novos membros na sua organização
DROP POLICY IF EXISTS "Org admins can insert members" ON org_members;
CREATE POLICY "Org admins can insert members"
  ON org_members FOR INSERT
  WITH CHECK (is_org_admin(org_id));

-- Admins podem atualizar membros da sua organização
DROP POLICY IF EXISTS "Org admins can update members" ON org_members;
CREATE POLICY "Org admins can update members"
  ON org_members FOR UPDATE
  USING (is_org_admin(org_id));

-- Admins podem deletar membros da sua organização (exceto owner)
DROP POLICY IF EXISTS "Org admins can delete members" ON org_members;
CREATE POLICY "Org admins can delete members"
  ON org_members FOR DELETE
  USING (is_org_admin(org_id) AND role != 'owner');

-- Permitir inserção para usuários durante registro (sem org ainda)
DROP POLICY IF EXISTS "Allow self insert on registration" ON org_members;
CREATE POLICY "Allow self insert on registration"
  ON org_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- 4. POLICIES: organizations
-- ============================================

-- Membros podem ver sua organização
DROP POLICY IF EXISTS "Members can view their organization" ON organizations;
CREATE POLICY "Members can view their organization"
  ON organizations FOR SELECT
  USING (is_org_member(id));

-- Owners podem atualizar sua organização
DROP POLICY IF EXISTS "Owners can update organization" ON organizations;
CREATE POLICY "Owners can update organization"
  ON organizations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = organizations.id
      AND org_members.user_id = auth.uid()
      AND org_members.role = 'owner'
    )
  );

-- Permitir SELECT da org 'default' para novos registros
DROP POLICY IF EXISTS "Allow read default org" ON organizations;
CREATE POLICY "Allow read default org"
  ON organizations FOR SELECT
  USING (slug = 'default');

-- ============================================
-- 5. POLICIES: profiles
-- ============================================

-- Usuários podem ver perfis da sua organização
DROP POLICY IF EXISTS "Users can view profiles in their org" ON profiles;
CREATE POLICY "Users can view profiles in their org"
  ON profiles FOR SELECT
  USING (is_org_member(org_id) OR id = auth.uid());

-- Usuários podem atualizar seu próprio perfil
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- Admins podem atualizar perfis da sua organização
DROP POLICY IF EXISTS "Org admins can update org profiles" ON profiles;
CREATE POLICY "Org admins can update org profiles"
  ON profiles FOR UPDATE
  USING (is_org_admin(org_id));

-- Usuários podem inserir seu próprio perfil
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- Admins podem inserir perfis na sua organização
DROP POLICY IF EXISTS "Org admins can insert profiles" ON profiles;
CREATE POLICY "Org admins can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (is_org_admin(org_id));

-- ============================================
-- 6. GRANTS
-- ============================================
-- Conceder acesso às funções para authenticated users
GRANT EXECUTE ON FUNCTION is_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_org_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_org_id() TO authenticated;
