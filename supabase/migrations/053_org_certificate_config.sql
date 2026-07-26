-- Migration 053: Add certificate configuration to organizations
-- Allows per-org certificate templates with custom name, NIPC, address, signatory, seal

ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS certificate_nipc text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS certificate_address text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS certificate_city text DEFAULT 'Lisboa – Portugal';
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS certificate_body_text text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS certificate_signatory_name text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS certificate_signatory_title text DEFAULT 'Advogado';
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS certificate_seal_url text;

COMMENT ON COLUMN public.organizations.certificate_nipc IS 'NIPC/pessoa coletiva used in certificate header and body';
COMMENT ON COLUMN public.organizations.certificate_address IS 'Sede address used in certificate';
COMMENT ON COLUMN public.organizations.certificate_city IS 'City/country used in certificate';
COMMENT ON COLUMN public.organizations.certificate_body_text IS 'Custom body text for certificate. Uses {orgName} placeholder.';
COMMENT ON COLUMN public.organizations.certificate_signatory_name IS 'Name of the signatory on the certificate';
COMMENT ON COLUMN public.organizations.certificate_signatory_title IS 'Title/role of the signatory (default: Advogado)';
COMMENT ON COLUMN public.organizations.certificate_seal_url IS 'URL or path to the organization seal/stamp image';

-- Seed: populate certificate fields for existing "Associação Contra as Injustiças - AI" org
UPDATE public.organizations
SET
  certificate_nipc = 'XXXXXXXX',
  certificate_address = '[Morada da Sede]',
  certificate_city = 'Lisboa – Portugal',
  certificate_signatory_name = 'Leonardo Saraiva Págio',
  certificate_signatory_title = 'Advogado',
  certificate_seal_url = 'selo associação.png'
WHERE name ILIKE '%injusti%'
   OR slug ILIKE '%injusti%'
   OR slug ILIKE '%ai%';

