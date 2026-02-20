# SGI FV - Sistema de Gestão Integrada

**Formando Valores**

---

## 📋 Sobre

Sistema de gestão integrada para acompanhamento de processos e serviços, desenvolvido com React, TypeScript, Vite e Supabase.

### Funcionalidades

- ✅ Autenticação com Supabase Auth
- ✅ Arquitetura Multi-Tenant (multiempresa)
- ✅ Row Level Security (RLS) para isolamento de dados
- ✅ Dashboard do cliente com status do processo
- ✅ Dashboard administrativo para gestão
- ✅ Validação de senhas robusta
- ✅ Interface responsiva e moderna

---

## 🚀 Começando

### Pré-requisitos

- Node.js 18+
- npm ou yarn
- Conta no [Supabase](https://supabase.com)

### Instalação

```bash
# Clonar repositório
git clone https://github.com/cirilc01/sgi-fv-prod.git
cd sgi-fv-prod

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais

# Rodar em desenvolvimento
npm run dev
```

### Variáveis de Ambiente

```env
# Supabase
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=seu-anon-key

# Multi-tenant (opcional)
VITE_ORG_SLUG=default
```

---

## 🗄️ Configuração do Banco de Dados

### 1. Executar Migrações

No Supabase Dashboard > SQL Editor, execute:

1. `supabase/migrations/001_multiempresa.sql` - Cria estrutura multi-tenant
2. `supabase/migrations/002_rls_policies.sql` - Configura RLS

### 2. Verificar Organização Padrão

```sql
SELECT * FROM organizations WHERE slug = 'default';
```

Se não existir, a migração criará automaticamente.

### 3. Criar Primeira Organização (Opcional)

```sql
-- Criar nova organização
INSERT INTO organizations (slug, name)
VALUES ('minha-empresa', 'Minha Empresa Ltda');

-- Obter ID
SELECT id FROM organizations WHERE slug = 'minha-empresa';

-- Vincular usuário existente como owner
INSERT INTO org_members (org_id, user_id, role)
VALUES ('org-id-aqui', 'user-id-aqui', 'owner');
```

---

## 🏗️ Estrutura do Projeto

```
sgi-fv-prod/
├── src/
│   ├── lib/
│   │   ├── tenant.ts       # Contexto multi-tenant
│   │   └── stripe.ts       # Integração Stripe (TODO)
│   └── types/
│       └── service-orders.ts  # Tipos de ordens (TODO)
├── pages/
│   ├── Login.tsx           # Página de login
│   ├── Register.tsx        # Página de registro
│   ├── UserDashboard.tsx   # Dashboard do cliente
│   └── AdminDashboard.tsx  # Dashboard administrativo
├── supabase/
│   └── migrations/
│       ├── 001_multiempresa.sql   # Schema multi-tenant
│       └── 002_rls_policies.sql   # Políticas RLS
├── docs/
│   └── ROADMAP.md          # Roadmap de desenvolvimento
├── App.tsx                 # Componente principal
├── types.ts                # Definições de tipos
├── constants.ts            # Constantes e mock data
├── supabase.ts             # Cliente Supabase
├── DIAGNOSIS.md            # Diagnóstico da arquitetura
├── TESTING.md              # Plano de testes
└── README.md               # Este arquivo
```

---

## 🔐 Arquitetura Multi-Tenant

### Tabelas

| Tabela | Descrição |
|--------|------------|
| `organizations` | Empresas/organizações |
| `org_members` | Vínculo usuário-organização |
| `profiles` | Dados do perfil do usuário |

### Roles

| Role | Permissões |
|------|------------|
| `owner` | Acesso total, gerenciar organização |
| `admin` | Gerenciar membros e processos |
| `staff` | Atender clientes |
| `client` | Visualizar próprio processo |

### RLS (Row Level Security)

Todas as tabelas têm RLS habilitado. Usuários só acessam dados de suas organizações.

---

## 🧪 Testando

Veja [TESTING.md](./TESTING.md) para o plano de testes completo.

```bash
# Build de produção
npm run build

# Preview local
npm run preview
```

---

## 📈 Roadmap

Veja [docs/ROADMAP.md](./docs/ROADMAP.md) para próximas features:

- v1.2.0: Dashboard conectado ao Supabase
- v1.3.0: Ordens de serviço
- v1.4.0: Upload de documentos
- v1.5.0: Integração Stripe

---

## 🤝 Contribuindo

1. Fork o projeto
2. Crie sua feature branch (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'feat: adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

---

## 📝 Licença

Este projeto é privado e de uso exclusivo da Formando Valores.

---

## 📞 Suporte

- Email: contato@formandovalores.com
- Issues: [GitHub Issues](https://github.com/cirilc01/sgi-fv-prod/issues)
