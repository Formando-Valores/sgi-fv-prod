-- ============================================
-- SGI FV - DROP EXISTING RLS HELPER FUNCTIONS
-- ============================================
-- Execute ANTES do fix_base_tables.sql se houver erro:
-- "cannot change name of input parameter"
-- ============================================

-- Drop existing RLS helper functions
DROP FUNCTION IF EXISTS public.is_org_member(uuid);
DROP FUNCTION IF EXISTS public.is_org_admin(uuid);
DROP FUNCTION IF EXISTS public.get_user_org_id();

-- Verificação: deve retornar 0 linhas
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_schema = 'public' 
-- AND routine_name IN ('is_org_member', 'is_org_admin', 'get_user_org_id');
