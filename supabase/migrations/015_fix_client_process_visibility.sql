-- ============================================
-- SGI FV - Migration 015: Fix client process visibility
-- ============================================
-- Data: 2026-04-17
-- Problema: Clientes não conseguiam ver seus próprios processos
-- após refresh porque:
--   1. responsavel_user_id era setado com o ID do admin (não do cliente)
--   2. A policy 014 filtra por responsavel_user_id = auth.uid()
-- Solução:
--   - Adicionar coluna cliente_user_id para vínculo explícito
--   - Atualizar policies para aceitar ambos os campos
--   - Permitir que clientes insiram eventos nos seus processos
-- ============================================

-- 1. Adicionar coluna cliente_user_id para vínculo explícito cliente ↔ processo
ALTER TABLE processes
  ADD COLUMN IF NOT EXISTS cliente_user_id uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_processes_cliente_user_id ON processes(cliente_user_id);

COMMENT ON COLUMN processes.cliente_user_id IS 'ID do usuário cliente dono do processo (para RLS e visibilidade)';

-- 2. Migrar dados existentes: processos do portal_cliente onde responsavel_user_id
--    é um client → copiar para cliente_user_id
UPDATE processes p
SET cliente_user_id = p.responsavel_user_id
WHERE p.origem_canal = 'portal_cliente'
  AND p.responsavel_user_id IS NOT NULL
  AND p.cliente_user_id IS NULL
  AND EXISTS (
    SELECT 1 FROM org_members om
    WHERE om.org_id = p.org_id
      AND om.user_id = p.responsavel_user_id
      AND om.role = 'client'
  );

-- 3. Recriar policy de SELECT para processos: aceita cliente_user_id OU responsavel_user_id
DROP POLICY IF EXISTS "Clients can view their own processes" ON processes;

CREATE POLICY "Clients can view their own processes"
  ON processes FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM org_members om
      WHERE om.org_id = processes.org_id
        AND om.user_id = auth.uid()
        AND om.role = 'client'
    )
    AND (
      processes.cliente_user_id = auth.uid()
      OR processes.responsavel_user_id = auth.uid()
    )
  );

-- 4. Recriar policy de SELECT para process_events
DROP POLICY IF EXISTS "Clients can view events for own processes" ON process_events;

CREATE POLICY "Clients can view events for own processes"
  ON process_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM org_members om
      WHERE om.org_id = process_events.org_id
        AND om.user_id = auth.uid()
        AND om.role = 'client'
    )
    AND EXISTS (
      SELECT 1
      FROM processes p
      WHERE p.id = process_events.process_id
        AND (
          p.cliente_user_id = auth.uid()
          OR p.responsavel_user_id = auth.uid()
        )
    )
  );

-- 5. Permitir que clientes insiram eventos nos seus próprios processos
--    (necessário para logTimelineEvent no UserDashboard)
DROP POLICY IF EXISTS "Clients can insert events on own processes" ON process_events;

CREATE POLICY "Clients can insert events on own processes"
  ON process_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM org_members om
      WHERE om.org_id = process_events.org_id
        AND om.user_id = auth.uid()
        AND om.role = 'client'
    )
    AND EXISTS (
      SELECT 1
      FROM processes p
      WHERE p.id = process_events.process_id
        AND (
          p.cliente_user_id = auth.uid()
          OR p.responsavel_user_id = auth.uid()
        )
    )
  );
