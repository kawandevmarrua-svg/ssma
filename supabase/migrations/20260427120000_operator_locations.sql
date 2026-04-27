-- ============================================================
-- SPEC: 20260427120000_operator_locations.sql
-- Tabela de localizacao em tempo real dos operadores.
-- Heartbeat: uma linha por operador, atualizada periodicamente
-- pelo app mobile enquanto o operador esta logado.
-- ============================================================

create table if not exists public.operator_locations (
  operator_id uuid primary key references public.operators(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  speed double precision,
  heading double precision,
  battery_level double precision,
  current_status text not null default 'online',
  current_activity_id uuid references public.activities(id) on delete set null,
  current_checklist_id uuid references public.checklists(id) on delete set null,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_operator_locations_updated_at
  on public.operator_locations(updated_at desc);

comment on table public.operator_locations is 'Posicao GPS atual do operador (heartbeat). 1 linha por operador.';
comment on column public.operator_locations.current_status is 'online | in_checklist | in_activity | idle | offline';

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.operator_locations enable row level security;

drop policy if exists operator_location_self_upsert on public.operator_locations;
drop policy if exists operator_location_self_select on public.operator_locations;
drop policy if exists operator_location_admin_select on public.operator_locations;
drop policy if exists operator_location_self_update on public.operator_locations;
drop policy if exists operator_location_admin_delete on public.operator_locations;

-- Operador insere/atualiza apenas a propria linha
create policy operator_location_self_upsert
  on public.operator_locations
  for insert
  to authenticated
  with check (
    operator_id in (
      select id from public.operators where auth_user_id = auth.uid()
    )
  );

create policy operator_location_self_update
  on public.operator_locations
  for update
  to authenticated
  using (
    operator_id in (
      select id from public.operators where auth_user_id = auth.uid()
    )
  )
  with check (
    operator_id in (
      select id from public.operators where auth_user_id = auth.uid()
    )
  );

-- Operador le a propria linha
create policy operator_location_self_select
  on public.operator_locations
  for select
  to authenticated
  using (
    operator_id in (
      select id from public.operators where auth_user_id = auth.uid()
    )
  );

-- Admin / manager / supervisor leem todas
create policy operator_location_admin_select
  on public.operator_locations
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin','manager','supervisor')
    )
  );

-- Admin pode limpar
create policy operator_location_admin_delete
  on public.operator_locations
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin','manager')
    )
  );

-- ------------------------------------------------------------
-- Realtime publication
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'operator_locations'
    ) then
      execute 'alter publication supabase_realtime add table public.operator_locations';
    end if;
  end if;
end$$;

-- ------------------------------------------------------------
-- Trigger para manter updated_at
-- ------------------------------------------------------------
create or replace function public.touch_operator_location_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_operator_locations_touch on public.operator_locations;
create trigger trg_operator_locations_touch
  before update on public.operator_locations
  for each row execute function public.touch_operator_location_updated_at();
