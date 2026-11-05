-- MISSÃO 002 — R-07 (conflito de policies)
-- Em produção existe a policy legada "Users can insert own membership"
-- (criada fora das migrations por supabase/fix_base_tables.sql / FIX_ALL_UNIFIED.sql),
-- com WITH CHECK (user_id = auth.uid()) e sem restrição de papel nem de organização.
-- Como as policies PERMISSIVE se somam (OR), ela anula a restrição introduzida pela 060
-- ("Allow self insert on registration": só 'client', ou 'owner' de uma org sem membros)
-- e permite que QUALQUER utilizador autenticado se torne owner/admin de QUALQUER organização.
-- Confirmado em produção a 2026-11-05 por simulação dentro de transação revertida.
--
-- Os fluxos legítimos continuam cobertos por:
--   * "Allow self insert on registration" (060) — registo e criação da própria organização;
--   * "Org admins can insert members"            — admins adicionam membros à sua organização;
--   * Edge Functions com service_role            — fluxos de servidor.

DROP POLICY IF EXISTS "Users can insert own membership" ON public.org_members;
