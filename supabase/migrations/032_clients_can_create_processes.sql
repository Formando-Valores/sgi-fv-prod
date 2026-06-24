-- ============================================
-- SGI FV - Migration 032: Clients can create processes
-- ============================================
-- Permite que usuarios com role 'client' criem processos
-- vinculados ao seu proprio cliente_user_id.
-- Admins continuam podendo criar processos com o escopo normal.

DROP POLICY IF EXISTS "Clients can insert their own processes" ON public.processes;
CREATE POLICY "Clients can insert their own processes"
  ON public.processes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM org_members om
      WHERE om.org_id = processes.org_id
        AND om.user_id = auth.uid()
        AND om.role = 'client'
    )
    AND processes.cliente_user_id = auth.uid()
  );
