# Auditoria de Segurança — Fase 1

**Data:** 21/09/2026
**Auditor:** Juan Segundo Sousa
**Âmbito:** repositório `sgi-fv-prod` @ `e8f3e20` (análise estática de código e migrations)
**Plano:** `docs/plano-fecho-v1.md`, Fase 1

> **Limitação:** esta auditoria é estática — feita sobre o código e as migrations do
> repositório. Não foi executada contra a base de dados de produção. Os itens marcados
> `A CONFIRMAR EM PRODUÇÃO` exigem acesso aos painéis e à BD, que ainda não está atribuído
> (tarefa `F0-03`).

---

## Resumo

| | |
|---|---|
| Falhas confirmadas e corrigidas | 2 |
| Verificações passadas | 4 |
| Pendentes de acesso a produção | 6 |

---

## Falhas confirmadas

### V-01 · Tabela sem RLS expõe dados entre organizações — **CORRIGIDO**

**Severidade:** Média
**Tabela:** `service_order_document_checklists`

A tabela foi criada na migration `027_process_documents_workflow.sql` com coluna `org_id`,
mas **nunca teve RLS ativado nem policies** — ao contrário da tabela irmã
`process_document_attachments`, criada no mesmo ficheiro, que tem ambos (linhas 43-86).

É consultada diretamente do browser em `src/lib/processes.ts:1121`
(`listRequiredChecklistDocuments`), filtrada apenas por `.eq('org_id', org_id)` na camada de
aplicação. Esse filtro é trivialmente contornável: qualquer utilizador autenticado pode
chamar o PostgREST diretamente com outro `org_id` e obter a checklist de documentos de
qualquer outra organização.

O conteúdo exposto é metadado de configuração (nomes e descrições dos documentos exigidos
por serviço), não dados pessoais — daí a severidade média e não alta. Mas é uma quebra real
de isolamento multi-tenant, exatamente a classe de falha que a secção 9 do Relatório Mestre
manda auditar.

**Correção:** `supabase/migrations/057_security_rls_checklists_and_audit.sql` — ativa RLS e
cria as quatro policies, replicando o modelo já usado na tabela irmã.

---

### V-02 · Policy de INSERT sem restrição de role permite poluir o log de auditoria — **CORRIGIDO**

**Severidade:** Média
**Tabela:** `financial_audit_notifications`

A migration `056_security_rls_financial_tables.sql` — parte do commit de hardening
`e8f3e20` — criou:

```sql
CREATE POLICY "service_role_insert_audit_notifications"
  ON public.financial_audit_notifications FOR INSERT
  WITH CHECK (true);
```

O nome indica a intenção de restringir ao `service_role`, mas **a policy não tem cláusula
`TO`**, pelo que em PostgreSQL se aplica a `PUBLIC`. Resultado: qualquer utilizador
autenticado pode inserir notificações de auditoria financeira arbitrárias, para qualquer
`org_id`.

Acresce que a policy é desnecessária para o fim a que se destina: o `service_role` ignora
RLS por definição, pelo que as Edge Functions nunca precisaram dela.

O impacto é sobre a **integridade do log de auditoria** — precisamente o registo que o
Relatório Mestre quer usar como evidência de conformidade.

**Correção:** policy removida na migration `057`. Os inserts legítimos continuam a funcionar
via `service_role`.

---

### V-03 · Constante de credenciais sem uso — **CORRIGIDO**

**Severidade:** Informativa

`constants.ts` mantinha `export const ADMIN_CREDENTIALS: string[] = []`, resíduo da limpeza
feita em `e8f3e20`. Sem utilizações em todo o código. Removido para que não volte a ser
preenchido por engano.

---

## Verificações passadas

### OK-01 · Cifra das chaves Stripe por organização

`supabase/functions/stripe-config/index.ts` implementa **AES-256-GCM** com IV aleatório de
12 bytes por operação, formato `iv_hex:ciphertext_hex`. A chave-mestra
(`STRIPE_CONFIG_ENCRYPTION_KEY`) é lida exclusivamente em Edge Functions
(`stripe-config/index.ts`, `_shared/payments/getOrgStripeConfig.ts`) e **nunca chega ao
browser**. O frontend acede via Edge Function e recebe apenas `secret_key_last4`.

A RLS de `org_stripe_config` (migration `052`) está corretamente limitada a `owner`/`admin`
da própria organização, mais superadmin.

**Verdicto:** implementação correta. Sem alterações necessárias.

### OK-02 · Webhook do Stripe não está duplicado

Existem dois ficheiros, mas `api/stripe-webhook.js` (Vercel) é um **proxy**: lê o body cru,
preserva o header `stripe-signature` e reencaminha para a Edge Function
`supabase/functions/stripe-webhook/index.ts`, onde a assinatura é validada. **Não há risco de
duplo processamento.**

A Edge Function tem idempotência correta, via consulta a `raw_webhook_event_id` antes de
processar (linhas 153-161), devolvendo `{ duplicated: true }` em eventos repetidos.

Fica como pendência menor (`S-05`) confirmar qual endpoint está registado no painel Stripe:
se apontar diretamente para o Supabase, o proxy da Vercel é um salto desnecessário e deve
ser removido.

### OK-03 · Sem segredos no histórico do Git

Varrimento dos 709 commits à procura de `sk_live`, `sk_test`, `service_role` e JWTs
(`eyJhbGciOiJIUzI1NiIs`): **apenas placeholders e documentação**. Nenhum segredo real
commitado.

As variáveis de ambiente estão corretamente usadas: `supabase.ts` lê
`import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, e as Edge Functions usam
`Deno.env.get()` para as 21 variáveis identificadas.

### OK-04 · A migration `049` nunca existiu

O salto na numeração (`048` → `050`) foi verificado no histórico do Git: nenhuma migration
`049` foi alguma vez criada ou apagada. É apenas um salto de numeração, **não uma migration
perdida**. Mantém-se a necessidade de comparar o schema de produção com as migrations do
repositório (`S-07`), mas sem o risco que se suspeitava.

---

## Pendentes — exigem acesso a produção

Estes itens não podem ser fechados por análise estática.

| ID | Item | O que falta |
|---|---|---|
| S-01 | Rotação de credenciais expostas em WhatsApp/e-mail | Acesso aos painéis. **A senha do Abacus.AI foi enviada em texto claro por e-mail em 10/09/2026, numa conta partilhada por 4 pessoas — deve ser considerada comprometida.** |
| S-02 | Contas individuais + 2FA | Decisão de gestão + acesso de administração |
| S-03 | Execução do teste de acesso cruzado | Criar 2 orgs e 2 utilizadores de teste e correr `scripts/audit-rls-crosstenant.mjs` |
| S-07 | Schema de produção vs. migrations | Acesso à BD |
| S-08 | Buckets de Storage privados e signed URLs | Confirmar no painel; validar `041_process_documents_bucket.sql` contra o estado real |
| S-09 | Backups automáticos + teste de restauro | Painel Supabase |
| S-10 | Separação DEV / HOMOLOGAÇÃO / PRODUÇÃO | Decisão de arquitetura + provisionamento |

---

## Observações fora do âmbito da Fase 1

Registadas aqui porque foram detetadas durante a auditoria, mas pertencem à Fase 2.

**Exposição pública da tabela `organizations`.** A migration `046` cria
`"Anyone can view organizations" USING (true)` com `GRANT SELECT ON organizations TO anon`.
Isto é presumivelmente intencional (o formulário de registo precisa de listar organizações),
mas a migration `053` adicionou depois à mesma tabela as colunas `certificate_nipc`,
`certificate_address`, `certificate_signatory_name` e outras. **Essas colunas passaram a ser
legíveis por utilizadores não autenticados.** Recomenda-se restringir o acesso anónimo a uma
vista com apenas `id`, `slug` e `name`. Não é uma fuga entre tenants e os dados são de
natureza empresarial, não pessoal — daí ficar fora da Fase 1, mas deve ser corrigido.

**72 erros de tipos no código da aplicação.** `npx tsc --noEmit` devolve 72 erros fora de
`supabase/functions` (mais 132 dentro, que são ruído: o `tsconfig.json` inclui código Deno
que não devia typecheckar com a config do browser). Vários são suspeitos de indicarem bugs
reais e não apenas tipos desatualizados, por exemplo
`Property 'os_value' does not exist on type 'Process'` e
`Property 'cliente_user_id' does not exist on type 'Process'` em `pages/AdminDashboard.tsx`.
O build passa porque o Vite não faz typecheck. Tratar em `Q-01` (excluir `supabase/functions`
do tsconfig do browser e adicionar script de `typecheck`) antes de avaliar um a um.

---

## Alterações produzidas

| Ficheiro | Descrição |
|---|---|
| `supabase/migrations/057_security_rls_checklists_and_audit.sql` | Corrige V-01 e V-02 |
| `constants.ts` | Remove `ADMIN_CREDENTIALS` (V-03) |
| `scripts/audit-rls-crosstenant.mjs` | Teste de acesso cruzado entre tenants (evidência de `S-03`) |
| `docs/auditoria-seguranca-fase1.md` | Este relatório |

Build verificado após as alterações: `npm run build` ✓
