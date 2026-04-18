-- ============================================
-- SGI FV - Migration 016: persistência de prazo/gestor/observações
-- ============================================

ALTER TABLE processes
  ADD COLUMN IF NOT EXISTS data_prazo date;

ALTER TABLE processes
  ADD COLUMN IF NOT EXISTS gestor_servico text;

ALTER TABLE processes
  ADD COLUMN IF NOT EXISTS observacoes text;

CREATE INDEX IF NOT EXISTS idx_processes_data_prazo ON processes(data_prazo);
CREATE INDEX IF NOT EXISTS idx_processes_gestor_servico ON processes(gestor_servico);

COMMENT ON COLUMN processes.data_prazo IS 'Data de prazo definida no painel administrativo';
COMMENT ON COLUMN processes.gestor_servico IS 'Gestor/responsável de serviço definido no painel administrativo';
COMMENT ON COLUMN processes.observacoes IS 'Observações livres do processo preenchidas no modal de edição';
