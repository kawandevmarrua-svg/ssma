-- =================================================================
-- CORRECOES DE SEGURANCA (2026-05-02)
--
-- Esta migration corrige tres regressoes introduzidas por
-- 20260429030000_add_encarregado_role.sql e 20260429210000_add_encarregado_role.sql
-- que reabriram vulnerabilidades fechadas em 20260426180000_security_hardening.sql:
--
--   1) handle_new_user voltou a aceitar `role` vindo de raw_user_meta_data
--      => permite escalada de privilegio no signup.
--
--   2) profiles_role_check perdeu o valor 'pending', usado pelo signup
--      seguro como estado inicial.
--
--   3) Policies de activities/checklists permitem encarregado fazer
--      INSERT/UPDATE em registros de qualquer operador, sem vinculo
--      de supervisao => falsificacao de atividades / fraude de horas.
--
-- Decisoes:
--   - Encarregado mantem permissao de SELECT (precisa enxergar a equipe).
--   - INSERT/UPDATE em activities/checklists volta a ser restrito ao
--     proprio operator (auth.uid() = operator_id), com excecao para
--     admin/manager (papeis administrativos). Encarregado NAO insere
--     em nome de outro operador. Se essa for uma necessidade real de
--     produto, adicionar tabela operators.supervisor_id e ajustar a policy.
-- =================================================================

begin;

-- -----------------------------------------------------------------
-- 1) handle_new_user volta a hardcoded role='pending'
-- -----------------------------------------------------------------

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'manager', 'supervisor', 'encarregado', 'operator', 'pending'));

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

-- -----------------------------------------------------------------
-- 2) usuarios: re-asserta admin-only (idempotente, defesa em profundidade)
-- -----------------------------------------------------------------

drop policy if exists "usuarios_select_authenticated" on public.usuarios;
drop policy if exists "usuarios_insert_authenticated" on public.usuarios;
drop policy if exists "usuarios_update_authenticated" on public.usuarios;
drop policy if exists "usuarios_delete_authenticated" on public.usuarios;

drop policy if exists "usuarios_select_admin" on public.usuarios;
drop policy if exists "usuarios_insert_admin" on public.usuarios;
drop policy if exists "usuarios_update_admin" on public.usuarios;
drop policy if exists "usuarios_delete_admin" on public.usuarios;

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

-- -----------------------------------------------------------------
-- 3) activities: encarregado vira somente leitura.
--    INSERT/UPDATE so pelo proprio operator ou admin/manager.
-- -----------------------------------------------------------------

drop policy if exists "activities_select" on public.activities;
drop policy if exists "activities_insert" on public.activities;
drop policy if exists "activities_update" on public.activities;
drop policy if exists "activities_delete" on public.activities;

create policy "activities_select"
  on public.activities for select
  to authenticated
  using (
    operator_id = auth.uid()
    or public.current_user_role() in ('admin', 'manager', 'supervisor', 'encarregado')
  );

create policy "activities_insert"
  on public.activities for insert
  to authenticated
  with check (
    operator_id = auth.uid()
    or public.current_user_role() in ('admin', 'manager')
  );

create policy "activities_update"
  on public.activities for update
  to authenticated
  using (
    operator_id = auth.uid()
    or public.current_user_role() in ('admin', 'manager')
  )
  with check (
    operator_id = auth.uid()
    or public.current_user_role() in ('admin', 'manager')
  );

create policy "activities_delete"
  on public.activities for delete
  to authenticated
  using (
    operator_id = auth.uid()
    or public.current_user_role() in ('admin', 'manager')
  );

-- -----------------------------------------------------------------
-- 4) checklists: mesma logica
-- -----------------------------------------------------------------

drop policy if exists "checklists_select" on public.checklists;
drop policy if exists "checklists_insert" on public.checklists;
drop policy if exists "checklists_update" on public.checklists;
drop policy if exists "checklists_delete" on public.checklists;

create policy "checklists_select"
  on public.checklists for select
  to authenticated
  using (
    operator_id = auth.uid()
    or public.current_user_role() in ('admin', 'manager', 'supervisor', 'encarregado')
  );

create policy "checklists_insert"
  on public.checklists for insert
  to authenticated
  with check (
    operator_id = auth.uid()
    or public.current_user_role() in ('admin', 'manager')
  );

create policy "checklists_update"
  on public.checklists for update
  to authenticated
  using (
    operator_id = auth.uid()
    or public.current_user_role() in ('admin', 'manager')
  )
  with check (
    operator_id = auth.uid()
    or public.current_user_role() in ('admin', 'manager')
  );

create policy "checklists_delete"
  on public.checklists for delete
  to authenticated
  using (
    operator_id = auth.uid()
    or public.current_user_role() in ('admin', 'manager')
  );

-- -----------------------------------------------------------------
-- 5) checklist_responses: encarregado SELECT apenas
-- -----------------------------------------------------------------

drop policy if exists "responses_select" on public.checklist_responses;
drop policy if exists "responses_insert" on public.checklist_responses;
drop policy if exists "responses_update" on public.checklist_responses;
drop policy if exists "responses_delete" on public.checklist_responses;

create policy "responses_select"
  on public.checklist_responses for select
  to authenticated
  using (
    exists (
      select 1 from public.checklists c
      where c.id = checklist_responses.checklist_id
        and (
          c.operator_id = auth.uid()
          or public.current_user_role() in ('admin', 'manager', 'supervisor', 'encarregado')
        )
    )
  );

create policy "responses_insert"
  on public.checklist_responses for insert
  to authenticated
  with check (
    exists (
      select 1 from public.checklists c
      where c.id = checklist_responses.checklist_id
        and (
          c.operator_id = auth.uid()
          or public.current_user_role() in ('admin', 'manager')
        )
    )
  );

create policy "responses_update"
  on public.checklist_responses for update
  to authenticated
  using (
    exists (
      select 1 from public.checklists c
      where c.id = checklist_responses.checklist_id
        and (
          c.operator_id = auth.uid()
          or public.current_user_role() in ('admin', 'manager')
        )
    )
  );

create policy "responses_delete"
  on public.checklist_responses for delete
  to authenticated
  using (
    exists (
      select 1 from public.checklists c
      where c.id = checklist_responses.checklist_id
        and (
          c.operator_id = auth.uid()
          or public.current_user_role() in ('admin', 'manager')
        )
    )
  );

-- -----------------------------------------------------------------
-- 6) profiles: re-asserta hierarquia (admin ve tudo, manager nao ve admin)
--    Encarregado/supervisor: somente o proprio profile + colegas operadores.
-- -----------------------------------------------------------------

drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists "Admins can update all profiles" on public.profiles;
drop policy if exists "profiles_select_admin_all" on public.profiles;
drop policy if exists "profiles_select_manager_non_admin" on public.profiles;
drop policy if exists "profiles_select_supervisor_operators" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;

create policy "profiles_select_admin_all"
  on public.profiles for select
  to authenticated
  using (public.current_user_role() = 'admin');

create policy "profiles_select_manager_non_admin"
  on public.profiles for select
  to authenticated
  using (
    public.current_user_role() = 'manager'
    and role <> 'admin'
  );

create policy "profiles_select_supervisor_operators"
  on public.profiles for select
  to authenticated
  using (
    public.current_user_role() in ('supervisor', 'encarregado')
    and role in ('operator', 'pending')
  );

create policy "profiles_update_admin"
  on public.profiles for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

commit;
