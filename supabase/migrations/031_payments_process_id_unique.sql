-- ============================================
-- SGI FV - Migration 031: Unique process_id em payments
-- ============================================
-- O INSERT com ON CONFLICT (process_id) exige uma
-- constraint UNIQUE. Apenas o INDEX nao e suficiente.

-- Remove duplicatas de process_id mantendo o registro mais antigo
DELETE FROM public.payments
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY process_id ORDER BY created_at ASC, id ASC
    ) AS rn
    FROM public.payments
  ) sub
  WHERE rn > 1
);

-- Recria o index como UNIQUE
DROP INDEX IF EXISTS idx_payments_process_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_process_id
  ON public.payments(process_id);
