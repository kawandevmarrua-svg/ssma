-- Adiciona roles 'encarregado' e 'supervisor' na constraint e corrige trigger + policies

-- 1. Atualizar constraint para aceitar todos os roles
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'manager', 'supervisor', 'encarregado', 'operator'));

-- 2. Atualizar trigger handle_new_user para aceitar todos os roles validos
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
    case
      when new.raw_user_meta_data->>'role' in ('admin', 'manager', 'supervisor', 'encarregado', 'operator')
        then new.raw_user_meta_data->>'role'
      else 'operator'
    end
  );
  return new;
end;
$$;

-- 3. Atualizar RLS policy para visualizacao de profiles
drop policy if exists "Admins can view all profiles" on public.profiles;

create policy "Admins can view all profiles"
  on public.profiles for select
  using (current_user_role() in ('admin', 'manager', 'supervisor', 'encarregado'));

-- 4. Permitir edicao de perfis de outros usuarios
drop policy if exists "Admins can update all profiles" on public.profiles;

create policy "Admins can update all profiles"
  on public.profiles for update
  using (current_user_role() in ('admin', 'manager', 'supervisor', 'encarregado'));

-- 5. Atualizar policy de checklists
drop policy if exists "checklists_select" on public.checklists;

create policy "checklists_select"
  on public.checklists for select
  using (
    operator_id = auth.uid()
    or exists (
      select 1 from profiles
      where profiles.id = checklists.operator_id
        and profiles.created_by = auth.uid()
    )
    or exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'manager', 'supervisor', 'encarregado')
    )
  );
