-- ============================================================
-- SPEC: 20260429200000_location_history.sql
-- Historico de posicoes GPS (breadcrumbs) para calculo de
-- distancia percorrida por atividade.
-- ============================================================

create table if not exists public.location_history (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.profiles(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete set null,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  speed double precision,
  heading double precision,
  recorded_at timestamptz not null default now()
);

create index if not exists idx_location_history_activity
  on public.location_history(activity_id, recorded_at);

create index if not exists idx_location_history_operator_date
  on public.location_history(operator_id, recorded_at desc);

comment on table public.location_history is 'Breadcrumbs GPS para calculo de distancia percorrida por atividade.';

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.location_history enable row level security;

-- Operador insere seus proprios registros
create policy location_history_operator_insert
  on public.location_history
  for insert
  to authenticated
  with check (operator_id = auth.uid());

-- Operador le seus proprios registros
create policy location_history_self_select
  on public.location_history
  for select
  to authenticated
  using (operator_id = auth.uid());

-- Admin / manager leem todos
create policy location_history_admin_select
  on public.location_history
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'manager')
    )
  );

-- Admin pode limpar
create policy location_history_admin_delete
  on public.location_history
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

-- ------------------------------------------------------------
-- RPC: metricas de deslocamento por atividade
-- Calcula distancia total (haversine), contagem de pontos,
-- primeiro movimento e velocidade maxima.
-- ------------------------------------------------------------
create or replace function public.get_activity_travel_metrics(
  p_from date default current_date - 30,
  p_to date default current_date
)
returns table(
  activity_id uuid,
  distance_km double precision,
  point_count bigint,
  first_move_at timestamptz,
  last_point_at timestamptz,
  max_speed double precision
)
language sql stable
as $$
  with points as (
    select
      lh.activity_id,
      lh.latitude,
      lh.longitude,
      lh.speed,
      lh.recorded_at,
      lag(lh.latitude) over (partition by lh.activity_id order by lh.recorded_at) as prev_lat,
      lag(lh.longitude) over (partition by lh.activity_id order by lh.recorded_at) as prev_lng
    from public.location_history lh
    inner join public.activities a on a.id = lh.activity_id
    where a.date between p_from and p_to
      and lh.activity_id is not null
  ),
  segments as (
    select
      activity_id,
      recorded_at,
      speed,
      case when prev_lat is not null then
        6371 * 2 * asin(sqrt(
          power(sin(radians(latitude - prev_lat) / 2), 2) +
          cos(radians(prev_lat)) * cos(radians(latitude)) *
          power(sin(radians(longitude - prev_lng) / 2), 2)
        ))
      else 0 end as segment_km
    from points
  )
  select
    segments.activity_id,
    coalesce(sum(segment_km), 0)::double precision as distance_km,
    count(*)::bigint as point_count,
    min(case when segment_km > 0.01 then recorded_at end) as first_move_at,
    max(recorded_at) as last_point_at,
    coalesce(max(speed), 0)::double precision as max_speed
  from segments
  group by segments.activity_id;
$$;

comment on function public.get_activity_travel_metrics is 'Retorna distancia percorrida (km) e metricas de deslocamento para cada atividade no periodo.';
