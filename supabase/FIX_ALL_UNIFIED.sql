-- =====================================================
-- SGI FV - CORREÇÃO UNIFICADA (NÃO DESTRUTIVA)
-- =====================================================
-- Preserva dados existentes. Corrige apenas estrutura.
-- Execute NO SQL Editor do Supabase.
-- =====================================================

-- ============================================
-- PASSO 1: DROP FUNÇÕES COM CASCADE
-- Remove funções antigas + policies dependentes
-- ============================================
DROP FUNCTION IF EXISTS public.is_org_member(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_org_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_org_id() CASCADE;

-- ============================================
-- PASSO 2: GARANTIR TABELAS BASE EXISTEM
-- (CREATE IF NOT EXISTS - preserva dados)
-- ============================================

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_members (
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text CHECK (role IN ('owner','admin','staff','client')) NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

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
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'org_id') THEN
      ALTER TABLE profiles ADD COLUMN org_id uuid REFERENCES organizations(id);
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'nome_completo') THEN
      ALTER TABLE profiles ADD COLUMN nome_completo text;
    END IF;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- ============================================
-- PASSO 3: ORGANIZAÇÃO PADRÃO (só se não existir)
-- ============================================
INSERT INTO organizations (slug, name)
VALUES ('default', 'Organização Padrão')
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- PASSO 4: RECRIAR FUNÇÕES HELPER RLS
-- ============================================

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

GRANT EXECUTE ON FUNCTION is_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_org_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_org_id() TO authenticated;

-- ============================================
-- PASSO 5: HABILITAR RLS E POLÍTICAS
-- ============================================

ALTER TABLE IF EXISTS organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;

-- Limpar policies existentes
DROP POLICY IF EXISTS "Members can view their organization" ON organizations;
DROP POLICY IF EXISTS "Allow read default org" ON organizations;
DROP POLICY IF EXISTS "Members can view their org" ON organizations;

DROP POLICY IF EXISTS "Users can view their own memberships" ON org_members;
DROP POLICY IF EXISTS "Org admins can view all org members" ON org_members;
DROP POLICY IF EXISTS "Org admins can insert members" ON org_members;
DROP POLICY IF EXISTS "Org admins can update members" ON org_members;
DROP POLICY IF EXISTS "Org admins can delete members" ON org_members;
DROP POLICY IF EXISTS "Allow self insert on registration" ON org_members;
DROP POLICY IF EXISTS "Users can view memberships" ON org_members;
DROP POLICY IF EXISTS "Members can view org memberships" ON org_members;
DROP POLICY IF EXISTS "Users can view own membership" ON org_members;
DROP POLICY IF EXISTS "Members can view org members" ON org_members;
DROP POLICY IF EXISTS "Admins can manage org members" ON org_members;

DROP POLICY IF EXISTS "Users can view profiles in their org" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Org admins can update org profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Org admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Members can view org profiles" ON profiles;

-- 5.1 ORGANIZATIONS
CREATE POLICY "Members can view their organization"
  ON organizations FOR SELECT
  USING (is_org_member(id) OR slug = 'default');

-- 5.2 ORG_MEMBERS
CREATE POLICY "Users can view their own memberships"
  ON org_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Members can view org memberships"
  ON org_members FOR SELECT
  USING (is_org_member(org_id));

CREATE POLICY "Users can insert own membership"
  ON org_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage members"
  ON org_members FOR ALL
  USING (is_org_admin(org_id));

-- 5.3 PROFILES
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Members can view org profiles"
  ON profiles FOR SELECT
  USING (is_org_member(org_id));

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

GRANT ALL ON organizations TO authenticated;
GRANT ALL ON org_members TO authenticated;
GRANT ALL ON profiles TO authenticated;

-- ============================================
-- PASSO 6: CORRIGIR ESTRUTURA org_members
-- Adiciona coluna id como PK independente
-- ============================================

ALTER TABLE org_members
ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

UPDATE org_members SET id = gen_random_uuid() WHERE id IS NULL;

ALTER TABLE org_members ALTER COLUMN id SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.org_members'::regclass
    AND contype = 'p'
  ) THEN
    ALTER TABLE org_members DROP CONSTRAINT IF EXISTS org_members_pkey;
  END IF;
END $$;

ALTER TABLE org_members ADD PRIMARY KEY (id);
ALTER TABLE org_members DROP CONSTRAINT IF EXISTS org_members_org_id_user_id_key;
ALTER TABLE org_members ADD CONSTRAINT org_members_org_id_user_id_key UNIQUE (org_id, user_id);

-- ============================================
-- PASSO 7: CORRIGIR ROLES INVÁLIDAS
-- ============================================

DO $$
BEGIN
  ALTER TABLE org_members DROP CONSTRAINT IF EXISTS org_members_role_check;
  ALTER TABLE org_members ADD CONSTRAINT org_members_role_check
    CHECK (role IN ('owner', 'admin', 'staff', 'client'));
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Aviso constraint role: %', SQLERRM;
END $$;

-- Corrige roles inválidas (ex: 'authenticated') para 'admin'
UPDATE org_members
SET role = 'admin'
WHERE role NOT IN ('owner', 'admin', 'staff', 'client');

-- Corrige id duplicado (quando id = user_id)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id, user_id FROM org_members WHERE id = user_id
  LOOP
    UPDATE org_members SET id = gen_random_uuid() WHERE id = r.id;
  END LOOP;
END $$;

-- ============================================
-- PASSO 8: CRIAR process_events (se não existir)
-- ============================================

CREATE TABLE IF NOT EXISTS public.process_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  process_id uuid NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('registro','status_change','observacao','documento','atribuicao')),
  mensagem text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_process_events_process_id ON process_events(process_id);
CREATE INDEX IF NOT EXISTS idx_process_events_org_id ON process_events(org_id);
CREATE INDEX IF NOT EXISTS idx_process_events_created_at ON process_events(created_at DESC);

ALTER TABLE process_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view org process events" ON process_events;
DROP POLICY IF EXISTS "Admins can insert process events" ON process_events;
DROP POLICY IF EXISTS "Admins can update process events" ON process_events;

CREATE POLICY "Members can view org process events"
  ON process_events FOR SELECT
  USING (is_org_member(org_id));

CREATE POLICY "Admins can insert process events"
  ON process_events FOR INSERT
  WITH CHECK (is_org_admin(org_id));

CREATE POLICY "Admins can update process events"
  ON process_events FOR UPDATE
  USING (is_org_admin(org_id));

GRANT SELECT, INSERT, UPDATE ON process_events TO authenticated;

-- ============================================
-- PASSO 9: CORRIGIR MIGRAÇÕES PENDENTES
-- 003_v_user_context, 004_processes, 005_rls_processes
-- ============================================

-- Migration 003: View v_user_context
CREATE OR REPLACE VIEW public.v_user_context AS
SELECT 
  p.id as user_id,
  p.email,
  p.nome_completo,
  p.org_id,
  om.role as org_role,
  o.slug as org_slug,
  o.name as org_name
FROM profiles p
LEFT JOIN org_members om ON om.user_id = p.id AND om.org_id = p.org_id
LEFT JOIN organizations o ON o.id = p.org_id;

GRANT SELECT ON public.v_user_context TO authenticated;

-- Migration 004: Tabela processes + trigger
CREATE TABLE IF NOT EXISTS public.processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  protocolo text UNIQUE,
  status text NOT NULL DEFAULT 'cadastro' CHECK (status IN ('cadastro','triagem','analise','concluido')),
  cliente_nome text,
  cliente_documento text,
  cliente_contato text,
  responsavel_user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processes_org_id ON processes(org_id);
CREATE INDEX IF NOT EXISTS idx_processes_status ON processes(status);
CREATE INDEX IF NOT EXISTS idx_processes_created_at ON processes(created_at DESC);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_processes_updated_at ON processes;
CREATE TRIGGER update_processes_updated_at
  BEFORE UPDATE ON processes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION generate_protocol()
RETURNS TRIGGER AS $$
DECLARE
  year_str text;
  seq_num int;
  new_protocol text;
BEGIN
  IF NEW.protocolo IS NULL THEN
    year_str := to_char(now(), 'YYYY');
    SELECT COALESCE(MAX(
      CAST(SUBSTRING(protocolo FROM 'SGI-' || year_str || '-([0-9]+)') AS int)
    ), 0) + 1
    INTO seq_num
    FROM processes
    WHERE protocolo LIKE 'SGI-' || year_str || '-%';
    NEW.protocolo := 'SGI-' || year_str || '-' || LPAD(seq_num::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_protocol ON processes;
CREATE TRIGGER trigger_generate_protocol
  BEFORE INSERT ON processes
  FOR EACH ROW
  EXECUTE FUNCTION generate_protocol();

-- Migration 005: RLS policies for processes
ALTER TABLE processes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view org processes" ON processes;
DROP POLICY IF EXISTS "Admins can insert processes" ON processes;
DROP POLICY IF EXISTS "Admins can update processes" ON processes;
DROP POLICY IF EXISTS "Admins can delete processes" ON processes;

CREATE POLICY "Members can view org processes"
  ON processes FOR SELECT
  USING (is_org_member(org_id));

CREATE POLICY "Admins can insert processes"
  ON processes FOR INSERT
  WITH CHECK (is_org_admin(org_id));

CREATE POLICY "Admins can update processes"
  ON processes FOR UPDATE
  USING (is_org_admin(org_id));

CREATE POLICY "Admins can delete processes"
  ON processes FOR DELETE
  USING (is_org_admin(org_id));

-- ============================================
-- VERIFICAÇÃO (descomente para executar)
-- ============================================
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name IN
--   ('organizations','profiles','org_members','processes','process_events')
-- ORDER BY table_name;
-- 
-- SELECT proname FROM pg_proc
-- WHERE proname IN ('is_org_member','is_org_admin','get_user_org_id');
-- 
-- SELECT tablename, policyname FROM pg_policies ORDER BY tablename;
-- 
-- SELECT u.email, o.name as org_name, om.role
-- FROM auth.users u
-- LEFT JOIN profiles p ON p.id = u.id
-- LEFT JOIN org_members om ON om.user_id = u.id
-- LEFT JOIN organizations o ON o.id = om.org_id
-- ORDER BY u.email;
