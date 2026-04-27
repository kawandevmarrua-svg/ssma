-- ===========================================
-- CHECKLIST OPERACIONAL - Supabase Schema
-- ===========================================
-- Execute este SQL no SQL Editor do seu projeto Supabase

-- Habilitar extensoes necessarias
create extension if not exists "uuid-ossp";

-- ===========================================
-- TABELA: profiles
-- ===========================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  role text not null default 'manager' check (role in ('admin', 'manager')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ===========================================
-- TABELA: operators
-- ===========================================
create table public.operators (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  email text,
  phone text,
  role text not null,
  created_by uuid references public.profiles(id) not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.operators enable row level security;

create policy "Users can view operators they created"
  on public.operators for select
  using (auth.uid() = created_by);

create policy "Users can create operators"
  on public.operators for insert
  with check (auth.uid() = created_by);

create policy "Users can update own operators"
  on public.operators for update
  using (auth.uid() = created_by);

create policy "Users can delete own operators"
  on public.operators for delete
  using (auth.uid() = created_by);

-- ===========================================
-- TABELA: checklists
-- ===========================================
create table public.checklists (
  id uuid default uuid_generate_v4() primary key,
  operator_id uuid references public.operators(id) on delete cascade not null,
  machine_name text not null,
  date date not null default current_date,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.checklists enable row level security;

create policy "Users can view checklists of their operators"
  on public.checklists for select
  using (
    exists (
      select 1 from public.operators
      where operators.id = checklists.operator_id
      and operators.created_by = auth.uid()
    )
  );

create policy "Users can create checklists for their operators"
  on public.checklists for insert
  with check (
    exists (
      select 1 from public.operators
      where operators.id = operator_id
      and operators.created_by = auth.uid()
    )
  );

create policy "Users can update checklists of their operators"
  on public.checklists for update
  using (
    exists (
      select 1 from public.operators
      where operators.id = checklists.operator_id
      and operators.created_by = auth.uid()
    )
  );

-- ===========================================
-- TABELA: checklist_items
-- ===========================================
create table public.checklist_items (
  id uuid default uuid_generate_v4() primary key,
  checklist_id uuid references public.checklists(id) on delete cascade not null,
  description text not null,
  checked boolean not null default false,
  photo_url text,
  created_at timestamptz not null default now()
);

alter table public.checklist_items enable row level security;

create policy "Users can view checklist items"
  on public.checklist_items for select
  using (
    exists (
      select 1 from public.checklists
      join public.operators on operators.id = checklists.operator_id
      where checklists.id = checklist_items.checklist_id
      and operators.created_by = auth.uid()
    )
  );

create policy "Users can create checklist items"
  on public.checklist_items for insert
  with check (
    exists (
      select 1 from public.checklists
      join public.operators on operators.id = checklists.operator_id
      where checklists.id = checklist_id
      and operators.created_by = auth.uid()
    )
  );

create policy "Users can update checklist items"
  on public.checklist_items for update
  using (
    exists (
      select 1 from public.checklists
      join public.operators on operators.id = checklists.operator_id
      where checklists.id = checklist_items.checklist_id
      and operators.created_by = auth.uid()
    )
  );

-- ===========================================
-- TABELA: safety_alerts
-- ===========================================
create table public.safety_alerts (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  message text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  operator_id uuid references public.operators(id) on delete set null,
  created_by uuid references public.profiles(id) not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.safety_alerts enable row level security;

create policy "Users can view alerts they created"
  on public.safety_alerts for select
  using (auth.uid() = created_by);

create policy "Users can create alerts"
  on public.safety_alerts for insert
  with check (auth.uid() = created_by);

create policy "Users can update own alerts"
  on public.safety_alerts for update
  using (auth.uid() = created_by);

create policy "Users can delete own alerts"
  on public.safety_alerts for delete
  using (auth.uid() = created_by);

-- ===========================================
-- STORAGE: bucket para fotos de checklist
-- ===========================================
insert into storage.buckets (id, name, public)
values ('checklist-photos', 'checklist-photos', false);

create policy "Users can upload checklist photos"
  on storage.objects for insert
  with check (
    bucket_id = 'checklist-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Authenticated users can view checklist photos"
  on storage.objects for select
  using (
    bucket_id = 'checklist-photos'
    and auth.role() = 'authenticated'
  );

create policy "Users can delete own checklist photos"
  on storage.objects for delete
  using (
    bucket_id = 'checklist-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ===========================================
-- INDICES para performance
-- ===========================================
create index idx_operators_created_by on public.operators(created_by);
create index idx_checklists_operator_id on public.checklists(operator_id);
create index idx_checklists_date on public.checklists(date);
create index idx_checklist_items_checklist_id on public.checklist_items(checklist_id);
create index idx_safety_alerts_created_by on public.safety_alerts(created_by);
create index idx_safety_alerts_operator_id on public.safety_alerts(operator_id);
create index idx_safety_alerts_read on public.safety_alerts(read);

-- ===========================================
-- TRIGGER: criar profile automaticamente no signup
-- ===========================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
