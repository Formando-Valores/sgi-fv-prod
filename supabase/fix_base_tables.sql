-- ============================================
-- SGI FV - FIX: Complete Base Multi-Tenant Tables
-- ============================================
-- Execute este arquivo COMPLETO no Supabase SQL Editor
-- Vai criar as tabelas se não existirem e corrigir políticas
-- ============================================

-- ============================================
-- PARTE 1: CRIAR TABELAS BASE
-- ============================================

-- 1.1 Tabela organizations
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 1.2 Tabela org_members
CREATE TABLE IF NOT EXISTS org_members (
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text CHECK (role IN ('owner','admin','staff','client')) NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

-- 1.3 Tabela profiles (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'profiles') THEN
    CREATE TABLE profiles (
      id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      org_id uuid REFERENCES organizations(id),
      email text,
      nome_completo text,
      documento_identidade text,
      nif_cpf text,
      estado_civil text,
      phone text,
      endereco text,
      pais text,
      created_at timestamptz DEFAULT now()
    );
  ELSE
    -- Adiciona colunas se não existirem
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'org_id') THEN
      ALTER TABLE profiles ADD COLUMN org_id uuid REFERENCES organizations(id);
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'nome_completo') THEN
      ALTER TABLE profiles ADD COLUMN nome_completo text;
    END IF;
  END IF;
END
$$;

-- ============================================
-- PARTE 2: ÍNDICES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- ============================================
-- PARTE 3: ORGANIZAÇÃO PADRÃO
-- ============================================
INSERT INTO organizations (id, slug, name)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'default',
  'Organização Padrão'
)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;

-- ============================================
-- PARTE 4: FUNÇÕES HELPER (RECRIADAS)
-- ============================================
-- IMPORTANTE: DROP primeiro para evitar erro de nome de parâmetro
DROP FUNCTION IF EXISTS public.is_org_member(uuid);
DROP FUNCTION IF EXISTS public.is_org_admin(uuid);
DROP FUNCTION IF EXISTS public.get_user_org_id();

-- Função: verificar se é membro
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

-- Função: verificar se é admin
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

-- Função: obter org_id do usuário
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

-- Grants das funções
GRANT EXECUTE ON FUNCTION is_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_org_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_org_id() TO authenticated;

-- ============================================
-- PARTE 5: HABILITAR RLS
-- ============================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PARTE 6: POLÍTICAS RLS (RECRIADAS)
-- ============================================

-- 6.1 ORGANIZATIONS
DROP POLICY IF EXISTS "Members can view their organization" ON organizations;
DROP POLICY IF EXISTS "Allow read default org" ON organizations;

CREATE POLICY "Members can view their organization"
  ON organizations FOR SELECT
  USING (is_org_member(id) OR slug = 'default');

-- 6.2 ORG_MEMBERS - Políticas mais permissivas para resolver o 400
DROP POLICY IF EXISTS "Users can view their own memberships" ON org_members;
DROP POLICY IF EXISTS "Org admins can view all org members" ON org_members;
DROP POLICY IF EXISTS "Org admins can insert members" ON org_members;
DROP POLICY IF EXISTS "Org admins can update members" ON org_members;
DROP POLICY IF EXISTS "Org admins can delete members" ON org_members;
DROP POLICY IF EXISTS "Allow self insert on registration" ON org_members;
DROP POLICY IF EXISTS "Users can view memberships" ON org_members;

-- Usuários podem ver suas próprias memberships
CREATE POLICY "Users can view their own memberships"
  ON org_members FOR SELECT
  USING (user_id = auth.uid());

-- Membros podem ver outros membros da mesma org
CREATE POLICY "Members can view org memberships"
  ON org_members FOR SELECT
  USING (is_org_member(org_id));

-- Usuários autenticados podem inserir sua própria membership
CREATE POLICY "Users can insert own membership"
  ON org_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admins podem gerenciar membros
CREATE POLICY "Admins can manage members"
  ON org_members FOR ALL
  USING (is_org_admin(org_id));

-- 6.3 PROFILES
DROP POLICY IF EXISTS "Users can view profiles in their org" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Org admins can update org profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Org admins can insert profiles" ON profiles;

-- Usuários podem ver seu próprio perfil
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Membros podem ver perfis da org
CREATE POLICY "Members can view org profiles"
  ON profiles FOR SELECT
  USING (is_org_member(org_id));

-- Usuários podem inserir seu próprio perfil
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- Usuários podem atualizar seu próprio perfil
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- ============================================
-- PARTE 7: GRANTS FINAIS
-- ============================================
GRANT ALL ON organizations TO authenticated;
GRANT ALL ON org_members TO authenticated;
GRANT ALL ON profiles TO authenticated;

-- ============================================
-- PARTE 8: VINCULAR USUÁRIOS EXISTENTES
-- ============================================
-- Vincula usuários existentes à organização padrão
DO $$
DECLARE
  default_org_id uuid;
  user_record RECORD;
BEGIN
  -- Obter ID da organização padrão
  SELECT id INTO default_org_id FROM organizations WHERE slug = 'default';
  
  IF default_org_id IS NOT NULL THEN
    -- Para cada usuário em auth.users que não tem membership
    FOR user_record IN 
      SELECT id, email FROM auth.users 
      WHERE id NOT IN (SELECT user_id FROM org_members)
    LOOP
      -- Criar membership como admin na org padrão
      INSERT INTO org_members (org_id, user_id, role)
      VALUES (default_org_id, user_record.id, 'admin')
      ON CONFLICT (org_id, user_id) DO NOTHING;
      
      -- Criar/atualizar perfil
      INSERT INTO profiles (id, org_id, email)
      VALUES (user_record.id, default_org_id, user_record.email)
      ON CONFLICT (id) DO UPDATE SET org_id = default_org_id;
      
      RAISE NOTICE 'Usuário % vinculado à organização padrão', user_record.email;
    END LOOP;
  END IF;
END
$$;

-- ============================================
-- VERIFICAÇÃO FINAL
-- ============================================
-- Execute estas queries para verificar:

-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('organizations', 'profiles', 'org_members')
-- ORDER BY table_name;

-- SELECT * FROM organizations;
-- SELECT * FROM org_members;
-- SELECT * FROM profiles;

