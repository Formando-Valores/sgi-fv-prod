-- ============================================
-- SGI FV - Migration 005: RLS for Processes
-- ============================================
-- Data: 2026-02-22
-- Descrição: Políticas de segurança para processos
-- ============================================

-- ============================================
-- 1. HABILITAR RLS
-- ============================================
ALTER TABLE processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_events ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. POLICIES: processes
-- ============================================

-- Membros podem ver processos da sua organização
DROP POLICY IF EXISTS "Members can view org processes" ON processes;
CREATE POLICY "Members can view org processes"
  ON processes FOR SELECT
  USING (is_org_member(org_id));

-- Admins/Owners podem inserir processos
DROP POLICY IF EXISTS "Admins can insert processes" ON processes;
CREATE POLICY "Admins can insert processes"
  ON processes FOR INSERT
  WITH CHECK (is_org_admin(org_id));

-- Admins/Owners podem atualizar processos
DROP POLICY IF EXISTS "Admins can update processes" ON processes;
CREATE POLICY "Admins can update processes"
  ON processes FOR UPDATE
  USING (is_org_admin(org_id));

-- Admins/Owners podem deletar processos
DROP POLICY IF EXISTS "Admins can delete processes" ON processes;
CREATE POLICY "Admins can delete processes"
  ON processes FOR DELETE
  USING (is_org_admin(org_id));

-- ============================================
-- 3. POLICIES: process_events
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
