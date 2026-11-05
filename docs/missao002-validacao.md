# MISSÃO 002 — Relatório de validação (Segurança crítica)

Data: 2026-11-05 · Projeto Supabase de produção · Repositório `main` em `3dcbaa4` (PR #113)

> **Estado:** a validação **não está concluída**. As correções R-01 a R-05 estão ativas em produção e passaram nos testes negativos. Mas a análise do R-07 encontrou uma **vulnerabilidade crítica ativa** em produção: qualquer utilizador autenticado pode tornar-se *owner* de qualquer organização. A correção está proposta neste PR e **ainda não foi aplicada em produção**: aguarda autorização expressa do responsável.

> **⚠️ Regressão ativa (frontend desatualizado):** o site em produção (`sgi-fv-prod.vercel.app`, `version.json` buildTime 22/10/2026) é anterior ao PR #113. Esse frontend ainda envia a chave anónima e não o token da sessão para `create-process-client-user`, `update-user-org-membership` e `create-user` (ecrãs Processos, Clientes e Gestão). As funções corrigidas, já em produção, devolvem **401** a essas chamadas. **Consequência provável:** os admins não conseguem criar clientes em processos nem alterar vínculos até a Vercel publicar a `main`. O deploy deste PR também falhou na Vercel, em poucos segundos (`dpl_EqTuDf3ENqNRYWzp4fpM3Uj16Bbx`). A ligação Vercel ↔ Supabase não resolveu o bloqueio, que é de permissão do autor Git na equipa Vercel. **Ação:** o dono da equipa Vercel faz *Redeploy* da `main` no painel, ou adiciona `germanoreis2024-coder` à equipa. O registo pelo vainaai.pt **não** é afetado.

## 1. Lista de validação (12 critérios)

| # | Critério | Estado | Evidência |
|---|---|---|---|
| 1 | R-01 corrigido e testado contra utilizadores não autorizados | ✅ | `create-user` v22. Testes R01-a…d: apagar utilizador → 403; tomada de conta (e-mail existente + nova senha) → 409; elevação a Administrador → 409/403 |
| 2 | R-02 corrigido e testado contra alteração de organização e promoção a owner | ✅ | `update-user-org-membership` v5. R02-a/b: anónimo ou token forjado → 401. R02-c: cliente promove-se a owner → 403. R02-d: cliente muda-se para outra org como admin → 403 |
| 3 | R-03 corrigido e testado com utilizadores de outras organizações | ✅ | `create-process-client-user` v5. R03-a: anónimo → 401. R03-b: cliente da mesma org → 403. R03-c: processo de outra org → 403 |
| 4 | R-04 corrigido e testado contra envio de certificados para destinatários arbitrários | ✅ | `send-certificate` v11. R04-a: anónimo → 401. R04-b/c: cliente, processo alheio ou de outra org, com `clientEmail` arbitrário → 403 |
| 5 | R-05 corrigido e testado com valores manipulados | ✅ (parcial) | Checkout com `amount: 1` enviado pelo browser → `payments.amount = 30.00 EUR` (valor do servidor). Webhook sem assinatura Stripe → 400. **Não testado:** um evento de webhook assinado com valor divergente, porque exigiria o segredo do webhook ou o modo de teste da Stripe |
| 6 | R-07 analisado e conflito de policies resolvido de forma segura | ⚠️ Analisado, correção proposta, **não aplicada** | Ver secção 3. Migration `065` neste PR, validada em produção dentro de uma transação revertida |
| 7 | Regressão dos fluxos de autenticação, processos, pagamentos e certificados | ✅ (parcial) | Registo pelo vainaai.pt → 200, conta e processo criados, e-mail enviado (log). Login do cliente → sessão válida. Checkout → 200 (sessão Stripe live, 30 €). **Não testado:** pagamento real até ao fim, emissão de certificado de um processo pago, ecrãs do painel com papéis admin/staff |
| 8 | `npm run typecheck` sem erros | ✅ | Exit 0 em `main` (3dcbaa4) e neste ramo |
| 9 | `npm run build` com sucesso | ✅ | Exit 0, `✓ built in 2.29s` |
| 10 | Testes automatizados de segurança e autorização | ✅ | `vitest`: 3 ficheiros, 31/31. `tests/security/production/negative_authz.sh`: 15/15 PASS contra produção |
| 11 | PRs revistos e integrados só após aprovação | ⚠️ | O PR #113 já está integrado na `main`; não há registo de revisão formal no GitHub. Este PR (R-07) **não será integrado** sem a sua aprovação |
| 12 | Relatório final | ✅ | Este documento |

**Resultado: 8 critérios cumpridos, 3 parciais e 1 pendente da sua decisão (R-07).**

## 2. Testes negativos contra produção (15/15 PASS)

Script: `tests/security/production/negative_authz.sh`. Recebe credenciais e IDs por variáveis de ambiente. Usa uma conta cliente de teste da AI e um processo de outra organização. Nenhum teste altera dados quando as correções estão ativas.

| ID | Teste | Esperado | Obtido |
|---|---|---|---|
| R01-a | anónimo apaga utilizador | 401/403 | 403 |
| R01-b | anónimo: e-mail existente + nova senha | 409 | 409 |
| R01-c | anónimo cria Administrador | 403/409 | 409 |
| R01-d | cliente apaga utilizador | 401/403 | 403 |
| R02-a | anónimo → owner | 401 | 401 |
| R02-b | token forjado | 401 | 401 |
| R02-c | cliente → owner da própria org | 403 | 403 |
| R02-d | cliente → admin de outra org | 403 | 403 |
| R03-a | anónimo cria cliente em processo | 401 | 401 |
| R03-b | cliente (não staff) cria cliente | 403 | 403 |
| R03-c | processo de outra org | 403 | 403 |
| R04-a | anónimo → certificado para e-mail arbitrário | 401 | 401 |
| R04-b | cliente → certificado de processo alheio | 403 | 403 |
| R04-c | cliente → certificado de outra org | 403 | 403 |
| R05-b | webhook sem assinatura | 400 | 400 |
| R05-a | checkout com `amount: 1` | servidor ignora | gravado 30.00 EUR |

## 3. R-07 — conflito de policies (achado crítico)

- A migration `20260707022927_safe_uuid_queries.sql` recria policies de `org_members`, `profiles` e `organizations`. Em produção, as versões **corrigidas** das migrations 060/061 prevalecem: `Allow self insert on registration` e `Org admins can update organizations` têm a definição segura.
- **Problema encontrado:** em produção existe também a policy **legada** `Users can insert own membership`, com `WITH CHECK (user_id = auth.uid())`. Não vem de nenhuma migration: foi criada pelos scripts manuais `supabase/fix_base_tables.sql` / `FIX_ALL_UNIFIED.sql`. Como as policies PERMISSIVE se somam, esta anula a restrição da 060.
- **Prova:** simulação como o utilizador cliente de teste, dentro de uma transação revertida, com `INSERT org_members(org=Formando Valores, role=owner)` → **PERMITIDO**. Confirmei depois que nada ficou gravado (o utilizador continua só com `client` na AI).
- **Correção:** `supabase/migrations/065_drop_legacy_org_members_self_insert.sql` (`DROP POLICY`).
- **Validação da correção** (em produção, dentro de uma transação revertida; a policy continua a existir depois):
  - owner → BLOQUEADO;
  - admin → BLOQUEADO;
  - client (registo) → PERMITIDO.

  Os fluxos legítimos mantêm-se: registo, criação da própria org (060) e adição de membros por admins.
- Teste de regressão SQL: `supabase/tests/r07_org_members_policies.sql`.

## 4. Questões que continuam abertas

| ID | Estado verificado | Ação necessária |
|---|---|---|
| R-06 Migrations 057–061 | ✅ **Aplicadas** em produção. `schema_migrations` regista 057, 058, 059, 060, 061, 062, `safe_uuid_queries`, 063 e 064. A 049 não existe no repositório (salto de numeração). As policies em produção correspondem às da 060/061 | Nenhuma, além da 065 |
| R-08 Credencial Abacus | ❌ Não verificável por mim | Mudar a senha partilhada, criar contas individuais e ativar 2FA |
| R-09 Repositório público | ❌ Continua público. Este relatório não contém segredos, mas descreve vulnerabilidades | Tornar privado (GitHub → Settings → Danger zone). Confirmar antes que a integração Vercel ↔ GitHub continua autorizada |
| R-10 Backups e ambientes | ❌ Não há separação DEV/HML/PROD; os backups não foram testados | Missão 003 |
| F0-05 Aprovação de associados | ❌ Decisão administrativa | Hoje o registo é **automático** (conta + processo "aguardando pagamento") |

### Outros riscos encontrados durante a validação
1. **Um cliente pode juntar-se como `client` a qualquer organização** (policy 060, desenhada para o registo). Risco baixo: o papel `client` não vê dados de terceiros. Mesmo assim, recomenda-se que o registo passe a ser feito apenas pela Edge Function.
2. `organizations`: a policy `Scoped users can view organizations` permite que um admin de **qualquer** org veja **todas** as orgs (migration 051). Confirmar se isto é intencional.
3. **Deploy Vercel do frontend**: os deploys dos commits do autor `germanoreis2024-coder` falham antes do build (ver `docs/vercel-deploy-diagnostico-missao002.md`). O responsável disse que ligou a Vercel ao Supabase; o estado deste PR na Vercel confirma se o problema ficou resolvido.
4. **CI**: o passo `npm test` ainda não está no workflow (falta de permissão para `workflows`). É preciso acrescentá-lo manualmente.
5. **E-mail**: o domínio remetente no Resend não está verificado (risco de spam).
6. As funções `create-user` e `stripe-create-checkout-session` passaram a ter `config.toml` com `verify_jwt = false`, para que um deploy futuro não volte a partir o formulário do vainaai.pt. O formulário usa a chave publishable, e a autorização é feita dentro da função.

## 5. Ficheiros deste PR

- `supabase/migrations/065_drop_legacy_org_members_self_insert.sql` (nova, **não aplicada**)
- `supabase/tests/r07_org_members_policies.sql` (teste SQL com rollback)
- `supabase/functions/create-user/config.toml` (`verify_jwt = false`, igual a produção)
- `tests/security/production/negative_authz.sh` (15 testes negativos)
- `docs/missao002-validacao.md` (este relatório)

## 6. Para fechar a MISSÃO 002 (precisa da sua autorização)

1. Rever e aprovar este PR.
2. Autorizar a aplicação da migration 065 em produção (1 linha, reversível recriando a policy). Depois disso, volto a correr o teste SQL e os testes negativos.
3. Opcional: testar um pagamento em modo de teste da Stripe para validar o webhook com valor divergente.
4. Decidir sobre R-08, R-09 e F0-05.

A MISSÃO 003 não começa sem a sua validação.
