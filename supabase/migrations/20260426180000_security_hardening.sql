-- ============================================================
-- Hardening de seguranca:
-- 1. Trigger handle_new_user nao confia em metadata (role default = 'pending')
-- 2. RLS de usuarios: somente admins
-- 3. Storage policies endurecidas (pasta por usuario, sem SELECT aberto)
-- 4. Tabela user_push_tokens isolada de profiles + drop de profiles.push_token
-- 5. Bloqueio de auto-promocao via update em profiles.role
-- ============================================================

-- ------------------------------------------------------------
-- 1. Restringir trigger handle_new_user
--    Nao confiar em raw_user_meta_data->>'role'.
--    Novo signup recebe role 'pending' por padrao; admin promove depois.
-- ------------------------------------------------------------

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'manager', 'operator', 'pending'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'pending'
  );
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 2. usuarios: trocar policies abertas por admin-only
-- ------------------------------------------------------------

drop policy if exists "usuarios_select_authenticated" on public.usuarios;
drop policy if exists "usuarios_insert_authenticated" on public.usuarios;
drop policy if exists "usuarios_update_authenticated" on public.usuarios;
drop policy if exists "usuarios_delete_authenticated" on public.usuarios;

create policy "usuarios_select_admin"
  on public.usuarios for select
  to authenticated
  using (public.current_user_role() = 'admin');

create policy "usuarios_insert_admin"
  on public.usuarios for insert
  to authenticated
  with check (public.current_user_role() = 'admin');

create policy "usuarios_update_admin"
  on public.usuarios for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

create policy "usuarios_delete_admin"
  on public.usuarios for delete
  to authenticated
  using (public.current_user_role() = 'admin');

-- ------------------------------------------------------------
-- 3. Storage policies endurecidas
-- ------------------------------------------------------------

-- checklist-photos: drop policies antigas e cria policies por pasta = uid
drop policy if exists "Users can upload checklist photos" on storage.objects;
drop policy if exists "Authenticated users can view checklist photos" on storage.objects;
drop policy if exists "Users can delete own checklist photos" on storage.objects;
drop policy if exists "Operators can upload checklist photos" on storage.objects;

create policy "checklist_photos_select_own_or_admin"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'checklist-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.current_user_role() in ('admin', 'manager')
    )
  );

create policy "checklist_photos_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'checklist-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "checklist_photos_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'checklist-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "checklist_photos_delete_own_or_admin"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'checklist-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.current_user_role() in ('admin', 'manager')
    )
  );

-- activity-photos: SELECT do dono ou admin/manager; INSERT/UPDATE/DELETE so dono
drop policy if exists "activity_photos_select" on storage.objects;
drop policy if exists "activity_photos_insert" on storage.objects;

create policy "activity_photos_select_own_or_admin"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'activity-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.current_user_role() in ('admin', 'manager')
    )
  );

create policy "activity_photos_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'activity-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "activity_photos_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'activity-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "activity_photos_delete_own_or_admin"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'activity-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.current_user_role() in ('admin', 'manager')
    )
  );

-- inspection-photos: somente admin/manager le e escreve
drop policy if exists "inspection_photos_select" on storage.objects;
drop policy if exists "inspection_photos_insert" on storage.objects;

create policy "inspection_photos_select_admin"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'inspection-photos'
    and public.current_user_role() in ('admin', 'manager')
  );

create policy "inspection_photos_insert_admin"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'inspection-photos'
    and public.current_user_role() in ('admin', 'manager')
  );

create policy "inspection_photos_update_admin"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'inspection-photos'
    and public.current_user_role() in ('admin', 'manager')
  );

create policy "inspection_photos_delete_admin"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'inspection-photos'
    and public.current_user_role() in ('admin', 'manager')
  );

-- ------------------------------------------------------------
-- 4. user_push_tokens isolada de profiles
-- ------------------------------------------------------------

create table if not exists public.user_push_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  push_token text not null,
  updated_at timestamptz not null default now()
);

alter table public.user_push_tokens enable row level security;

drop policy if exists "user_push_tokens_select_own" on public.user_push_tokens;
drop policy if exists "user_push_tokens_upsert_own" on public.user_push_tokens;
drop policy if exists "user_push_tokens_update_own" on public.user_push_tokens;
drop policy if exists "user_push_tokens_delete_own" on public.user_push_tokens;

-- Apenas o dono enxerga seu proprio token. Service role acessa para enviar pushes.
create policy "user_push_tokens_select_own"
  on public.user_push_tokens for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_push_tokens_insert_own"
  on public.user_push_tokens for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user_push_tokens_update_own"
  on public.user_push_tokens for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_push_tokens_delete_own"
  on public.user_push_tokens for delete
  to authenticated
  using (auth.uid() = user_id);

-- Migrar tokens existentes (se houver) e remover coluna.
-- A funcao antiga get_operator_push_tokens depende de profiles.push_token,
-- entao recriamos antes do DROP COLUMN para apontar pra user_push_tokens.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'push_token'
  ) then
    insert into public.user_push_tokens (user_id, push_token, updated_at)
    select id, push_token, now()
    from public.profiles
    where push_token is not null
    on conflict (user_id) do update set push_token = excluded.push_token,
                                        updated_at = excluded.updated_at;
  end if;
end $$;

create or replace function public.get_operator_push_tokens(target_operator_id uuid default null)
returns table(push_token text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_operator_id is not null then
    return query
      select t.push_token
      from public.user_push_tokens t
      join public.operators o on o.auth_user_id = t.user_id
      where o.id = target_operator_id
        and t.push_token is not null;
  else
    return query
      select t.push_token
      from public.user_push_tokens t
      join public.profiles p on p.id = t.user_id
      where p.role = 'operator'
        and t.push_token is not null;
  end if;
end;
$$;

alter table public.profiles drop column if exists push_token;

-- ------------------------------------------------------------
-- 5. Bloquear auto-promocao: usuario nao pode mudar o proprio role
-- ------------------------------------------------------------

create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  caller_role := public.current_user_role();
  if new.role is distinct from old.role then
    if caller_role <> 'admin' then
      raise exception 'Apenas admins podem alterar role';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_role_self_escalation on public.profiles;
create trigger trg_prevent_role_self_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_self_escalation();

-- ------------------------------------------------------------
-- 6. Search path lockdown nas funcoes SECURITY DEFINER existentes
-- ------------------------------------------------------------

alter function public.notify_blocking_nc()                set search_path = public;
alter function public.notify_behavioral_inspection()      set search_path = public;
alter function public.notify_critical_deviation()         set search_path = public;
alter function public.notify_critical_pre_operation()     set search_path = public;
alter function public.dispatch_push_notification()        set search_path = public, extensions;
alter function public.handle_new_user()                   set search_path = public;
alter function public.generate_machine_qr_code()          set search_path = public;
alter function public.set_machines_updated_at()           set search_path = public;

-- ------------------------------------------------------------
-- 7. Hierarquia de visibilidade de profiles
--    Manager nao precisa enxergar admins.
-- ------------------------------------------------------------

drop policy if exists "Admins can view all profiles" on public.profiles;

create policy "profiles_select_admin_all"
  on public.profiles for select
  using (public.current_user_role() = 'admin');

create policy "profiles_select_manager_non_admin"
  on public.profiles for select
  using (
    public.current_user_role() = 'manager'
    and role <> 'admin'
  );

-- ------------------------------------------------------------
-- 8. operators.auth_user_id: ON DELETE SET NULL (em vez de orfaos)
-- ------------------------------------------------------------

do $$
declare
  v_constraint text;
begin
  select c.conname into v_constraint
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'operators'
    and c.contype = 'f'
    and pg_get_constraintdef(c.oid) ilike '%(auth_user_id)%references auth.users%';

  if v_constraint is not null then
    execute format('alter table public.operators drop constraint %I', v_constraint);
  end if;
end $$;

alter table public.operators
  add constraint operators_auth_user_id_fkey
  foreign key (auth_user_id) references auth.users(id) on delete set null;

-- ------------------------------------------------------------
-- 9. dispatch_push_notification: passar X-Internal-Secret na chamada
-- ------------------------------------------------------------

create or replace function public.dispatch_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_type text;
  v_supabase_url text;
  v_service_key text;
  v_internal_secret text;
begin
  if new.title like 'Item Impeditivo%' then
    v_type := 'blocking_nc';
  elsif new.title like 'Inspecao Comportamental%' then
    v_type := 'behavioral_inspection';
  elsif new.title like 'Desvio%' then
    v_type := 'critical_deviation';
  elsif new.title like 'Pre-Operacao%' then
    v_type := 'blocking_nc';
  else
    v_type := 'custom';
  end if;

  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_key := current_setting('app.settings.service_role_key', true);
  v_internal_secret := current_setting('app.settings.internal_function_secret', true);

  if v_supabase_url is null or v_supabase_url = '' then return new; end if;
  if v_service_key is null or v_service_key = '' then return new; end if;
  if v_internal_secret is null or v_internal_secret = '' then return new; end if;

  perform extensions.http_post(
    url := v_supabase_url || '/functions/v1/notify-blocking-item',
    body := json_build_object(
      'type', v_type,
      'alert_id', new.id::text,
      'operator_id', new.operator_id::text
    )::text,
    headers := json_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key,
      'X-Internal-Secret', v_internal_secret
    )::jsonb
  );

  return new;
exception
  when others then
    return new;
end;
$$;
