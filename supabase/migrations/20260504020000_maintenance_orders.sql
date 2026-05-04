-- ============================================================
-- Ordens de manutenção
-- ============================================================

create table if not exists public.maintenance_orders (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid references public.machines(id) on delete set null,
  checklist_id uuid references public.checklists(id) on delete set null,
  title text not null,
  description text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed')),
  responsible text,
  scheduled_date date,
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_maintenance_orders_machine on public.maintenance_orders(machine_id);
create index if not exists idx_maintenance_orders_status on public.maintenance_orders(status);

create or replace function public.set_maintenance_orders_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_maintenance_orders_updated_at on public.maintenance_orders;
create trigger trg_maintenance_orders_updated_at
  before update on public.maintenance_orders
  for each row execute function public.set_maintenance_orders_updated_at();

alter table public.maintenance_orders enable row level security;

drop policy if exists "maintenance_orders_select" on public.maintenance_orders;
create policy "maintenance_orders_select"
  on public.maintenance_orders for select
  to authenticated
  using (true);

drop policy if exists "maintenance_orders_insert" on public.maintenance_orders;
create policy "maintenance_orders_insert"
  on public.maintenance_orders for insert
  to authenticated
  with check (public.current_user_role() in ('admin', 'manager'));

drop policy if exists "maintenance_orders_update" on public.maintenance_orders;
create policy "maintenance_orders_update"
  on public.maintenance_orders for update
  to authenticated
  using (public.current_user_role() in ('admin', 'manager'))
  with check (public.current_user_role() in ('admin', 'manager'));

drop policy if exists "maintenance_orders_delete" on public.maintenance_orders;
create policy "maintenance_orders_delete"
  on public.maintenance_orders for delete
  to authenticated
  using (public.current_user_role() = 'admin');
