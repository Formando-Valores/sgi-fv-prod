-- ============================================
-- SGI FV - Migration 004: Processes Tables
-- ============================================
-- Data: 2026-02-22
-- Descrição: Tabelas de processos e eventos
-- ============================================

-- ============================================
-- 1. TABELA: processes
-- ============================================
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

COMMENT ON TABLE public.processes IS 'Processos administrativos da organização';
COMMENT ON COLUMN processes.status IS 'cadastro → triagem → analise → concluido';

-- ============================================
-- 2. TABELA: process_events
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

COMMENT ON TABLE public.process_events IS 'Timeline de eventos do processo';
COMMENT ON COLUMN process_events.tipo IS 'registro=criação, status_change=mudança de status, observacao=nota, documento=upload, atribuicao=mudança de responsável';

-- ============================================
-- 3. ÍNDICES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_processes_org_id ON processes(org_id);
CREATE INDEX IF NOT EXISTS idx_processes_status ON processes(status);
CREATE INDEX IF NOT EXISTS idx_processes_created_at ON processes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_process_events_process_id ON process_events(process_id);
CREATE INDEX IF NOT EXISTS idx_process_events_org_id ON process_events(org_id);
CREATE INDEX IF NOT EXISTS idx_process_events_created_at ON process_events(created_at DESC);

-- ============================================
-- 4. TRIGGER: updated_at automático
-- ============================================
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

-- ============================================
-- 5. FUNÇÃO: gerar protocolo automático
-- ============================================
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
