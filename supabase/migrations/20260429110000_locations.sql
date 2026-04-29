-- ============================================================
-- SPEC: 20260429020000_locations.sql
-- Cadastro de localidades (frentes de trabalho, fazendas, setores).
-- Master data usada para vincular atividades/operacoes a um local.
-- ============================================================

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null,
  description text,
  latitude double precision,
  longitude double precision,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_locations_active on public.locations(active);
create index if not exists idx_locations_name on public.locations(name);

comment on table public.locations is 'Cadastro de localidades (frentes, fazendas, setores).';

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.locations enable row level security;

drop policy if exists locations_select_all on public.locations;
drop policy if exists locations_admin_write on public.locations;

create policy locations_select_all
  on public.locations
  for select
  to authenticated
  using (true);

create policy locations_admin_write
  on public.locations
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ------------------------------------------------------------
-- Trigger: updated_at
-- ------------------------------------------------------------
create or replace function public.set_locations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_locations_updated_at on public.locations;
create trigger trg_locations_updated_at
  before update on public.locations
  for each row execute function public.set_locations_updated_at();
