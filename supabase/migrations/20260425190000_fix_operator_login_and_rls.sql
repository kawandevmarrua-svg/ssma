-- ===========================================
-- FIX: Habilitar login de operadores + RLS + colunas faltantes
-- ===========================================

-- 1. Adicionar coluna auth_user_id na tabela operators
alter table public.operators
  add column if not exists auth_user_id uuid references auth.users(id) unique;

create index if not exists idx_operators_auth_user_id on public.operators(auth_user_id);

-- 2. Adicionar coluna push_token na tabela profiles
alter table public.profiles
  add column if not exists push_token text;

-- 3. Alterar check constraint do role em profiles para aceitar 'operator'
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'manager', 'operator'));

-- 4. Adicionar colunas response e responded_at na tabela safety_alerts
alter table public.safety_alerts
  add column if not exists response text,
  add column if not exists responded_at timestamptz;

-- ===========================================
-- 5. Corrigir trigger handle_new_user para definir role do operador
-- ===========================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case
      when new.raw_user_meta_data->>'role' = 'operator' then 'operator'
      else 'manager'
    end
  );
  return new;
end;
$$ language plpgsql security definer;

-- ===========================================
-- 6. RLS: Operadores podem ver seu proprio perfil (ja existe, funciona com auth.uid() = id)
--    Mas precisamos de policies para as outras tabelas
-- ===========================================

-- OPERATORS: operador pode ver seus proprios dados
create policy "Operators can view own record"
  on public.operators for select
  using (auth_user_id = auth.uid());

-- CHECKLISTS: operador pode ver seus checklists
create policy "Operators can view own checklists"
  on public.checklists for select
  using (
    exists (
      select 1 from public.operators
      where operators.id = checklists.operator_id
      and operators.auth_user_id = auth.uid()
    )
  );

-- CHECKLISTS: operador pode atualizar status dos seus checklists
create policy "Operators can update own checklists"
  on public.checklists for update
  using (
    exists (
      select 1 from public.operators
      where operators.id = checklists.operator_id
      and operators.auth_user_id = auth.uid()
    )
  );

-- CHECKLIST_ITEMS: operador pode ver itens dos seus checklists
create policy "Operators can view own checklist items"
  on public.checklist_items for select
  using (
    exists (
      select 1 from public.checklists
      join public.operators on operators.id = checklists.operator_id
      where checklists.id = checklist_items.checklist_id
      and operators.auth_user_id = auth.uid()
    )
  );

-- CHECKLIST_ITEMS: operador pode marcar/desmarcar itens e adicionar fotos
create policy "Operators can update own checklist items"
  on public.checklist_items for update
  using (
    exists (
      select 1 from public.checklists
      join public.operators on operators.id = checklists.operator_id
      where checklists.id = checklist_items.checklist_id
      and operators.auth_user_id = auth.uid()
    )
  );

-- SAFETY_ALERTS: operador pode ver alertas direcionados a ele ou broadcast (operator_id is null)
create policy "Operators can view own alerts"
  on public.safety_alerts for select
  using (
    exists (
      select 1 from public.operators
      where operators.auth_user_id = auth.uid()
      and (
        safety_alerts.operator_id = operators.id
        or safety_alerts.operator_id is null
      )
    )
  );

-- SAFETY_ALERTS: operador pode responder alertas (update response e responded_at)
create policy "Operators can respond to own alerts"
  on public.safety_alerts for update
  using (
    exists (
      select 1 from public.operators
      where operators.auth_user_id = auth.uid()
      and (
        safety_alerts.operator_id = operators.id
        or safety_alerts.operator_id is null
      )
    )
  );

-- STORAGE: operador pode fazer upload de fotos nos seus checklists
create policy "Operators can upload checklist photos"
  on storage.objects for insert
  with check (
    bucket_id = 'checklist-photos'
    and auth.role() = 'authenticated'
  );
