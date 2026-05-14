-- ============================================================
-- 20260513000000_checklist_encarregado_confirmation.sql
-- Permite que o encarregado confirme o checklist feito
-- pelo operador. Registra confirmacao, timestamp e nota.
-- ============================================================

alter table public.checklists
  add column if not exists encarregado_confirmed boolean not null default false,
  add column if not exists encarregado_confirmed_at timestamptz,
  add column if not exists encarregado_confirmed_notes text;

comment on column public.checklists.encarregado_confirmed is
  'Indica se o encarregado responsavel revisou e confirmou o checklist.';
comment on column public.checklists.encarregado_confirmed_at is
  'Momento em que o encarregado confirmou o checklist.';
comment on column public.checklists.encarregado_confirmed_notes is
  'Observacao opcional do encarregado ao confirmar o checklist.';

-- RLS: encarregado pode atualizar campos de confirmacao
-- apenas em checklists onde ele e o responsavel
drop policy if exists checklists_encarregado_confirm on public.checklists;
create policy checklists_encarregado_confirm
  on public.checklists for update
  to authenticated
  using (
    encarregado_id = auth.uid()
    and public.current_user_role() = 'encarregado'
  )
  with check (
    encarregado_id = auth.uid()
    and public.current_user_role() = 'encarregado'
  );
