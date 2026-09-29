-- ============================================================
-- Fase 1 de segurança (Plano de Fecho V1) — organizations
--
-- A migration 046 deu a `anon` SELECT em toda a tabela organizations
-- (policy USING (true) + GRANT SELECT). Isso é necessário para o
-- formulário de registo listar organizações, mas a migration 053
-- acrescentou depois colunas de certificado (NIPC, morada, nome do
-- signatário, selo) que passaram a ser legíveis sem autenticação.
--
-- Correção: manter a policy, mas restringir o GRANT de `anon` às
-- colunas que os fluxos pré-login realmente usam:
--   - organizationRepository.ts (lista no registo): id, name, slug, is_active
--   - Register.tsx / Login.tsx / tenant.ts: id, name, slug
--
-- `authenticated` não é afetado.
--
-- Nota: com grants por coluna, `select=*` feito por `anon` passa a
-- falhar com "permission denied". O cliente foi ajustado para pedir
-- colunas explícitas.
-- ============================================================

REVOKE SELECT ON public.organizations FROM anon;
GRANT SELECT (id, name, slug, is_active) ON public.organizations TO anon;
