-- Tabela de Unidades / Contratos (obras)
create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  description text,
  address text,
  city text,
  state text,
  latitude double precision,
  longitude double precision,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices
create index if not exists idx_units_active on public.units (active);
create unique index if not exists idx_units_code on public.units (code) where code is not null;

-- RLS
alter table public.units enable row level security;

-- Admin/manager: acesso total
create policy "units_select_admin_manager"
  on public.units for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'manager')
    )
  );

create policy "units_insert_admin_manager"
  on public.units for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'manager')
    )
  );

create policy "units_update_admin_manager"
  on public.units for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'manager')
    )
  );

create policy "units_delete_admin_manager"
  on public.units for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'manager')
    )
  );

-- Encarregado: somente leitura
create policy "units_select_encarregado"
  on public.units for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'encarregado'
    )
  );

-- Operador: somente leitura de unidades ativas
create policy "units_select_operator"
  on public.units for select
  to authenticated
  using (
    active = true
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'operator'
    )
  );

-- Trigger updated_at
create or replace function public.set_units_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_units_updated_at
  before update on public.units
  for each row
  execute function public.set_units_updated_at();
