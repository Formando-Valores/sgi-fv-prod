-- ============================================
-- SGI FV - Migration 001: Multi-Tenant Schema
-- ============================================
-- Data: 2026-02-20
-- Descrição: Criação de estrutura multi-tenant
-- ============================================

-- ============================================
-- 1. TABELA: organizations
-- ============================================
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE organizations IS 'Organizações/empresas do sistema multi-tenant';
COMMENT ON COLUMN organizations.slug IS 'Identificador único na URL (ex: formando-valores)';

-- ============================================
-- 2. TABELA: org_members
-- ============================================
CREATE TABLE IF NOT EXISTS org_members (
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text CHECK (role IN ('owner','admin','staff','client')) NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON org_members(org_id);

COMMENT ON TABLE org_members IS 'Vínculo entre usuários e organizações';
COMMENT ON COLUMN org_members.role IS 'owner=dono, admin=administrador, staff=funcionário, client=cliente';

-- ============================================
-- 3. TABELA: profiles (ajustada)
-- ============================================
-- Se a tabela já existir, fazemos ALTER. Se não, CREATE.
-- Usamos DO block para verificação condicional.

DO $$
BEGIN
  -- Verifica se a tabela profiles existe
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'profiles') THEN
    -- Adiciona coluna org_id se não existir
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'profiles' AND column_name = 'org_id'
    ) THEN
      ALTER TABLE profiles ADD COLUMN org_id uuid REFERENCES organizations(id);
    END IF;
    
    -- Adiciona coluna nome_completo se não existir
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'profiles' AND column_name = 'nome_completo'
    ) THEN
      ALTER TABLE profiles ADD COLUMN nome_completo text;
    END IF;
    
    -- Adiciona coluna documento_identidade se não existir
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'profiles' AND column_name = 'documento_identidade'
    ) THEN
      ALTER TABLE profiles ADD COLUMN documento_identidade text;
    END IF;
    
    -- Adiciona coluna nif_cpf se não existir
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'profiles' AND column_name = 'nif_cpf'
    ) THEN
      ALTER TABLE profiles ADD COLUMN nif_cpf text;
    END IF;
    
    -- Adiciona coluna estado_civil se não existir
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'profiles' AND column_name = 'estado_civil'
    ) THEN
      ALTER TABLE profiles ADD COLUMN estado_civil text;
    END IF;
    
    -- Adiciona coluna phone se não existir
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'profiles' AND column_name = 'phone'
    ) THEN
      ALTER TABLE profiles ADD COLUMN phone text;
    END IF;
    
    -- Adiciona coluna endereco se não existir
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'profiles' AND column_name = 'endereco'
    ) THEN
      ALTER TABLE profiles ADD COLUMN endereco text;
    END IF;
    
    -- Adiciona coluna pais se não existir
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'profiles' AND column_name = 'pais'
    ) THEN
      ALTER TABLE profiles ADD COLUMN pais text;
    END IF;
    
    -- Migra dados de 'nome' para 'nome_completo' se a coluna nome existir
    IF EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'profiles' AND column_name = 'nome'
    ) THEN
      UPDATE profiles SET nome_completo = nome WHERE nome_completo IS NULL AND nome IS NOT NULL;
    END IF;
    
  ELSE
    -- Cria tabela profiles do zero
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
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

COMMENT ON TABLE profiles IS 'Perfis de usuários com dados pessoais';

-- ============================================
-- 4. SEED: Organização Padrão
-- ============================================
INSERT INTO organizations (slug, name)
VALUES ('default', 'Formando Valores - Padrão')
ON CONFLICT (slug) DO NOTHING;
