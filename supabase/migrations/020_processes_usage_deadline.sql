-- =============================================================================
-- SGI FV - Migration 020: prazo de uso para processos pagos
-- Data: 2026-04-22
-- Descrição:
--   1) Adiciona coluna usage_deadline_at para consolidar o prazo de uso no fluxo financeiro.
--   2) Garante regra clara para processos pagos:
--      - usar data_prazo quando existir;
--      - caso contrário, definir paid_at + 30 dias.
-- =============================================================================

ALTER TABLE public.processes
  ADD COLUMN IF NOT EXISTS usage_deadline_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_processes_usage_deadline_at
  ON public.processes(usage_deadline_at);

COMMENT ON COLUMN public.processes.usage_deadline_at IS
  'Prazo final de uso/acompanhamento financeiro do processo. Para pagamentos confirmados, usa data_prazo quando preenchida; caso contrário, paid_at + 30 dias.';

UPDATE public.processes
   SET usage_deadline_at = CASE
     WHEN data_prazo IS NOT NULL THEN (data_prazo::timestamp + interval '23 hours 59 minutes 59 seconds')
     WHEN paid_at IS NOT NULL THEN paid_at + interval '30 days'
     ELSE usage_deadline_at
   END
 WHERE payment_status = 'paid'
   AND (
     usage_deadline_at IS NULL
     OR (data_prazo IS NOT NULL AND usage_deadline_at::date <> data_prazo)
   );
