-- 027_process_documents_workflow.sql
-- Checklist obrigatório por serviço/OS e anexos por processo/OS com workflow de validação

CREATE TABLE IF NOT EXISTS public.service_order_document_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_id uuid NOT NULL,
  document_name text NOT NULL,
  description text,
  is_required boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, service_id, document_name)
);

CREATE INDEX IF NOT EXISTS idx_sodc_org_service ON public.service_order_document_checklists(org_id, service_id);

CREATE TABLE IF NOT EXISTS public.process_document_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  process_id uuid NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  service_order_id uuid,
  checklist_id uuid REFERENCES public.service_order_document_checklists(id) ON DELETE SET NULL,
  document_name text NOT NULL,
  file_path text NOT NULL,
  file_type text,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  validation_status text NOT NULL DEFAULT 'pending' CHECK (validation_status IN ('pending','approved','rejected','resubmission_requested')),
  pending_reason text,
  reviewer_user_id uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  review_notes text,
  guidance text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pda_org_process ON public.process_document_attachments(org_id, process_id);
CREATE INDEX IF NOT EXISTS idx_pda_pending ON public.process_document_attachments(org_id, validation_status) WHERE validation_status IN ('pending','resubmission_requested');

ALTER TABLE public.process_document_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view process document attachments" ON public.process_document_attachments;
CREATE POLICY "Org members can view process document attachments"
  ON public.process_document_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.user_id = auth.uid()
        AND om.org_id = process_document_attachments.org_id
    )
  );

DROP POLICY IF EXISTS "Org team can insert process document attachments" ON public.process_document_attachments;
CREATE POLICY "Org team can insert process document attachments"
  ON public.process_document_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.user_id = auth.uid()
        AND om.org_id = process_document_attachments.org_id
        AND om.role IN ('owner','admin','staff')
    )
  );

DROP POLICY IF EXISTS "Org team can update process document attachments" ON public.process_document_attachments;
CREATE POLICY "Org team can update process document attachments"
  ON public.process_document_attachments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.user_id = auth.uid()
        AND om.org_id = process_document_attachments.org_id
        AND om.role IN ('owner','admin','staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.user_id = auth.uid()
        AND om.org_id = process_document_attachments.org_id
        AND om.role IN ('owner','admin','staff')
    )
  );
