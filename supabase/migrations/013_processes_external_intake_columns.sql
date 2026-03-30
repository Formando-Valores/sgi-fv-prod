-- ============================================
-- SGI FV - Migration 013: suporte a intake externo (Wix/outros)
-- ============================================

ALTER TABLE processes
  ADD COLUMN IF NOT EXISTS origem_canal text NOT NULL DEFAULT 'painel';

ALTER TABLE processes
  ADD COLUMN IF NOT EXISTS unidade_atendimento text;

ALTER TABLE processes
  ADD COLUMN IF NOT EXISTS org_nome_solicitado text;

CREATE INDEX IF NOT EXISTS idx_processes_origem_canal ON processes(origem_canal);
CREATE INDEX IF NOT EXISTS idx_processes_unidade_atendimento ON processes(unidade_atendimento);
