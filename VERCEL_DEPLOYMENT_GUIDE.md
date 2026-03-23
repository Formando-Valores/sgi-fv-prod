# 🚀 Guia de Deploy e Validação no Vercel

## ✅ Status Atual

| Item | Status |
|------|--------|
| Build local | ✅ Sucesso |
| Branch `feat/multiempresa-rls` | ✅ Pushed para remote |
| `vercel.json` (SPA routing) | ✅ Presente |
| `.env` com credenciais Supabase | ✅ Configurado |

---

## 📋 Checklist para Validar o Deploy

### 1. Verificar no Vercel Dashboard

1. Acesse: **https://vercel.com** → seu projeto **sgi-fv-prod**
2. Vá em **Deployments**
3. Procure por um deploy da branch **`feat/multiempresa-rls`**
4. O status deve ser **Ready** (verde) ✅

> Se não aparecer, aguarde 1-2 minutos. O Vercel detecta pushes automaticamente.

### 2. Verificar Environment Variables no Vercel

Vá em: **Settings → Environment Variables**

Certifique-se que existem:

| Variável | Valor |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://ktrrqaqaljdcmxqdcff.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_ZcEU2_K18A4NU43hO4zPmA_N5SkuqO_` |

> ⚠️ **Se não existirem**, adicione em Settings → Environment Variables → Add New. Marque todos os ambientes (Production, Preview, Development).

### 3. Verificar Build Settings

Em **Settings → General**:

| Configuração | Valor |
|--------------|-------|
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |
| Node.js Version | 18.x ou superior |

---

## 🧪 Testando a Aplicação

Após o deploy ficar **Ready**:

1. Clique no deploy → copie a URL do Preview
2. Abra a URL em aba anônima
3. Verifique:

- [ ] Página carrega (sem tela branca permanente)
- [ ] Tela de login aparece
- [ ] Login funciona com suas credenciais
- [ ] Dashboard mostra estatísticas
- [ ] Menu lateral navega corretamente
- [ ] Console (F12) sem erros 400/500

---

## 🐛 Troubleshooting

### Build falha no Vercel
- Clique no deploy com erro → **Build Logs**
- Procure por `Module not found` ou `Error`
- Me envie o screenshot dos logs

### Página fica em "Carregando..." para sempre
- Abra F12 → Console
- Procure por erros vermelhos
- Verifique se as variáveis de ambiente estão configuradas no Vercel

### Erro 400 no `org_members`
- Execute as migrations SQL no Supabase SQL Editor
- Ordem: `fix_base_tables.sql` → `004_processes.sql` → `005_rls_processes.sql`

### Erro 404 ao recarregar páginas
- Verifique se `vercel.json` está no repositório (já está ✅)

---

## 🔗 Links Rápidos

- **Vercel Dashboard**: https://vercel.com/dashboard
- **GitHub Repo**: https://github.com/Formando-Valores/sgi-fv-prod
- **Supabase Dashboard**: https://supabase.com/dashboard/project/ktrrqaqaljdcmxqdcff

---

## ➡️ Próximos Passos

1. ✅ Validar o deploy do Preview
2. Criar **Pull Request** de `feat/multiempresa-rls` → `main`
3. Revisar e fazer merge
4. Deploy automático para produção
