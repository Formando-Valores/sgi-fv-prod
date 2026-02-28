# Correção das Tabelas Base Multi-Tenant

## Problema

O erro `400 (Bad Request)` em `/rest/v1/org_members?select=id&limit=1` indica que:
1. A tabela `org_members` não existe, OU
2. As políticas RLS estão bloqueando o acesso para o usuário

## Solução Rápida

Execute o arquivo `supabase/fix_base_tables.sql` **completo** no SQL Editor do Supabase:

1. Acesse: https://supabase.com/dashboard/project/ktrrqaqaljdcmxqdcff/sql/new
2. Copie TODO o conteúdo de `supabase/fix_base_tables.sql`
3. Cole no editor e clique em "Run"

## O que o script faz

### Parte 1-3: Criação de Tabelas
- `organizations` - Empresas/organizações
- `org_members` - Vínculo usuário↔organização com role
- `profiles` - Dados de perfil do usuário
- Cria organização "default" para novos usuários

### Parte 4: Funções Helper
- `is_org_member(org_id)` - Verifica se usuário é membro
- `is_org_admin(org_id)` - Verifica se é admin/owner
- `get_user_org_id()` - Retorna org_id do usuário atual

### Parte 5-6: Políticas RLS
Configura Row Level Security para isolamento multi-tenant:
- Usuários só veem dados da sua organização
- Admins podem gerenciar membros
- Novos usuários podem criar sua própria membership

### Parte 7-8: Vinculação Automática
- Vincula usuários existentes à organização padrão
- Cria memberships como `admin` automaticamente

## Verificação

Após executar, rode estas queries:

```sql
-- Verificar tabelas existem
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('organizations', 'profiles', 'org_members')
ORDER BY table_name;

-- Verificar RLS está ativo
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('organizations', 'profiles', 'org_members');

-- Verificar políticas
SELECT tablename, policyname FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Verificar dados
SELECT * FROM organizations;
SELECT * FROM org_members;
SELECT * FROM profiles;
```

## Ordem Correta de Migrations

Se preferir executar migrations separadamente:

```
1. supabase/fix_base_tables.sql      (ou 001 + 002)
2. supabase/migrations/003_v_user_context.sql
3. supabase/migrations/004_processes.sql
4. supabase/migrations/005_rls_processes.sql
5. supabase/fix_process_events.sql   (se necessário)
```

## Troubleshooting

### Erro persiste após executar?
1. Faça logout no app
2. Limpe o cache do navegador (Ctrl+Shift+Delete)
3. Faça login novamente

### Usuário não aparece em org_members?
Execute manualmente:
```sql
-- Substitua pelo email do usuário
INSERT INTO org_members (org_id, user_id, role)
SELECT 
  (SELECT id FROM organizations WHERE slug = 'default'),
  id,
  'admin'
FROM auth.users 
WHERE email = 'SEU_EMAIL@exemplo.com'
ON CONFLICT DO NOTHING;
```

### Verificar usuário atual
```sql
SELECT 
  au.email,
  om.role,
  o.name as org_name
FROM auth.users au
LEFT JOIN org_members om ON om.user_id = au.id
LEFT JOIN organizations o ON o.id = om.org_id;
```
