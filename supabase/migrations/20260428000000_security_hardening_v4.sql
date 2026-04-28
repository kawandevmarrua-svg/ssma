-- ============================================================
-- Hardening v4:
-- 1. machines: admin pode gerenciar todas, manager pode ler
-- 2. safety_alerts: operador so pode marcar read em alertas
--    direcionados a ele ou broadcasts
-- ============================================================

-- ------------------------------------------------------------
-- 1. machines: admin/manager override policies
-- ------------------------------------------------------------

-- Admin pode fazer tudo em machines
create policy "machines_admin_all"
  on public.machines for all
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- Manager pode ler todas as machines
create policy "machines_manager_select"
  on public.machines for select
  to authenticated
  using (public.current_user_role() = 'manager');

-- ------------------------------------------------------------
-- 2. safety_alerts: restringir UPDATE de operador ao escopo
--    dele (alertas direcionados a ele ou broadcasts)
-- ------------------------------------------------------------

-- Remove policy de update aberta se existir
drop policy if exists "Operators can update alerts" on public.safety_alerts;
drop policy if exists "safety_alerts_update_operator" on public.safety_alerts;

-- Operador so pode dar update em alertas direcionados a ele ou broadcast
create policy "safety_alerts_update_operator_scoped"
  on public.safety_alerts for update
  to authenticated
  using (
    -- admin/manager podem atualizar qualquer alerta
    public.current_user_role() in ('admin', 'manager')
    or (
      -- operador: apenas alertas dele ou broadcasts
      exists (
        select 1 from public.operators o
        where o.auth_user_id = auth.uid()
          and (
            public.safety_alerts.operator_id = o.id
            or public.safety_alerts.operator_id is null
          )
      )
    )
  );
