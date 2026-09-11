-- ============================================
-- SGI FV - Migration 057: Buckets privados + acesso por URL assinada
-- ============================================
-- Data: 2026-09-11
-- Descrição:
--   - Torna o bucket `process_documents` privado (era public = true na 041,
--     expondo documentos de identidade, NIF e comprovativos por URL sem auth)
--   - Substitui as policies permissivas de `process_documents` (qualquer
--     autenticado lia/escrevia em qualquer caminho) por policies ligadas à
--     visibilidade do processo dono do objeto
--   - Restringe a leitura de `payment_proofs` à organização do processo
--     (antes: qualquer owner/admin/staff de QUALQUER organização)
--
-- Sem backfill de dados: o frontend aceita tanto o caminho do objeto (novos
-- registros) quanto a URL pública completa (registros antigos) e assina ambos.
--
-- ATENÇÃO: URLs públicas de `process_documents` já compartilhadas por fora do
-- sistema (email, WhatsApp) deixam de funcionar após esta migração.
-- ============================================

-- --------------------------------------------
-- 1. Bucket privado
-- --------------------------------------------
UPDATE storage.buckets SET public = false WHERE id = 'process_documents';

-- --------------------------------------------
-- 2. Helpers de autorização por caminho
-- --------------------------------------------
-- SECURITY INVOKER: as funções herdam o RLS de `processes` e `org_members`,
-- mantendo a visibilidade de processo como fonte única de verdade.

-- Layouts de caminho aceitos em process_documents:
--   documentos           -> <org_id>/<process_id>/<user_id>/<arquivo>
--   anexos de comunicação-> <process_id>/comunicacao/<arquivo>
CREATE OR REPLACE FUNCTION public.can_access_process_storage_object(object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, storage
AS $$
DECLARE
  parts text[];
BEGIN
  parts := storage.foldername(object_name);

  IF array_length(parts, 1) IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.processes p
    WHERE (p.org_id::text = parts[1] AND p.id::text = COALESCE(parts[2], ''))
       OR p.id::text = parts[1]
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_access_process_storage_object(text) TO authenticated;

-- Layout de caminho em payment_proofs: <user_id>/<process_id>/<arquivo>
CREATE OR REPLACE FUNCTION public.can_manage_payment_proof_object(object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, storage
AS $$
DECLARE
  parts text[];
BEGIN
  parts := storage.foldername(object_name);

  IF array_length(parts, 1) IS NULL OR parts[2] IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.processes p
    JOIN public.org_members om
      ON om.org_id = p.org_id
     AND om.user_id = auth.uid()
    WHERE p.id::text = parts[2]
      AND om.role IN ('owner', 'admin', 'staff')
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_payment_proof_object(text) TO authenticated;

-- --------------------------------------------
-- 3. Policies de process_documents
-- --------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can upload process documents" ON storage.objects;
CREATE POLICY "Process members can upload process documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'process_documents'
    AND public.can_access_process_storage_object(name)
  );

DROP POLICY IF EXISTS "Authenticated users can view process documents" ON storage.objects;
CREATE POLICY "Process members can view process documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'process_documents'
    AND public.can_access_process_storage_object(name)
  );

DROP POLICY IF EXISTS "Authenticated users can delete own process documents" ON storage.objects;
CREATE POLICY "Owners and org admins can delete process documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'process_documents'
    AND (
      auth.uid() = owner
      OR public.is_org_admin((storage.foldername(name))[1])
    )
  );

-- --------------------------------------------
-- 4. Policies de payment_proofs
-- --------------------------------------------
-- Upload continua livre para autenticados, mas apenas na própria pasta.
DROP POLICY IF EXISTS "authenticated_upload_payment_proofs" ON storage.objects;
CREATE POLICY "users_upload_own_payment_proofs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'payment_proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Leitura de staff limitada à organização do processo (antes: qualquer org).
DROP POLICY IF EXISTS "staff_read_all_proofs" ON storage.objects;
CREATE POLICY "staff_read_org_payment_proofs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment_proofs'
    AND public.can_manage_payment_proof_object(name)
  );

-- "users_read_own_proofs" (migração 039) permanece inalterada.
