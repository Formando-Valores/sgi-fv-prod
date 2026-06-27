-- ============================================
-- SGI FV - Migration 041: Process Documents Bucket + Client RLS
-- ============================================

-- 1. Create storage bucket for process documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('process_documents', 'process_documents', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage policies for process_documents bucket
DROP POLICY IF EXISTS "Authenticated users can upload process documents" ON storage.objects;
CREATE POLICY "Authenticated users can upload process documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'process_documents');

DROP POLICY IF EXISTS "Authenticated users can view process documents" ON storage.objects;
CREATE POLICY "Authenticated users can view process documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'process_documents');

DROP POLICY IF EXISTS "Authenticated users can delete own process documents" ON storage.objects;
CREATE POLICY "Authenticated users can delete own process documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'process_documents' AND auth.uid() = owner);

-- 3. Allow clients to insert their own process document attachments
DROP POLICY IF EXISTS "Clients can insert own process document attachments" ON public.process_document_attachments;
CREATE POLICY "Clients can insert own process document attachments"
  ON public.process_document_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.user_id = auth.uid()
        AND om.org_id = process_document_attachments.org_id
    )
    AND uploaded_by = auth.uid()
  );

-- 4. Allow clients to view own process document attachments
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
