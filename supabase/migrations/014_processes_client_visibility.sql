-- ============================================
-- SGI FV - Migration 014: Client process visibility by assignment
-- ============================================
-- Objetivo: manter acesso total para owner/admin/staff na org,
-- e restringir role client aos seus próprios processos/eventos.
-- Incremental: reaproveita org_members.role e responsavel_user_id já existentes.

-- ---------- processes (SELECT) ----------
DROP POLICY IF EXISTS "Members can view org processes" ON processes;
DROP POLICY IF EXISTS "Org team can view org processes" ON processes;
DROP POLICY IF EXISTS "Clients can view their own processes" ON processes;

CREATE POLICY "Org team can view org processes"
  ON processes FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM org_members om
      WHERE om.org_id = processes.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'staff')
    )
  );

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
    AND processes.responsavel_user_id = auth.uid()
  );

-- ---------- process_events (SELECT) ----------
DROP POLICY IF EXISTS "Members can view org process events" ON process_events;
DROP POLICY IF EXISTS "Org team can view org process events" ON process_events;
DROP POLICY IF EXISTS "Clients can view events for own processes" ON process_events;

CREATE POLICY "Org team can view org process events"
  ON process_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM org_members om
      WHERE om.org_id = process_events.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'staff')
    )
  );

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
        AND p.responsavel_user_id = auth.uid()
    )
  );
