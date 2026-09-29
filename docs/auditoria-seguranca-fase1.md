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
| Decisões de gestão levantadas | 1 |
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

### V-04 · Repositório público — **DECISÃO DE GESTÃO**

**Severidade:** A decidir pela gestão
**Recurso:** `github.com/Formando-Valores/sgi-fv-prod`

A API do GitHub devolve `"private": false`. O repositório do SIGA-FV está **acessível a
qualquer pessoa na internet**.

Não é, em si, uma vulnerabilidade: a verificação `OK-03` confirmou que não há segredos
commitados, e o modelo de segurança do sistema não depende do código ser secreto. Mas fica
publicamente legível:

- o esquema completo da base de dados (57 migrations), incluindo todas as policies de RLS —
  o que permite a um atacante estudar as regras de isolamento offline, sem tentativa e erro;
- a lógica de pagamentos e o tratamento dos webhooks do Stripe;
- os nomes das 21 variáveis de ambiente, úteis para um ataque dirigido;
- a documentação interna em `docs/`, incluindo este relatório de auditoria e o
  `docs/plano-fecho-v1.md`, que enumera as pendências de segurança ainda por corrigir.

O último ponto é o mais relevante a curto prazo: **enquanto as tarefas `S-01` a `S-10`
estiverem abertas, publicá-las é divulgar as fraquezas conhecidas do sistema**.

Há ainda uma contradição a registar: o e-mail de transição de 10/09/2026 descreve o SIGA-FV
como "confidencial e reservado" e o Relatório Mestre está marcado como "Documento
confidencial e sigiloso", mas o código está público.

**Recomendação:** tornar o repositório privado e conceder acesso por convite. Se a exposição
pública for intencional — por exemplo, para integração com Abacus.AI ou Vercel sem
configurar credenciais — deve ser registada como decisão consciente, e este relatório e o
plano de fecho devem sair do repositório público até as pendências estarem fechadas.

**Estado:** aguarda decisão de Leonardo. Não é corrigível por código.

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

---

## Fase 1b — S-03: teste de acesso cruzado (29/09/2026)

Executado contra um projeto Supabase de teste com as 58 migrations aplicadas, duas
organizações, um utilizador `admin` em cada e uma linha da org B em cada uma das 18
tabelas. O utilizador da org A tenta ler e escrever dados da org B.

O `scripts/audit-rls-crosstenant.mjs` sozinho **não teria apanhado nada disto**: assume uma
coluna `org_id` que 6 tabelas não têm (ficavam "inconclusivas") e um "0 linhas" só prova
alguma coisa se a org B tiver dados nessa tabela.

### V-05 · Qualquer utilizador autenticado pode tornar-se `owner` de qualquer organização — **CORRIGIDO** (CRÍTICA)

A policy `Allow self insert on registration` em `org_members` tinha apenas
`CHECK (user_id = auth.uid())`. Sem restrição de organização nem de papel, um utilizador
autenticado (o registo é aberto) inseria-se como `owner` de qualquer organização e passava
a ler e alterar tudo dela. Reproduzido: `INSERT` aceite com `role = 'owner'` na org B.

Correção (migration 060): `client` continua permitido (fluxo de Login/Register); `owner`
só se a organização ainda não tem nenhum membro (criação de organização nova).

### V-06 a V-08 · Policies "é staff de *alguma* organização" — **CORRIGIDO**

Três policies verificavam o papel do utilizador sem ligar o registo à organização:

| ID | Tabela | Impacto |
|---|---|---|
| V-06 | `payment_proofs` (`staff_select_all_proofs`, `staff_update_proofs`) | Staff/admin de qualquer org lê e valida comprovativos de outras |
| V-07 | `professional_payment_accounts` (`staff_manage_accounts`, ALL) | Staff de qualquer org lê, **altera e apaga IBAN** de profissionais de outras |
| V-08 | `financial_audit_events` ("Org admins can view") | Admin de qualquer org lê o log financeiro de todas |

Leitura cruzada reproduzida antes da correção nas três. A escrita cruzada em V-06 e V-07
foi inferida do texto das policies e só testada depois da correção.

### V-09 a V-14 · Escalada de privilégios e fugas por funções e policies — **CORRIGIDO** (migration 061)

Encontradas ao auditar funções `SECURITY DEFINER`, a vista `v_user_context` e as policies que
dependem de `profiles.role` ou de `is_default_org_admin`. Todas reproduzidas antes da correção.

| ID | Gravidade | Falha |
|---|---|---|
| **V-09** | **Crítica** | `profiles.role` é editável pelo próprio utilizador. `can_manage_entity()` e `org_stripe_config_superadmin_manage` confiavam nesse campo. Um utilizador acabado de registar, sem organização, punha `role = 'admin'` e passava a **ler e alterar a configuração Stripe (chaves cifradas e webhook secret) de todas as organizações**. |
| **V-10** | **Crítica** | `is_default_org_admin()` aceitava também qualquer org com `padr` no nome. Qualquer utilizador cria organizações: criar uma chamada "Padrão" dava privilégios de admin global. |
| V-11 | Alta | `v_user_context` (vista de `postgres`, ignora RLS) legível por `anon`: e-mail, nome, papel e organização de todos os utilizadores. |
| **V-12** | **Crítica** | `organizations`: UPDATE e DELETE verificavam "é admin/owner de *alguma* org". Admin da org A alterava e **apagava a org B, com processos e membros em cascata**. |
| V-13 | Média | `process_events` e `process_document_attachments` legíveis por qualquer membro, incluindo clientes, para processos de outros clientes. |
| V-14 | Média | `delete_user_completely` chama `is_org_admin(uuid)`, que a migration 047 substituiu por `(text)`: falha sempre para quem não é admin global. Latente: com um cast simples, utilizadores sem organização escapavam à verificação. |

Correção: `is_default_org_admin` só reconhece a org de slug `default`; trigger em `profiles`
impede que o utilizador altere o próprio `role`/`org_id`; "admin global" em `can_manage_entity` e
em `org_stripe_config` exige ser admin da org default; a vista passa a `security_invoker` e perde o
acesso anónimo; UPDATE/DELETE de `organizations` limitados à própria organização (DELETE só
owner ou admin global); clientes só veem eventos e anexos dos seus processos; `delete_user_completely`
corrigida.

### Resultado depois da migration 060

Leitura das 18 tabelas: zero linhas de outra organização. Escrita cruzada (UPDATE, DELETE,
INSERT) em `processes`, `process_messages`, `payments`, `services_catalog`,
`org_stripe_config`, `payment_proofs`, `professional_payment_accounts`,
`financial_audit_events` e `org_members`: bloqueada. Controlos positivos: cada org continua a
ver os seus próprios dados; o auto-vínculo como `client` e a criação de organização nova
continuam a funcionar.

### Riscos residuais (não corrigidos)

- **Auto-vínculo como `client` em qualquer organização.** O registo precisa disto; o impacto
  depende do que o papel `client` consegue ver. A edge function `create-user` já faz o vínculo
  com service role, pelo que a policy de cliente poderá ser removida no futuro.
- **`organizations` e `services_catalog` legíveis por qualquer utilizador** (policies
  `USING (true)`). O catálogo é público por desenho; a exposição das colunas de certificado a
  outros tenants autenticados fica por decidir (o PR #109 só fecha o acesso anónimo).
- Um `admin` pode alterar o próprio papel para `owner` dentro da sua organização, e qualquer
  utilizador pode inserir eventos em `financial_audit_events` com `actor_user_id` próprio.
- **Criação de organizações aberta a qualquer utilizador autenticado** (`Authenticated users can insert organizations`). Deixou de dar privilégios (V-10), mas permite criar organizações à vontade.
- `service_order_document_checklists` legível por qualquer membro (configuração do serviço, não dados de processo).
- **Não auditado:** edge functions.
- **A produção não foi testada.** O estado real das policies em produção depende de S-07.
