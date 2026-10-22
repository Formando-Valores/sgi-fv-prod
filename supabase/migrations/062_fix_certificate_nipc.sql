-- Migration 062: corrige NIPC placeholder do certificado da Associação contra as Injustiças - AI
UPDATE public.organizations
SET certificate_nipc = '519206550'
WHERE (certificate_nipc IS NULL OR certificate_nipc = 'XXXXXXXX')
  AND (name ILIKE '%injusti%' OR slug ILIKE '%injusti%');
