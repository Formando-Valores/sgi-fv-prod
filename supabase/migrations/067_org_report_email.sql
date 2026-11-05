-- ============================================================
-- Migration 067: e-mail de destino do relatório semanal por organização
-- ============================================================
-- Usado pela Edge Function weekly-org-report. Quando report_email está vazio,
-- a função usa o e-mail do owner/admin registado na organização.
--
-- ROLLBACK (executar manualmente para reverter):
--   ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_report_email_format;
--   ALTER TABLE public.organizations DROP COLUMN IF EXISTS report_email;
-- ============================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS report_email text;

ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_report_email_format;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_report_email_format
  CHECK (report_email IS NULL OR report_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

COMMENT ON COLUMN public.organizations.report_email IS
  'Destinatário do relatório semanal (weekly-org-report). Vazio = e-mail do owner/admin da organização.';

-- Formando Valores (organização padrão, slug 'default')
UPDATE public.organizations
SET report_email = 'contato@formandovalores.com'
WHERE slug = 'default'
  AND (report_email IS NULL OR report_email = '');

-- Associação contra as Injustiças – AI
UPDATE public.organizations
SET report_email = 'contato@vainaai.pt'
WHERE id = 'd535afe4-6279-40a9-aaa9-f5a7f6ee4825'
  AND (report_email IS NULL OR report_email = '');
