# SGI FV - Formando Valores

Aplicação React + Vite com autenticação via Supabase.

## Pré-requisitos

- Node.js 20+

## Configuração de ambiente

Crie um arquivo `.env` (ou configure no provedor de deploy, como Vercel) com:

```bash
VITE_SUPABASE_URL=https://<seu-projeto>.supabase.co
VITE_SUPABASE_ANON_KEY=<sua-chave-anon>
```

> Sem essas variáveis, a aplicação falha na inicialização por segurança.

## Rodando localmente

1. Instale dependências:
   ```bash
   npm install
   ```
2. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

## Build de produção

```bash
npm run build
```


## Integração de formulário externo por organização

Para vincular automaticamente cadastros vindos de um portal externo (ex.: Wix) a uma organização específica, direcione o usuário para a rota de registro com `orgSlug`:

```
/#/register?orgSlug=associacao-contra-as-injusticas-ai
```

Quando o `orgSlug` existir na tabela de organizações, o seletor de organização fica bloqueado e o cadastro é salvo somente naquela organização.

## Troubleshooting de cadastro (Supabase Auth)

Se no registro aparecer `Database error saving new user` (HTTP 500 em `/auth/v1/signup`), o problema normalmente está no banco do Supabase (trigger/policy/função), não no formulário.

Checklist rápido no Supabase:

- Verifique triggers em `auth.users` que inserem em `profiles`.
- Verifique constraints `NOT NULL`/`UNIQUE` na tabela `profiles`.
- Verifique se a função/trigger usa `SECURITY DEFINER` quando necessário.
