-- Migration 063 (MISSÃO 002): logotipo por organização no certificado de filiação
-- e NIPC sempre da própria organização.
-- Aceita um nome de ficheiro servido em /img (ex.: 'selo associação.png') ou um URL https absoluto.

ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS certificate_logo_url text;

COMMENT ON COLUMN public.organizations.certificate_logo_url IS
  'Logotipo da organização no cabeçalho do certificado (ficheiro em /img ou URL https). Se vazio usa certificate_seal_url.';

-- Associação contra as Injustiças: o selo oficial funciona também como logotipo
UPDATE public.organizations
SET certificate_logo_url = COALESCE(NULLIF(certificate_logo_url, ''), 'selo associação.png'),
    certificate_seal_url = COALESCE(NULLIF(certificate_seal_url, ''), 'selo associação.png'),
    certificate_nipc     = CASE WHEN certificate_nipc IS NULL OR certificate_nipc IN ('', 'XXXXXXXX') THEN '519206550' ELSE certificate_nipc END
WHERE name ILIKE '%injusti%' OR slug ILIKE '%injusti%';

-- Outras organizações com o placeholder 'XXXXXXXX' passam a NULL: o certificado omite o NIPC
-- em vez de imprimir o NIPC de outra entidade. Configure o NIPC real em Gestão > Organizações.
UPDATE public.organizations
SET certificate_nipc = NULL
WHERE certificate_nipc = 'XXXXXXXX'
  AND NOT (name ILIKE '%injusti%' OR slug ILIKE '%injusti%');
