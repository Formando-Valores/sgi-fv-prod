# SGI FV - Roadmap de Desenvolvimento

## Versão Atual: 1.1.0 (Multi-Tenant)

---

## ✅ Concluído

### v1.0.0 - MVP
- [x] Login/Register básico com Supabase Auth
- [x] Dashboard do cliente
- [x] Dashboard administrativo
- [x] Persistência local (localStorage)

### v1.1.0 - Multi-Tenant & RLS
- [x] Tabelas: `organizations`, `org_members`, `profiles`
- [x] Row Level Security (RLS) com policies
- [x] Funções helper: `is_org_member()`, `is_org_admin()`
- [x] Contexto de tenant no frontend
- [x] Login com vinculação automática à organização
- [x] Register com criação de membership

---

## 🔄 Em Andamento

### v1.2.0 - Dashboard Conectado
- [ ] Migrar AdminDashboard para queries Supabase
- [ ] Listar usuários da organização via `profiles`
- [ ] CRUD de usuários real (não localStorage)
- [ ] Criar tabela `service_orders` para processos

---

## 📋 Próximas Versões

### v1.3.0 - Ordens de Serviço
- [ ] Tabela `services` (catálogo de serviços)
- [ ] Tabela `service_orders` (ordens/processos)
- [ ] Tabela `service_order_timeline` (histórico)
- [ ] UI para criar/gerenciar ordens
- [ ] Timeline visual no dashboard do cliente

### v1.4.0 - Documentos
- [ ] Upload de documentos via Supabase Storage
- [ ] Tabela `service_order_documents`
- [ ] Visualização de documentos no dashboard
- [ ] Download de comprovantes

### v1.5.0 - Stripe Integration
- [ ] Configurar Stripe Connect
- [ ] Checkout para planos/serviços
- [ ] Webhooks para atualização de status
- [ ] Portal do cliente Stripe
- [ ] Tabela `subscriptions`

### v1.6.0 - Notificações
- [ ] Notificações in-app
- [ ] Emails transacionais (Resend/SendGrid)
- [ ] WhatsApp via API (opcional)
- [ ] Configurações de notificação por usuário

### v1.7.0 - Multi-Organização
- [ ] Usuário pode pertencer a múltiplas orgs
- [ ] Seletor de organização no header
- [ ] Convites por email
- [ ] Transferência de ownership

### v1.8.0 - Relatórios & Analytics
- [ ] Dashboard de métricas
- [ ] Relatórios de processos
- [ ] Exportação CSV/PDF
- [ ] Gráficos de performance

---

## 🔮 Futuro

- [ ] API pública para intake de processos
- [ ] Integração com sistemas jurídicos
- [ ] App mobile (React Native)
- [ ] Chatbot de atendimento
- [ ] Assinatura digital de documentos

---

## Contribuindo

Para sugerir novas features ou reportar bugs:
1. Abra uma issue no GitHub
2. Use labels: `enhancement`, `bug`, `documentation`
3. Descreva o caso de uso claramente
