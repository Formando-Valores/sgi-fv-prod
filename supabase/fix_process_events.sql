-- ============================================
-- FIX: Create process_events table
-- ============================================
-- Execute este script no SQL Editor do Supabase
-- URL: https://supabase.com/dashboard/project/[seu-projeto]/sql/new
-- ============================================

-- ============================================
-- PASSO 1: Verificar tabelas existentes
-- ============================================
-- Execute isto primeiro para ver o estado atual:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' ORDER BY table_name;

-- ============================================
-- PASSO 2: Criar tabela process_events
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

-- ============================================
-- PASSO 3: Comentários da tabela
-- ============================================
COMMENT ON TABLE public.process_events IS 'Timeline de eventos do processo';
COMMENT ON COLUMN process_events.tipo IS 'registro=criação, status_change=mudança de status, observacao=nota, documento=upload, atribuicao=mudança de responsável';

-- ============================================
-- PASSO 4: Índices para performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_process_events_process_id ON process_events(process_id);
CREATE INDEX IF NOT EXISTS idx_process_events_org_id ON process_events(org_id);
CREATE INDEX IF NOT EXISTS idx_process_events_created_at ON process_events(created_at DESC);

-- ============================================
-- PASSO 5: Habilitar Row Level Security
-- ============================================
ALTER TABLE process_events ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PASSO 6: Políticas de acesso (RLS)
-- ============================================

-- Membros podem ver eventos da sua organização
DROP POLICY IF EXISTS "Members can view org process events" ON process_events;
CREATE POLICY "Members can view org process events"
  ON process_events FOR SELECT
  USING (is_org_member(org_id));

-- Admins/Owners podem inserir eventos
DROP POLICY IF EXISTS "Admins can insert process events" ON process_events;
CREATE POLICY "Admins can insert process events"
  ON process_events FOR INSERT
  WITH CHECK (is_org_admin(org_id));

-- Admins/Owners podem atualizar eventos  
DROP POLICY IF EXISTS "Admins can update process events" ON process_events;
CREATE POLICY "Admins can update process events"
  ON process_events FOR UPDATE
  USING (is_org_admin(org_id));

-- ============================================
-- PASSO 7: Permissões de acesso
-- ============================================
GRANT SELECT ON process_events TO authenticated;
GRANT INSERT ON process_events TO authenticated;
GRANT UPDATE ON process_events TO authenticated;

-- ============================================
-- VERIFICAÇÃO FINAL
-- ============================================
-- Execute para confirmar que a tabela foi criada:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'process_events';
