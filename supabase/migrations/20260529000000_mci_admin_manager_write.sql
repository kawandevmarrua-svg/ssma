-- ============================================================
-- SPEC: 20260529000000_mci_admin_manager_write.sql
-- Fix: alteracoes em perguntas (machine_checklist_items) nao
-- refletiam quando quem edita no painel web nao era o created_by
-- da maquina. As policies de INSERT/UPDATE/DELETE so permitiam
-- o criador, entao o UPDATE era bloqueado pela RLS (0 linhas,
-- sem erro) e o painel exibia "sucesso" falso.
--
-- Modelo do app: admin e manager tem acesso total. Concede
-- INSERT/UPDATE/DELETE de itens para admin/manager, alem do
-- created_by ja existente. Tambem concede a manager o mesmo
-- acesso total a machines que o admin ja possui.
-- ============================================================

-- 1. machine_checklist_items: admin/manager podem gerenciar todos os itens
drop policy if exists "mci_admin_manager_all" on public.machine_checklist_items;
create policy "mci_admin_manager_all"
  on public.machine_checklist_items for all
  to authenticated
  using (public.current_user_role() in ('admin', 'manager'))
  with check (public.current_user_role() in ('admin', 'manager'));

-- 2. machines: manager tambem pode gerenciar todas (admin ja podia)
drop policy if exists "machines_manager_all" on public.machines;
create policy "machines_manager_all"
  on public.machines for all
  to authenticated
  using (public.current_user_role() = 'manager')
  with check (public.current_user_role() = 'manager');
