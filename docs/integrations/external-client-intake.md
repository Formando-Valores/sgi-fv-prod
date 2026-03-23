# Integração Genérica de Cadastro Externo → SGI FV

Esta base reaproveita a mesma Edge Function já usada pela Wix (`wix-client-intake`), mas permite cadastrar rapidamente **novos sites, portais ou parceiros** sem quebrar o fluxo existente.

## Objetivo

Permitir que qualquer site externo incorpore um HTML/script simples e envie cadastros para o SGI FV com:

- origem do canal (`source`)
- nome do site/portal (`siteName`)
- organização desejada
- área/unidade de atendimento

## Edge Function utilizada

Continuamos usando a mesma function já publicada:

- `wix-client-intake`

Isso preserva a compatibilidade com a Wix e evita duplicação de backend.

## Novos campos aceitos

Além do payload atual, a integração agora aceita:

- `source`: identificador técnico do canal. Ex.: `wix`, `portal-parceiro`, `landing-campanha`
- `siteName`: nome amigável do site/portal. Ex.: `Portal Parceiro XPTO`

### Exemplo

```json
{
  "organizationSlug": "default",
  "source": "portal-parceiro",
  "siteName": "Portal Parceiro XPTO",
  "fullName": "Maria da Silva",
  "email": "maria@email.com",
  "password": "Senha@123",
  "confirmPassword": "Senha@123",
  "documentId": "",
  "taxId": "",
  "address": "Rua Exemplo, 100",
  "maritalStatus": "Solteiro",
  "country": "Brasil",
  "phone": "11999999999",
  "processTitle": "Cadastro recebido pelo parceiro",
  "serviceUnit": "ADMINISTRATIVO",
  "organizationRequestedName": "Associação XPTO"
}
```

## Como usar em novos sites

1. Copie o snippet base de `docs/integrations/external-client-intake.html`.
2. Configure no script:
   - `SUPABASE_URL`
   - `API_KEY`
   - `SUPABASE_ANON_KEY`
   - `INTEGRATION_SOURCE`
   - `INTEGRATION_SITE_NAME`
   - `DEFAULT_ORGANIZATION_SLUG`
3. Publique o HTML dentro do site parceiro.

## O que o sistema registra

No recebimento:

- `origem_canal` continua guardando o valor de `source`
- o evento inicial em `process_events` passa a registrar também o `siteName`
- o e-mail de acesso usa o nome do site/portal no texto de origem

## Compatibilidade com a Wix

Nada do fluxo atual da Wix foi removido.

- a function continua sendo `wix-client-intake`
- se `siteName` não for enviado e `source = "wix"`, o sistema assume `siteName = "Wix"`
- o snippet atual da Wix pode continuar funcionando

## Recomendação prática

Para cada novo parceiro/site:

- defina um `source` técnico único
- defina um `siteName` legível para auditoria

Exemplos:

- `source: "wix"` / `siteName: "Wix"`
- `source: "portal-juridico"` / `siteName: "Portal Jurídico ABC"`
- `source: "landing-meta-ads"` / `siteName: "Landing Meta Ads Março"`
