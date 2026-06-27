-- Link professional_schedules to processes
alter table public.professional_schedules
  add column if not exists process_id uuid references public.processes(id) on delete set null;

create index if not exists idx_professional_schedules_process
  on public.professional_schedules(process_id);
