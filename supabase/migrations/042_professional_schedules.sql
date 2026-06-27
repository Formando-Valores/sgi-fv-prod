-- Professional Schedules (Agenda de Trabalho)
-- Stores 30-minute availability slots for service providers

create table if not exists public.professional_schedules (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  start_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(professional_id, date, start_time)
);

-- Index for fast queries by professional and date range
create index if not exists idx_professional_schedules_professional_date
  on public.professional_schedules(professional_id, date);

-- Enable RLS
alter table public.professional_schedules enable row level security;

-- Admins of the org can manage schedules
create policy "Admins can manage professional schedules"
  on public.professional_schedules
  for all
  using (
    exists (
      select 1 from public.org_members om
      join public.organizations o on o.id = om.org_id
      where om.user_id = auth.uid()
        and om.role in ('owner', 'admin')
        and (o.slug = 'default' or lower(o.name) like '%padr%')
    )
  )
  with check (
    exists (
      select 1 from public.org_members om
      join public.organizations o on o.id = om.org_id
      where om.user_id = auth.uid()
        and om.role in ('owner', 'admin')
        and (o.slug = 'default' or lower(o.name) like '%padr%')
    )
  );

-- Professionals can view their own schedule
create policy "Professionals can view own schedule"
  on public.professional_schedules
  for select
  using (professional_id = auth.uid());
