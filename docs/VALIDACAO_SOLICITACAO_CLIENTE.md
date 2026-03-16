# Validação do sistema atual e proposta para a solicitação do cliente

## 1) Contexto da solicitação

Pelo pedido do cliente, precisamos suportar **duas opções comerciais**:

1. **Formulário no site do cliente** enviando dados diretamente para o SGI-FV.
2. **Login/Senha na barra superior do site do cliente** para o usuário acompanhar processo/cadastro.

Também foi mencionado uso opcional de APIs de IA (**OpenAI** ou **Anthropic**) para enriquecimento/triagem.

---

## 2) Validação técnica do sistema atual

## 2.1 Estado de build e saúde geral

- Build de produção está funcional (`npm run build` conclui com sucesso).
- Type-checking **não está saudável** (`npx tsc --noEmit` retorna erros em múltiplos módulos).

### Impacto

- O sistema consegue gerar artefato de deploy, mas há **dívida técnica de tipagem** que aumenta risco de regressão.
- Antes de abrir integrações externas (formulário público e login via site parceiro), é recomendável estabilizar tipos mínimos dos módulos críticos.

## 2.2 Arquitetura funcional observada

- Há autenticação com Supabase no fluxo de login.
- Há persistência de usuário e lista de usuários em `localStorage` no app principal.
- O módulo de processos já suporta criação/listagem com multi-tenant (`org_id`) e timeline.
- O schema atual de `processes` não possui campos nativos para rastrear origem externa (ex.: domínio de origem, id do formulário externo, payload bruto, token de integração).

### Impacto

- O núcleo de processo já existe e é reaproveitável.
- Para integração com sites externos, faltam camadas de **ingestão pública segura**, **assinatura de requisição**, **limite por organização** e **rastreabilidade de origem**.

---

## 3) Viabilidade das duas opções solicitadas

## Opção A — Formulário no site do cliente → SGI-FV

**Viável** e recomendada com arquitetura API-first.

### Como implementar com segurança

1. Criar endpoint público controlado (ex.: Supabase Edge Function `public-intake`).
2. Autenticar chamadas por `integration_key`/`HMAC` + allowlist de domínio.
3. Validar payload (campos obrigatórios, tamanho, formato de documento/email/telefone).
4. Resolver `org_id` da organização contratante via token/chave.
5. Inserir em `processes` com status inicial (`cadastro`) e criar evento em `process_events`.
6. Registrar trilha de auditoria da origem (IP, user-agent, domínio).

### Benefícios

- Permite qualquer cliente manter seu próprio formulário (WordPress, Webflow, HTML puro, etc.).
- Reduz fricção comercial (não obriga migração de front do cliente).
- Mantém o SGI-FV como fonte única de dados.

## Opção B — Login/Senha no topo do site do cliente

**Viável**, com duas abordagens:

### B1) Recomendado (menor risco): redirecionamento para portal SGI

- No site do cliente, botão “Área do Cliente”.
- Redireciona para domínio do SGI-FV com parâmetros (`org_slug`, `return_url`).
- Autenticação ocorre no SGI-FV (Supabase Auth), mantendo sessão e segurança em domínio próprio.

**Prós:** menor complexidade de sessão/cookies/CORS, melhor segurança e manutenção.

### B2) Embedding real no site do cliente (mais complexo)

- Widget/iframe ou SDK JS para login no próprio domínio do cliente.
- Exige tratamento de third-party cookies, CORS, CSP, antifraude e suporte cross-browser.

**Contras:** custo maior, mais suporte operacional e maior risco de falha intermitente em navegadores.

**Recomendação:** começar com B1 e evoluir para B2 apenas se houver requisito comercial obrigatório.

---

## 4) Mudanças mínimas recomendadas (MVP)

## 4.1 Banco de dados

Adicionar na tabela `processes`:

- `source_channel text` (`internal`, `external_form`, `api`, `import`)
- `source_org_domain text`
- `external_reference text`
- `submitted_at timestamptz`

Criar tabela de integrações por organização (ex.: `org_integrations`):

- `id`, `org_id`, `provider`, `integration_key_hash`, `allowed_domains`, `active`, `created_at`

## 4.2 Backend (Supabase Edge Functions)

- `public-intake`: recebe formulário externo e grava processo/evento.
- `public-intake-health`: endpoint simples para teste de conectividade/parceiro.
- `ai-triage` (opcional): classifica texto/documentos e sugere prioridade/etiquetas.

## 4.3 Front-end SGI-FV

- Tela admin para:
  - gerar/regenerar chave de integração;
  - definir domínios permitidos;
  - copiar endpoint e exemplo de payload.

- Ajustar listagem de processos com filtro por origem (`source_channel`).

---

## 5) OpenAI vs Anthropic (uso recomendado no cenário)

As duas são viáveis para:

- Classificação automática de atendimento;
- Resumo de dados do formulário;
- Sugerir prioridade e próximos passos.

### Estratégia prática

- Começar **sem IA** no MVP de integração (garante entrega rápida).
- Em fase 2, ligar IA como processamento assíncrono por fila/evento.
- Guardar resultado de IA como metadado de apoio, sem substituir decisão humana.

---

## 6) Plano de execução sugerido

### Fase 0 — Estabilização técnica (rápida)

- Corrigir erros críticos de TypeScript nos módulos centrais (auth, configuração e tipos principais).

### Fase 1 — Integração de formulário externo (MVP)

- Migration de campos de origem + tabela de integrações.
- Edge Function `public-intake`.
- Documentação de integração para cliente (cURL + JS fetch + WordPress webhook).
- Monitoramento básico (logs, taxa de erro, volume por org).

### Fase 2 — Portal de acesso no site do cliente

- Entrega de botão/CTA “Área do Cliente” com SSO simples por redirecionamento.
- Opcional: deep-link para protocolo específico.

### Fase 3 — IA opcional

- Pipeline assíncrono de triagem com OpenAI/Anthropic.
- Feature flag por organização.

---

## 7) Riscos e mitigação

- **Risco:** endpoint público virar vetor de spam.  
  **Mitigação:** chave por org + HMAC + rate limit + allowlist de domínio + captcha opcional.

- **Risco:** inconsistência entre fluxos de autenticação atuais.  
  **Mitigação:** padronizar estratégia de auth antes de escalar integrações.

- **Risco:** dependência de frontend do cliente para envio correto.  
  **Mitigação:** payload versionado (`schema_version`) + contrato JSON validado no servidor.

---

## 8) Conclusão objetiva para apresentar ao cliente

Sim, podemos oferecer as **duas alternativas**:

1. **Formulário próprio do cliente enviando para o SGI-FV** (prioridade de implementação).
2. **Acesso por login/senha via botão no topo do site do cliente**, inicialmente por redirecionamento seguro para o portal SGI.

Isso entrega rapidez comercial com risco controlado, e preserva caminho para evolução futura (widget embutido e IA de triagem).
