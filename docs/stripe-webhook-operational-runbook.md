# Stripe Webhook: Operação, Observabilidade e Segurança

## 1) Variáveis obrigatórias por ambiente

As funções `stripe-webhook` e `stripe-reconciliation` dependem de credenciais Stripe e de conexão SQL direta. Em todos os ambientes (`dev`, `stage`, `prod`), configure **todas** as variáveis abaixo:

| Variável | Dev | Stage | Prod | Observação |
|---|---|---|---|---|
| `STRIPE_SECRET_KEY` | obrigatório | obrigatório | obrigatório | Chave secreta da conta Stripe do ambiente correspondente. Nunca reutilizar chave entre ambientes. |
| `STRIPE_WEBHOOK_SECRET` | obrigatório | obrigatório | obrigatório | Segredo do endpoint webhook (prefixo `whsec_...`) do ambiente correspondente. |
| `SUPABASE_DB_URL` | obrigatório* | obrigatório* | obrigatório* | String de conexão SQL primária recomendada para as funções de backend. |
| `POSTGRES_URL` | equivalente | equivalente | equivalente | Fallback aceito no código quando `SUPABASE_DB_URL` não existe. |
| `DATABASE_URL` | equivalente | equivalente | equivalente | Último fallback aceito no código para conexão com banco. |

\* Use `SUPABASE_DB_URL` como padrão organizacional e mantenha os equivalentes (`POSTGRES_URL`/`DATABASE_URL`) somente para compatibilidade ou contingência.

### Matriz de segregação por ambiente

- **Dev**: conta Stripe de desenvolvimento/test mode + projeto Supabase de desenvolvimento.
- **Stage**: conta Stripe stage/test mode separada + projeto Supabase de homologação.
- **Prod**: conta Stripe produção/live mode + projeto Supabase produção.
- Proibido apontar `stage` para segredo de `prod` (e vice-versa).


## 1.1) Onde obter cada secret (passo a passo)

### `STRIPE_SECRET_KEY`

No painel Stripe do **mesmo ambiente** (test para dev/stage, live para prod):

1. Acesse **Developers > API keys**.
2. Copie a chave **Secret key**:
   - começa com `sk_test_...` em test mode
   - começa com `sk_live_...` em live mode
3. Salve como `STRIPE_SECRET_KEY` no projeto Supabase do ambiente correspondente.

### `STRIPE_WEBHOOK_SECRET`

No endpoint de webhook configurado no Stripe:

1. Acesse **Developers > Webhooks**.
2. Abra o endpoint `https://<PROJECT_REF>.supabase.co/functions/v1/stripe-webhook`.
3. Clique em **Reveal** / **Signing secret**.
4. Copie o segredo com prefixo `whsec_...` e salve como `STRIPE_WEBHOOK_SECRET`.

> Se estiver usando Stripe CLI localmente, o segredo temporário vem do comando `stripe listen` e também é `whsec_...`.

### `SUPABASE_DB_URL` (ou equivalentes)

No painel do Supabase do ambiente:

1. Acesse **Project Settings > Database**.
2. Copie a **Connection string** (URI Postgres).
3. Salve no secret `SUPABASE_DB_URL`.

Equivalentes aceitos pelo código (fallback):

- `POSTGRES_URL`
- `DATABASE_URL`

### Onde configurar esses secrets no Supabase

Via CLI (recomendado para CI/CD):

```bash
supabase secrets set STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=... SUPABASE_DB_URL=...
```

Ou pelo Dashboard Supabase:

- **Edge Functions > Secrets** (ou Settings equivalente)
- Criar/atualizar os três nomes exatamente como acima.

## 2) Endpoint oficial no Stripe e eventos mínimos aceitos

Endpoint oficial do webhook (Supabase Edge Function):

- `POST https://<PROJECT_REF>.supabase.co/functions/v1/stripe-webhook`

Eventos mínimos a configurar no Stripe (somente os tratados no código):

1. `checkout.session.completed`
2. `payment_intent.succeeded`
3. `payment_intent.payment_failed`
4. `checkout.session.expired`
5. `checkout.session.async_payment_failed`
6. `charge.refunded`
7. `charge.refund.updated`

Qualquer outro evento recebido será ignorado pela função (resposta de sucesso com `ignored=true`).

## 3) Padronização de logs estruturados

Campos obrigatórios em logs de webhook:

- `processId`
- `eventId`
- `checkoutSessionId`
- `paymentIntentId`

Padrão recomendado:

- Sempre emitir logs em JSON por evento de entrada, processamento concluído e erro.
- Incluir também `eventType`, `paymentStatus` e `error` quando aplicável.

Exemplo de payload de log:

```json
{
  "component": "stripe-webhook",
  "message": "webhook_processed",
  "processId": "<uuid>",
  "eventId": "evt_...",
  "eventType": "payment_intent.succeeded",
  "checkoutSessionId": "cs_...",
  "paymentIntentId": "pi_...",
  "paymentStatus": "paid"
}
```

## 4) Alertas operacionais

### 4.1 Erros de webhook

Criar alerta em provedor de logs/observabilidade para entradas com:

- `component = stripe-webhook`
- `message = webhook_processing_failed` **ou** HTTP status `>= 500`

SLA sugerido:

- **Severidade alta**: `>= 5` erros em 5 minutos.
- **Severidade média**: taxa de erro `> 2%` em janela de 15 minutos.

### 4.2 Aumento de pagamentos `pending`

Criar job periódico (ex.: a cada 5 minutos) para medir volume de `payments.status='pending'` acima do baseline.

SQL de referência:

```sql
SELECT COUNT(*) AS pending_count
FROM public.payments
WHERE status = 'pending'
  AND created_at >= now() - interval '30 minutes';
```

Regras sugeridas:

- Alerta média: `pending_count > p95` da janela histórica equivalente.
- Alerta alta: `pending_count > p99` **ou** crescimento `> 2x` da média móvel de 7 dias para mesmo horário.

> Ajuste p95/p99 por ambiente (dev/stage/prod) e sazonalidade.

## 5) Rotação de chaves e contingência pós-rotação

### 5.1 Procedimento de rotação

1. Gerar nova `STRIPE_SECRET_KEY` no Stripe para o ambiente alvo.
2. Criar/rotacionar endpoint webhook no Stripe e obter novo `STRIPE_WEBHOOK_SECRET`.
3. Atualizar segredos do ambiente (`dev`/`stage`/`prod`) em Supabase.
4. Fazer deploy/refresh da função se necessário.
5. Validar recebimento com evento real de teste no Stripe CLI/dashboard.
6. Revogar chave antiga somente após validação bem-sucedida.

### 5.2 Teste de contingência pós-rotação (checklist)

Executar imediatamente após rotação:

- [ ] `checkout.session.completed` atualiza `payments.status='paid'`.
- [ ] `payment_intent.payment_failed` atualiza status de falha.
- [ ] Evento fora do mapeamento é ignorado sem erro 500.
- [ ] Logs contêm `processId`, `eventId`, `checkoutSessionId`, `paymentIntentId`.
- [ ] Nenhum aumento anormal de `pending` nos 30 minutos seguintes.
- [ ] Alerta de erro permanece estável (sem disparo indevido).

Rollback:

- Se validação falhar, restaurar segredos anteriores, reenfileirar/reenviar eventos Stripe e abrir incidente com timeline (início, impacto, mitigação, causa raiz).

