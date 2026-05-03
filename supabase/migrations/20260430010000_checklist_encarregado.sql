-- ============================================================
-- SPEC: 20260430010000_checklist_encarregado.sql
-- Vincula um encarregado responsavel a cada checklist.
-- O operador escolhe na hora do preenchimento e o checklist
-- fica amarrado ao profile do encarregado.
-- ============================================================

alter table public.checklists
  add column if not exists encarregado_id uuid
    references public.profiles(id) on delete set null;

create index if not exists idx_checklists_encarregado
  on public.checklists(encarregado_id);

comment on column public.checklists.encarregado_id is
  'Profile do encarregado responsavel selecionado pelo operador no checklist.';

-- ------------------------------------------------------------
-- RLS: operadores precisam listar encarregados ativos para
-- selecionar o responsavel. Hoje a policy "Admins can view all
-- profiles" exclui o operador. Adicionamos uma policy especifica
-- que expoe APENAS profiles com role='encarregado' e active=true,
-- nada alem disso.
-- ------------------------------------------------------------
drop policy if exists profiles_view_encarregados on public.profiles;

create policy profiles_view_encarregados
  on public.profiles
  for select
  to authenticated
  using (
    role = 'encarregado'
    and active = true
  );
