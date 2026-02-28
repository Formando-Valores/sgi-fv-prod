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
