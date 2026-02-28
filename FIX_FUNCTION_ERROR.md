# Correção: Erro de Parâmetro em Funções RLS

## Problema

Ao executar `fix_base_tables.sql`, você recebe o erro:

```
ERROR: 42P13: cannot change name of input parameter "org"
HINT: Use DROP FUNCTION is_org_member(uuid) first.
```

Isso ocorre porque as funções RLS já existem com nomes de parâmetros diferentes.

## Solução Rápida

Execute este SQL no Supabase SQL Editor **ANTES** de rodar `fix_base_tables.sql`:

```sql
-- Step 1: Drop existing functions
DROP FUNCTION IF EXISTS public.is_org_member(uuid);
DROP FUNCTION IF EXISTS public.is_org_admin(uuid);
DROP FUNCTION IF EXISTS public.get_user_org_id();

-- Step 2: Create functions with correct parameter names
CREATE OR REPLACE FUNCTION public.is_org_member(check_org_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = check_org_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_org_admin(check_org_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = check_org_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS uuid AS $$
BEGIN
  RETURN (
    SELECT org_id FROM profiles
    WHERE id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Alternativa: Usar Arquivo Atualizado

O arquivo `supabase/fix_base_tables.sql` foi atualizado para incluir os DROP statements automaticamente. Você pode executá-lo diretamente.

## Arquivo de DROP Separado

Se preferir, execute primeiro:

```bash
supabase/drop_functions.sql
```

E depois:

```bash
supabase/fix_base_tables.sql
```

## Verificação

Após executar, verifique que as funções existem:

```sql
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('is_org_member', 'is_org_admin', 'get_user_org_id');
```

Deve retornar 3 linhas.
