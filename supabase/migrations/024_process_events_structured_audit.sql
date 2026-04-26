-- ============================================
-- SGI FV - Migration 024: Structured process audit events
-- ============================================
-- Data: 2026-04-26
-- Descrição: Evolui process_events com campos estruturados de auditoria e RLS por organização/escopo do usuário
-- ============================================

ALTER TABLE public.process_events
  ADD COLUMN IF NOT EXISTS actor_user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS field text,
  ADD COLUMN IF NOT EXISTS old_value text,
  ADD COLUMN IF NOT EXISTS new_value text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.process_events
SET actor_user_id = COALESCE(actor_user_id, created_by)
WHERE actor_user_id IS NULL;

UPDATE public.process_events
SET event_type = COALESCE(
  event_type,
  CASE tipo
    WHEN 'registro' THEN 'process_created'
    WHEN 'status_change' THEN 'status_changed'
    WHEN 'observacao' THEN 'note_added'
    WHEN 'documento' THEN 'document_attached'
    WHEN 'atribuicao' THEN 'assignee_changed'
    ELSE 'event_logged'
  END
)
WHERE event_type IS NULL;

ALTER TABLE public.process_events
  ALTER COLUMN actor_user_id SET NOT NULL,
  ALTER COLUMN event_type SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_process_events_actor_user_id ON public.process_events(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_process_events_event_type ON public.process_events(event_type);

DROP POLICY IF EXISTS "Members can view org process events" ON public.process_events;
CREATE POLICY "Members can view org process events"
  ON public.process_events
  FOR SELECT
  USING (is_org_member(org_id));

DROP POLICY IF EXISTS "Admins can insert process events" ON public.process_events;
DROP POLICY IF EXISTS "Members can insert own process events" ON public.process_events;
CREATE POLICY "Members can insert own process events"
  ON public.process_events
  FOR INSERT
  WITH CHECK (
    is_org_member(org_id)
    AND actor_user_id = auth.uid()
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Admins can update process events" ON public.process_events;
DROP POLICY IF EXISTS "Admins can delete process events" ON public.process_events;
