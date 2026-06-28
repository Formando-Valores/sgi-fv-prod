-- Communication system for processes
create table if not exists public.process_messages (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.processes(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  attachments jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_process_messages_process
  on public.process_messages(process_id, created_at);

alter table public.process_messages enable row level security;

-- Sender can read their own messages; participants of the process can read too
create policy "process_messages_select"
  on public.process_messages for select
  using (
    sender_id = auth.uid()
    or
    process_id in (
      select id from public.processes
      where cliente_user_id = auth.uid()
         or responsavel_user_id = auth.uid()
    )
    or
    exists (
      select 1 from public.org_members om
      join public.organizations o on o.id = om.org_id
      where om.user_id = auth.uid()
        and om.role != 'client'
        and o.slug = 'default'
    )
  );

-- Anyone with access to the process can insert
create policy "process_messages_insert"
  on public.process_messages for insert
  with check (
    sender_id = auth.uid()
    and
    process_id in (
      select id from public.processes
      where cliente_user_id = auth.uid()
         or responsavel_user_id = auth.uid()
    )
    or
    exists (
      select 1 from public.org_members om
      join public.organizations o on o.id = om.org_id
      where om.user_id = auth.uid()
        and om.role != 'client'
        and o.slug = 'default'
    )
  );
