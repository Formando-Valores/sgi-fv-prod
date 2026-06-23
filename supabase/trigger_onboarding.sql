-- =====================================================
-- SGI FV - ONBOARDING AUTOMÁTICO
-- Trigger que vincula novos registros à organização
-- =====================================================
-- Execute no Supabase SQL Editor
-- =====================================================

-- Função executada quando um novo usuário é criado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  default_org_id uuid;
BEGIN
  -- Buscar ID da organização padrão
  SELECT id INTO default_org_id FROM organizations WHERE slug = 'default';

  IF default_org_id IS NULL THEN
    RAISE WARNING 'Organização padrão (slug=default) não encontrada. Profile criado sem vínculo.';
    INSERT INTO public.profiles (id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
    RETURN NEW;
  END IF;

  -- Criar profile
  INSERT INTO public.profiles (id, email, org_id)
  VALUES (NEW.id, NEW.email, default_org_id)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    org_id = EXCLUDED.org_id;

  -- Criar membership como client
  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES (default_org_id, NEW.id, 'client')
  ON CONFLICT (org_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover trigger existente se houver
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Criar trigger após INSERT em auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
-- SELECT trigger_name, event_manipulation, action_timing
-- FROM information_schema.triggers
-- WHERE event_object_schema = 'auth'
-- AND event_object_table = 'users';
