# Integração Wix → SGI FV (Cadastro de Cliente + Processo)

Este fluxo permite receber cadastro externo (Wix e futuros canais), criar usuário com perfil `client`, vincular inicialmente na organização `default` e abrir um processo com origem do canal.

> Para novos sites/portais além da Wix, use também a base genérica em `docs/integrations/external-client-intake.html` e `docs/integrations/external-client-intake.md`, mantendo esta function como backend único.

## 1) Deploy da Edge Function

Função criada em:

- `supabase/functions/wix-client-intake/index.ts`

Deploy:

```bash
supabase functions deploy wix-client-intake
```


## 1.1) Configuração de autenticação da Edge Function

Para chamadas diretas do navegador (Wix), a função deve ser publicada com:

- `verify_jwt = false` em `supabase/functions/wix-client-intake/config.toml`

Sem isso, o preflight/POST pode retornar bloqueio de CORS com status não-OK no OPTIONS/401.

## 2) Variáveis obrigatórias na Function

Defina no Supabase (Functions Secrets):

- `WIX_INTAKE_API_KEY` (chave privada da integração)
- `URL_SUPABASE`
- `SERVICE_ROLE_KEY_SUPABASE`

> Compatibilidade: a função também aceita `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` para ambientes antigos.


## 2.1) Configuração no HTML do Wix (obrigatório)

No arquivo/trecho do formulário Wix, substitua:

- `SUPABASE_URL`: `https://SEU_PROJECT_REF.supabase.co`
- `API_KEY`: valor real da secret `WIX_INTAKE_API_KEY`
- `SUPABASE_ANON_KEY`: chave pública (anon) do projeto Supabase

> O endpoint é montado automaticamente no script (`${SUPABASE_URL}/functions/v1/wix-client-intake`), para evitar erro de digitação.

Se `SUPABASE_URL`/`API_KEY`/`SUPABASE_ANON_KEY` estiverem ausentes ou com placeholder, o formulário mostrará aviso. Sem `SUPABASE_ANON_KEY`, o preflight pode falhar com CORS (status não-OK). Se a URL estiver errada, o navegador exibirá erro DNS (`ERR_NAME_NOT_RESOLVED`).


## 2.2) Cabeçalhos obrigatórios para evitar erro de CORS

No `fetch` do snippet, mantenha estes headers:

- `apikey: SUPABASE_ANON_KEY`
- `Authorization: Bearer SUPABASE_ANON_KEY`
- `x-api-key: WIX_INTAKE_API_KEY`

Isso evita bloqueio no preflight/POST para chamadas cross-origin (Wix -> Supabase Functions).


## 2.3) Erros comuns no Wix (importante)

- **`SyntaxError: Invalid or unexpected token` no Console**: normalmente ocorre quando a chave foi colada com quebra de linha dentro de aspas. No snippet atualizado usamos template string com `.trim()`, mas ainda assim cole a chave em **uma única linha**.
- **`SUPABASE_ANON_KEY` incorreta**: não use a chave `service_role` no navegador. A chave correta deve ser a **anon public key** (Settings → API → Project API keys).
- **`net::ERR_NAME_NOT_RESOLVED` no navegador**: a `SUPABASE_URL` está com o project-ref incorreto (erro de digitação). Confirme o ref exato em *Project Settings → General* e use no formato `https://<project-ref>.supabase.co`.
- Se usar `service_role` por engano, o snippet já interrompe o envio e mostra mensagem explícita no formulário.

## 3) SQL necessária

Aplicar migration:

- `supabase/migrations/013_processes_external_intake_columns.sql`
- `supabase/migrations/014_processes_client_visibility.sql`

Ela adiciona nas `processes`:

- `origem_canal`
- `unidade_atendimento`
- `org_nome_solicitado`

## 4) Formulário Wix

Use o HTML pronto em:

- `docs/integrations/wix-client-intake.html`

Esse formulário já inclui:

- opções de área: **JURÍDICO / ADVOCACIA**, **ADMINISTRATIVO**, **TECNOLÓGICO / AI**;
- campo de **nome da organização solicitada**;
- envio com `source: "wix"` e `siteName: "Wix"`.

## 5) Resultado esperado

Ao enviar formulário com sucesso:

1. cria/atualiza `auth.users` e `profiles`;
2. vincula em `org_members` com role `client` na organização default;
3. cria `processes` com origem do canal e unidade, com status inicial `analise`;
4. cria evento inicial em `process_events` informando a origem do recebimento.


## 6) Teste rápido no Postman

Foi adicionado um arquivo pronto para importação:

- `docs/integrations/postman/wix-client-intake.postman_collection.json`

Passos:

1. Importar a collection no Postman.
2. Preencher variáveis da collection:
   - `supabase_url`
   - `wix_intake_api_key`
   - `publishable_key`
3. Executar primeiro `Preflight OPTIONS - wix-client-intake`.
4. Executar depois `Cadastro POST - wix-client-intake`.

Se o preflight retornar 404, a função não está deployada no projeto/ref informado.
