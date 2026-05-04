-- =================================================================
-- FIX: RLS para role encarregado/supervisor (2026-05-04)
--
-- Problemas corrigidos:
--   1. Encarregado nao conseguia ler proprio profile -> signOut loop
--   2. Encarregado nao lia safety_alerts endereçados a ele
--   3. Encarregado nao conseguia dar update em alertas (resposta/plano)
--   4. Policy "Operators can view own alerts" usava tabela obsoleta
--   5. Policy "safety_alerts_update_operator_scoped" usava tabela obsoleta
-- =================================================================

begin;

-- -----------------------------------------------------------------
-- 1. profiles: self-view para qualquer usuario autenticado
--    Sem isso encarregado nao enxerga proprio profile -> logout.
-- -----------------------------------------------------------------
drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

-- -----------------------------------------------------------------
-- 2. safety_alerts SELECT
--    a) qualquer usuario le alertas endereçados a ele (operator_id = uid)
--    b) supervisor/encarregado le broadcasts (operator_id IS NULL)
--       = alertas de NC de equipe sem destinatario especifico
-- -----------------------------------------------------------------

-- Remove policies quebradas que referenciavam tabela antiga "operators"
drop policy if exists "Operators can view own alerts" on public.safety_alerts;
drop policy if exists "Operators can respond to own alerts" on public.safety_alerts;

-- Leitura de alertas endereçados ao proprio usuario
drop policy if exists "safety_alerts_select_own" on public.safety_alerts;
create policy "safety_alerts_select_own"
  on public.safety_alerts for select
  to authenticated
  using (operator_id = auth.uid());

-- Supervisor e encarregado leem broadcasts (NC sem destinatario especifico)
drop policy if exists "safety_alerts_select_broadcast_supervisor" on public.safety_alerts;
create policy "safety_alerts_select_broadcast_supervisor"
  on public.safety_alerts for select
  to authenticated
  using (
    operator_id is null
    and public.current_user_role() in ('supervisor', 'encarregado')
  );

-- -----------------------------------------------------------------
-- 3. safety_alerts UPDATE
--    Usuario responde alertas endereçados a ele (plano de acao, leitura)
--    Remove policies quebradas baseadas na tabela antiga "operators"
-- -----------------------------------------------------------------
drop policy if exists "safety_alerts_update_operator_scoped" on public.safety_alerts;

drop policy if exists "safety_alerts_update_own" on public.safety_alerts;
create policy "safety_alerts_update_own"
  on public.safety_alerts for update
  to authenticated
  using (
    operator_id = auth.uid()
    or public.current_user_role() in ('admin', 'manager')
  );

commit;
