# Achados da Fase 2 — tipagem e qualidade

**Data:** 21/09/2026
**Tarefas:** `Q-01` (typecheck) e `Q-02` (CI) do `docs/plano-fecho-v1.md`

---

## Ponto de partida

O `package.json` tinha apenas `dev`, `build` e `preview`. Não havia `typecheck`, lint, testes
nem CI. O `npm run build` passava porque o **Vite não faz verificação de tipos** — transpila
e segue.

Correndo `tsc --noEmit` pela primeira vez: **170 erros**, dos quais 132 eram ruído, porque o
`tsconfig.json` incluía `supabase/functions/` (código Deno) na configuração do browser.
Restavam **38 erros reais** no código da aplicação.

Estão agora **todos resolvidos**, e o CI passa a bloquear regressões.

---

## Dois bugs reais encontrados pelo typecheck

A maioria dos 38 erros eram tipos desatualizados — o `Process` não declarava colunas que
existem na base de dados desde as migrations `015`, `017` e `028`. Esses são inofensivos em
runtime.

Mas dois erros escondiam comportamento partido de verdade.

### B-01 · O e-mail de atribuição ao profissional vai sem contacto do cliente

**Ficheiro:** `pages/AdminDashboard.tsx`
**Severidade:** Média — afeta operação, não segurança

Ao atribuir um processo a um profissional, o sistema invoca a Edge Function
`notify-process-assignment` com:

```ts
clientName: currentProc?.cliente_nome || currentProc?.name || '',
clientContact: currentProc?.cliente_contato || '',
```

Mas `currentProc` é um `AdminProcessRow`, construído em `baseProcessRows`, que **não
reexpõe os campos crus da BD**: o nome do cliente é mapeado para `name` e o contacto para
`phone`/`email`. Logo `cliente_nome` e `cliente_contato` são sempre `undefined`.

Consequência: `clientName` funcionava por acaso, graças ao fallback para `name`. Mas
**`clientContact` ia sempre como string vazia** — o profissional recebia a notificação de
atribuição sem qualquer forma de contactar o cliente.

**Corrigido:** passa a ler `phone`, com fallback para `email`, ignorando os marcadores de
ausência (`'---'` e `'-'`) usados pelo mapeamento.

### B-02 · Metadados da sessão Stripe vão sempre vazios

**Ficheiro:** `src/pages/Processes/ProcessDetails.tsx`
**Severidade:** A confirmar — relacionado com `P0-01`
**Estado:** documentado no código, **não corrigido**

O pedido de checkout era montado assim:

```ts
serviceId: String((process as Record<string, unknown>).service_id ?? ''),
areaId:    String((process as Record<string, unknown>).area_id ?? ''),
sectorId:  String((process as Record<string, unknown>).sector_id ?? ''),
```

A tabela `processes` **não tem nenhuma destas três colunas**. As únicas ocorrências de
`service_id` no esquema estão em `service_order_document_checklists`, que é outra tabela.

Estes três valores seguem para os metadados da sessão Stripe
(`supabase/functions/stripe-create-checkout-session/index.ts`, linhas 139-142), pelo que
**todas as sessões de checkout são criadas sem atribuição de serviço, área ou setor**.

Isto liga-se diretamente ao item `P0-01` do Relatório Mestre ("Stripe – serviços sem valor")
e pode ser parte da causa.

**Não corrigido de propósito:** a origem correta é provavelmente `services_selected`, mas
isso é uma regra de negócio que precisa de confirmação — não deve ser inventada. Ficou um
comentário `ATENÇÃO (P0-01)` no código, no ponto exato.

---

## Outras correções estruturais

**`AdminProcessRow` estava duplicada em três ficheiros** — `DashboardSection`,
`ProcessesSection` e `SelectedUserDetailModal` — e as cópias já tinham divergido: a do
modal perdeu o campo `destination` em `associationFees`, o que impedia passar as mesmas
linhas entre componentes. Unificada em `src/types/admin-dashboard.ts`.

**`SERVICE_UNITS` usava literais de string** em vez dos membros do enum `ServiceUnit`.
Passou a usar `ServiceUnit.ADMINISTRATIVO` e restantes.

**`InputProps` redefinia `size`** (`'sm' | 'md' | 'lg'`) em conflito com o atributo HTML
`size` (number). Resolvido com `Omit<..., 'size'>`.

**Dois `TS2589`** (instanciação de tipos infinitamente profunda) em `src/lib/processes.ts`:
limitação conhecida do `supabase-js` quando o query builder encadeado passa por um genérico.
Contidos com anotação local e comentário.

---

## O que fica a correr no CI

`.github/workflows/ci.yml`, em cada pull request e push para `main`:

1. `npm ci`
2. `npm run typecheck` — **bloqueante**, o repositório está a zero erros
3. `npm run build`

Ainda **não há testes**. A suite E2E do fluxo crítico é a tarefa `Q-03` e continua aberta.
