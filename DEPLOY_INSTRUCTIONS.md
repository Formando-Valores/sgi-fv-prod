# 🚀 Instruções para Deploy no Vercel - SGI FV

## 📋 Resumo do que foi feito

### ✅ Correções aplicadas localmente:
1. **`vercel.json`** (NOVO) - Configuração de roteamento SPA para o Vercel
2. **`index.tsx`** (CORRIGIDO) - Removido top-level `await` que impedia o build
3. **`vite.config.ts`** (CORRIGIDO) - Build target atualizado para `es2022`, removido terser

### ✅ Build verificado:
```
✓ built in 4.31s
dist/index.html                  2.39 kB
dist/assets/index-iP14DY2A.js  485.60 kB
```

---

## 🔑 Passo 1: Dar permissão ao GitHub App

O GitHub App da Abacus.AI não tem permissão de **escrita** no repositório `Formando-Valores/sgi-fv-prod`.

👉 Acesse: [GitHub App Permissions](https://github.com/apps/abacusai/installations/select_target)

Selecione a organização **Formando-Valores** e habilite:
- ✅ Contents: Read & Write
- ✅ Pull requests: Read & Write

---

## 🔄 Passo 2: Push Manual dos Commits

### Opção A: Clonar e aplicar patches

```bash
# 1. Clonar o repositório
git clone https://github.com/Formando-Valores/sgi-fv-prod.git
cd sgi-fv-prod

# 2. Trocar para a branch
git checkout feat/multiempresa-rls

# 3. Criar vercel.json
cat > vercel.json << 'EOF'
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
EOF

# 4. Substituir index.tsx (copiar o conteúdo abaixo)
# Veja a seção "Conteúdo dos Arquivos" abaixo

# 5. Atualizar vite.config.ts
# Veja a seção "Conteúdo dos Arquivos" abaixo

# 6. Commit e push
git add .
git commit -m "fix: resolve build errors for Vercel deployment"
git push origin feat/multiempresa-rls
```

### Opção B: Editar diretamente no GitHub

1. Acesse: https://github.com/Formando-Valores/sgi-fv-prod/tree/feat/multiempresa-rls
2. Crie o arquivo `vercel.json` com o conteúdo abaixo
3. Edite `index.tsx` com o conteúdo abaixo
4. Edite `vite.config.ts` com o conteúdo abaixo

---

## 📝 Conteúdo dos Arquivos

### vercel.json (NOVO)
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### index.tsx (SUBSTITUIR COMPLETAMENTE)
```tsx
/**
 * SGI FV - Main Entry Point
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import ErrorBoundary from './src/components/ErrorBoundary';
import App from './App';

// Global error handlers
window.onerror = function(message, source, lineno, colno, error) {
  console.error('[GLOBAL ERROR]', { message, source, lineno, colno, error: error?.stack || error?.toString() });
  const rootEl = document.getElementById('root');
  if (rootEl && !rootEl.hasChildNodes()) {
    rootEl.innerHTML = `
      <div style="padding:20px;color:white;background:#0f172a;min-height:100vh;font-family:Arial">
        <h1 style="color:#ef4444">❌ JavaScript Error</h1>
        <pre style="color:#fca5a5;background:#1e293b;padding:15px;border-radius:8px;white-space:pre-wrap">
Message: ${message}
Source: ${source}
Line: ${lineno}, Column: ${colno}
        </pre>
      </div>
    `;
  }
  return false;
};

window.onunhandledrejection = function(event) {
  console.error('[UNHANDLED REJECTION]', { reason: event.reason?.message || event.reason });
};

// Render application
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
```

### vite.config.ts (SUBSTITUIR COMPLETAMENTE)
```ts
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProd = mode === 'production';
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: 'all',
        hmr: isProd ? false : {
          protocol: 'ws',
          host: 'localhost',
        },
      },
      preview: {
        port: 3000,
        host: '0.0.0.0',
      },
      build: {
        sourcemap: !isProd,
        target: 'es2022',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
```

---

## 🔀 Passo 3: Criar Pull Request

1. Acesse: https://github.com/Formando-Valores/sgi-fv-prod/compare/main...feat/multiempresa-rls
2. Clique em **"Create pull request"**
3. Use estas informações:

**Título:**
```
feat: Arquitetura multi-tenant, módulo de processos e correções de deploy
```

**Descrição:**
```markdown
## 🎯 Objetivo
Implementar a base do sistema SGI-FV com arquitetura multi-tenant e gestão de processos.

## ✅ Implementado
- ✅ Arquitetura multi-tenant com RLS
- ✅ Tabelas: organizations, org_members, profiles
- ✅ Módulo de processos com CRUD completo
- ✅ Dashboard com estatísticas
- ✅ Layout SaaS moderno
- ✅ Autenticação com Supabase
- ✅ vercel.json para SPA routing
- ✅ Build corrigido (top-level await removido)

## 🔧 Correções de Build
- Removido top-level await em index.tsx
- Build target atualizado para es2022
- Adicionado vercel.json para roteamento SPA

## 🧪 Como Testar
1. Deploy no Vercel (automático via PR)
2. Verificar build no Vercel
3. Testar login e dashboard
```

---

## ⚙️ Passo 4: Configurar Vercel

### Environment Variables no Vercel:
```
VITE_SUPABASE_URL = https://ktrrqaqaljdcmxqdcff.supabase.co
VITE_SUPABASE_ANON_KEY = (sua chave anon do Supabase)
```

### Build Settings:
```
Framework: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

---

## ✅ Checklist
- [ ] Permissões do GitHub App atualizadas
- [ ] Arquivos corrigidos (vercel.json, index.tsx, vite.config.ts)
- [ ] Push feito para feat/multiempresa-rls
- [ ] PR criado
- [ ] Variáveis de ambiente no Vercel configuradas
- [ ] Build no Vercel passou
- [ ] Aplicação carrega sem erros
