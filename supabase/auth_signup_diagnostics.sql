-- Diagnóstico de erro no signup do Supabase Auth
-- Exemplo de cenário: "Database error saving new user" (500 em /auth/v1/signup)
-- Normalmente causado por trigger/policy/constraint no fluxo auth.users -> profiles.

-- 1) Verifique se o email já existe no Auth
-- (pode existir com status não confirmado)
select id, email, created_at, email_confirmed_at
from auth.users
where lower(email) = lower('carlexandernetw@gmail.com');

-- 2) Verifique se sobrou registro em profiles para o email (resíduo comum)
select id, email, nome_completo, created_at
from public.profiles
where lower(email) = lower('carlexandernetw@gmail.com');

-- 3) Verifique vínculo em org_members
select id, user_id, org_id, role, created_at
from public.org_members
where user_id in (
  select id from public.profiles where lower(email) = lower('carlexandernetw@gmail.com')
);

-- 4) (Opcional) limpar resíduos para re-cadastro controlado
-- ATENÇÃO: execute apenas se tiver certeza do impacto.
-- delete from public.org_members where user_id in (
--   select id from public.profiles where lower(email) = lower('carlexandernetw@gmail.com')
-- );
-- delete from public.profiles where lower(email) = lower('carlexandernetw@gmail.com');
-- delete from auth.users where lower(email) = lower('carlexandernetw@gmail.com');

-- 5) Conferir triggers ligadas ao auth.users que podem falhar no insert de profiles
select trigger_name, event_manipulation, action_timing, action_statement
from information_schema.triggers
where event_object_schema = 'auth'
  and event_object_table = 'users';
