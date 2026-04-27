-- ============================================================
-- FIX: infinite recursion detected in policy for relation "profiles"
--
-- A policy "Admins can view all profiles" fazia SELECT em
-- public.profiles dentro do seu USING, e como SELECT em profiles
-- dispara a propria policy, gera recursao infinita.
--
-- Solucao: usar uma funcao SECURITY DEFINER (que bypassa RLS) para
-- ler o role do usuario atual, e referenciar essa funcao nas policies.
-- ============================================================

-- 1. Funcao auxiliar que retorna o role do usuario autenticado.
--    SECURITY DEFINER faz a query rodar como o owner da funcao,
--    ignorando RLS e quebrando a recursao.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated, anon, service_role;

-- 2. Recriar a policy de admins/managers em profiles SEM subquery na propria tabela.
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.current_user_role() in ('admin', 'manager'));
