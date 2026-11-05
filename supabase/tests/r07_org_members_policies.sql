-- Teste de regressão R-07 (executar no SQL Editor; tudo é revertido no fim).
-- Substitua :uid por um utilizador 'client' e :other_org por uma organização onde ele não é membro.
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', ':uid', 'role', 'authenticated')::text, true);
do $$
begin
  begin
    insert into public.org_members(org_id, user_id, role) values (':other_org', ':uid', 'owner');
    raise exception 'FALHOU: utilizador conseguiu tornar-se owner de outra organização';
  exception when insufficient_privilege then
    raise notice 'OK: RLS bloqueou a auto-promoção a owner (42501)';
  end;
end $$;
rollback;
