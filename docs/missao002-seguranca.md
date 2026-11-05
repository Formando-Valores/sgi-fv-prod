# MISSÃO 002 — Segurança das Edge Functions, pagamentos e certificado

Branch: `fix/missao002-seguranca-edge-functions` · Base: `main` (861d46f)

> **Estado honesto:** o código foi escrito, verificado por typecheck (`tsc` + `deno check`), build e 31 testes automáticos.
> **Nada foi aplicado nem publicado em produção**, nenhuma função foi testada contra o Supabase ou o Stripe reais
> e nenhuma migration foi executada. Tudo isto depende do merge e do deploy, que ficam a seu cargo.

## 1. Os cinco riscos corrigidos

| Risco | Função | Problema encontrado | Correção |
|---|---|---|---|
| R-01 | `create-user` | Qualquer pessoa com a chave pública (anon) podia criar utilizadores com qualquer papel, redefinir a senha de contas já existentes e apagar utilizadores | Identificação de quem chama (`_shared/auth.ts`). Apagar fica reservado ao superadmin. Um anónimo só cria contas novas com o papel `client`; uma conta existente devolve 409. A senha só é redefinida pelo superadmin. `owner` fica reservado ao superadmin |
| R-02 | `update-user-org-membership` | Sem verificação de quem chama: qualquer um podia promover-se a admin/owner de qualquer organização | Exige sessão. Só admins da org (ou o superadmin) podem alterar vínculos. Não é possível alterar o próprio vínculo, mexer num admin global ou em vínculos de outras organizações. Para alterar um `owner` é preciso ser owner |
| R-03 | `create-process-client-user` | Criava contas e associava-as a qualquer processo sem autenticação | Exige sessão de staff da organização. O processo tem de pertencer à org indicada. Não envia a senha se a conta já existir |
| R-04 | `send-certificate` | Qualquer um podia disparar certificados para qualquer e-mail; havia injeção de HTML e um filtro `.or()` interpolado | Exige sessão (staff, o próprio cliente ou a service role). O e-mail de destino vindo do pedido só é aceite de staff. Escape de HTML em todos os campos. Filtros parametrizados |
| R-05 | `stripe-create-checkout-session` + `stripe-webhook` | O valor vinha do navegador e o webhook marcava como pago sem conferir | O valor é calculado **no servidor** a partir do processo (`os_value`, ou na falta dele `amount`). O valor enviado pelo navegador é ignorado (fica em log se divergir). O webhook confere o valor e a moeda recebidos com os esperados: se divergirem, **não marca como pago**, cria um alerta crítico e envia um e-mail. Também protege contra eventos duplicados e redirecionamentos externos |

## 2. Aviso de pagamento recebido

Quando o webhook confirma um pagamento com o valor correto:

1. Marca o pagamento e o processo como pagos (com `paid_at`).
2. Grava o evento `payment_received` em `process_events`, com o valor e a moeda. O **relatório financeiro** (`src/lib/reports.ts`) já lê `payments` e os eventos cujo tipo contém "payment", por isso o pagamento passa a aparecer lá. Antes disto, os inserts em `process_events` do webhook não tinham `event_type`/`actor_user_id` (obrigatórios desde a migration 024) e muito provavelmente falhavam.
3. Cria uma notificação na nova tabela `org_notifications` (migration 064). Um **sino com contador** no topo do painel mostra o alerta aos admins da organização e um aviso aparece no ecrã quando entra um novo.
4. Envia um **e-mail** para `PAYMENT_ALERT_EMAIL` (por omissão `contato@vainaai.pt`; aceita vários endereços separados por vírgula).

Se o valor divergir, o processo é o mesmo, mas com o alerta `payment_amount_mismatch` (crítico) e sem marcar como pago.

**Teste de e-mail feito nesta missão:** tentei enviar um e-mail de teste para `contato@vainaai.pt` com a chave Resend guardada na Abacus. **O Resend recusou (403):** essa conta só envia para o e-mail do dono enquanto não tiver um domínio verificado. Em produção, o envio usa a `RESEND_API_KEY` e o `FROM_EMAIL` configurados no Supabase. Se aí houver um domínio verificado, deve funcionar, mas **não está confirmado**.

## 3. Certificado de filiação: NIPC e logotipo

- O NIPC passa a ser **o da organização** (`organizations.certificate_nipc`). O NIPC 519206550 é usado apenas para a Associação contra as Injustiças. Uma organização sem NIPC configurado já não recebe o NIPC de outra.
- Nova coluna `organizations.certificate_logo_url` (migration 063). O logotipo aparece no cabeçalho do certificado (página e e-mail); o selo é opcional.
- A migration 063 configura a Associação com `selo associação.png`.
- **Ação necessária para a Formando Valores:** preencher `certificate_nipc` e `certificate_logo_url`. Não existe no repositório nenhum ficheiro de logotipo da Formando Valores.

## 4. Testes automáticos

- `vitest` com 31 testes em `tests/security/` (cálculo de preço, conferência de valor pago, regras de autorização e NIPC/logotipo).
- Comando: `npm test`. Foi acrescentado à CI (`.github/workflows/ci.yml`).
- A lógica testada está em módulos puros (`supabase/functions/_shared/authz.ts`, `pricing.ts` e `certificate.ts`), partilhados entre as funções e os testes.
- Limitação: não há testes de integração com o Stripe/Supabase reais.

## 5. Passos de deploy (a fazer por si, depois de rever o PR)

1. **Migrations** (SQL Editor ou `npx supabase db push`):
   - `063_org_certificate_logo.sql`
   - `064_org_notifications.sql`
2. **Secrets** (Supabase → Edge Functions → Secrets):
   - `PAYMENT_ALERT_EMAIL=contato@vainaai.pt`
   - opcional: `ALLOWED_CHECKOUT_ORIGINS=https://sgi-fv-prod.vercel.app`
   - confirmar que existem `RESEND_API_KEY`, `FROM_EMAIL` (com domínio verificado no Resend) e `APP_URL`.
3. **Funções:**
   ```bash
   npx supabase functions deploy create-user update-user-org-membership create-process-client-user send-certificate stripe-create-checkout-session stripe-webhook
   ```
4. **Frontend na Vercel ao mesmo tempo** (merge para `main`): as funções `create-user`, `create-process-client-user` e `update-user-org-membership` passam a exigir o token da sessão, que o novo frontend já envia.
5. **Teste em modo de teste do Stripe:** criar um processo com um valor, pagar com o cartão `4242 4242 4242 4242` e confirmar (a) que o processo fica pago, (b) que o alerta aparece no sino, (c) que chega o e-mail e (d) que o pagamento aparece no relatório financeiro.

## 6. Efeitos colaterais conhecidos

- O registo público (`public/associate.html`) continua a criar contas novas como `client`. Um e-mail **já registado** recebe agora 409 (antes, a senha era redefinida silenciosamente, o que era uma falha grave).
- Os processos sem `os_value` nem `amount` deixam de poder ser pagos (o checkout devolve um erro em vez de cobrar um valor arbitrário).
- `_shared/payments/getOrgStripeConfig.ts` tem 2 erros de tipos antigos no `deno check` (Uint8Array/BufferSource), anteriores a esta missão e sem efeito em runtime.
