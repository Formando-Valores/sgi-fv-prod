-- SIGA-FV base schema (PostgreSQL / Supabase)
-- Multi-tenant: org_id/organization_id must be enforced by RLS per tenant.

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  full_name text not null,
  document_type text not null check (document_type in ('Bilhete de Identidade', 'Cartão de Cidadão', 'Passaporte')),
  document_number text not null,
  tax_identifier text not null,
  address text not null,
  postal_code text not null,
  phone text not null,
  email text not null,
  marital_status text not null check (marital_status in ('Solteiro', 'Casado', 'Divorciado', 'Viúvo', 'União de Facto')),
  profession text not null,
  nationality text not null,
  association_type text not null check (association_type in ('Cliente', 'Prestador de Serviços')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists clients_unique_document_per_org
  on public.clients (organization_id, document_number);

create table if not exists public.processes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  process_number text not null unique,
  status text not null default 'CADASTRO',
  assigned_to uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.process_history (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.processes(id) on delete cascade,
  action text not null,
  description text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.process_documents (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.processes(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  mime_type text not null,
  storage_provider text not null default 's3',
  uploaded_by uuid,
  created_at timestamptz not null default now()
);

-- Suggested file constraints for uploads
alter table public.process_documents
  drop constraint if exists process_documents_mime_type_check;
alter table public.process_documents
  add constraint process_documents_mime_type_check
  check (mime_type in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
    'image/webp'
  ));
