# 🔧 Fix: Criar Tabela process_events

## Problema
A tabela `process_events` não existe no banco de dados Supabase. Isso pode ter acontecido por:
- A migration 004 foi executada parcialmente
- Erro durante a execução que não foi percebido
- A tabela `processes` precisa existir antes de `process_events` (FK)

---

## Passo 1: Verificar tabelas existentes

Abra o **SQL Editor** do Supabase:
```
https://supabase.com/dashboard/project/[SEU-PROJETO]/sql/new
```

Execute para ver quais tabelas existem:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

**Tabelas esperadas:**
- ✅ organizations
- ✅ org_members
- ✅ profiles
- ✅ processes
- ❓ process_events (provavelmente faltando)

---

## Passo 2: Verificar dependências

A tabela `process_events` depende de:
1. **organizations** - para o `org_id`
2. **processes** - para o `process_id`

Se `processes` não existir, execute primeiro:
```sql
-- Verificar se processes existe
SELECT COUNT(*) FROM processes;
```

---

## Passo 3: Criar a tabela process_events

**Copie e cole este SQL completo no SQL Editor:**

```sql
-- ============================================
-- FIX: Create process_events table
-- ============================================

-- 1. Criar tabela
CREATE TABLE IF NOT EXISTS public.process_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  process_id uuid NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('registro','status_change','observacao','documento','atribuicao')),
  mensagem text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- 2. Comentários
COMMENT ON TABLE public.process_events IS 'Timeline de eventos do processo';
COMMENT ON COLUMN process_events.tipo IS 'registro=criação, status_change=mudança de status, observacao=nota, documento=upload, atribuicao=mudança de responsável';

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_process_events_process_id ON process_events(process_id);
CREATE INDEX IF NOT EXISTS idx_process_events_org_id ON process_events(org_id);
CREATE INDEX IF NOT EXISTS idx_process_events_created_at ON process_events(created_at DESC);

-- 4. RLS
ALTER TABLE process_events ENABLE ROW LEVEL SECURITY;

-- 5. Políticas
DROP POLICY IF EXISTS "Members can view org process events" ON process_events;
CREATE POLICY "Members can view org process events"
  ON process_events FOR SELECT
  USING (is_org_member(org_id));

DROP POLICY IF EXISTS "Admins can insert process events" ON process_events;
CREATE POLICY "Admins can insert process events"
  ON process_events FOR INSERT
  WITH CHECK (is_org_admin(org_id));

DROP POLICY IF EXISTS "Admins can update process events" ON process_events;
CREATE POLICY "Admins can update process events"
  ON process_events FOR UPDATE
  USING (is_org_admin(org_id));

-- 6. Permissões
GRANT SELECT ON process_events TO authenticated;
GRANT INSERT ON process_events TO authenticated;
GRANT UPDATE ON process_events TO authenticated;
```

---

## Passo 4: Verificar criação

Execute para confirmar:
```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'process_events'
ORDER BY ordinal_position;
```

**Resultado esperado:**
| column_name | data_type | is_nullable |
|-------------|-----------|-------------|
| id | uuid | NO |
| org_id | uuid | NO |
| process_id | uuid | NO |
| tipo | text | NO |
| mensagem | text | NO |
| created_by | uuid | YES |
| created_at | timestamp with time zone | YES |

---

## Passo 5: Verificar políticas RLS

```sql
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'process_events';
```

**Deve mostrar 3 políticas:**
- Members can view org process events (SELECT)
- Admins can insert process events (INSERT)
- Admins can update process events (UPDATE)

---

## Após a correção

1. Volte para a aplicação
2. Faça refresh da página (F5)
3. Clique em "Verificar Novamente" se o erro ainda aparecer
4. O dashboard deve carregar normalmente

---

## Arquivo SQL completo

O arquivo `supabase/fix_process_events.sql` contém todo o SQL necessário.
Você pode copiar o conteúdo inteiro e colar no SQL Editor do Supabase.
