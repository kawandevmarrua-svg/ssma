-- =================================================================
-- SECURITY FIXES (2026-05-15)
--
-- Corrige vulnerabilidades críticas e médias identificadas em auditoria:
--
-- C-1: RLS aberta em behavioral_inspections (20260514 quebrou tudo)
--      - SELECT: qualquer autenticado via app
--      - INSERT: qualquer usuário podia criar inspeção de qualquer observer
--
-- M-5: operator_locations FK aponta para tabela operators (obsoleta)
--      após unify_operators_into_profiles; RLS usa subquery na tabela
--      errada — todo upsert de localização falha silenciosamente.
--
-- M-6: Tabela de auditoria para operações sensíveis (LGPD Art. 37)
--
-- B-1: Funções SQL criadas após o hardening inicial sem SET search_path
-- =================================================================

BEGIN;

-- =================================================================
-- FIX C-1: Behavioral inspections — restaurar controle de acesso
-- =================================================================

-- behavioral_inspections
DROP POLICY IF EXISTS "behavioral_insert" ON public.behavioral_inspections;
DROP POLICY IF EXISTS "behavioral_select" ON public.behavioral_inspections;

-- INSERT: caller deve ser o observador, ou admin/manager (em nome de terceiro)
CREATE POLICY "behavioral_insert"
  ON public.behavioral_inspections FOR INSERT
  TO authenticated
  WITH CHECK (
    observer_id = auth.uid()
    OR public.current_user_role() IN ('admin', 'manager')
  );

-- SELECT: sujeito vê as próprias; observador vê as que criou;
--         roles supervisores veem tudo (para gestão de equipe)
CREATE POLICY "behavioral_select"
  ON public.behavioral_inspections FOR SELECT
  TO authenticated
  USING (
    operator_id = auth.uid()
    OR observer_id = auth.uid()
    OR public.current_user_role() IN ('admin', 'manager', 'supervisor', 'encarregado')
  );

-- behavioral_inspection_items
DROP POLICY IF EXISTS "behavioral_items_insert" ON public.behavioral_inspection_items;
DROP POLICY IF EXISTS "behavioral_items_select" ON public.behavioral_inspection_items;

CREATE POLICY "behavioral_items_insert"
  ON public.behavioral_inspection_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.behavioral_inspections bi
      WHERE bi.id = behavioral_inspection_items.inspection_id
        AND (
          bi.observer_id = auth.uid()
          OR public.current_user_role() IN ('admin', 'manager')
        )
    )
  );

CREATE POLICY "behavioral_items_select"
  ON public.behavioral_inspection_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.behavioral_inspections bi
      WHERE bi.id = behavioral_inspection_items.inspection_id
        AND (
          bi.operator_id = auth.uid()
          OR bi.observer_id = auth.uid()
          OR public.current_user_role() IN ('admin', 'manager', 'supervisor', 'encarregado')
        )
    )
  );

-- behavioral_deviations
DROP POLICY IF EXISTS "deviations_insert" ON public.behavioral_deviations;
DROP POLICY IF EXISTS "deviations_select" ON public.behavioral_deviations;

CREATE POLICY "deviations_insert"
  ON public.behavioral_deviations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.behavioral_inspections bi
      WHERE bi.id = behavioral_deviations.inspection_id
        AND (
          bi.observer_id = auth.uid()
          OR public.current_user_role() IN ('admin', 'manager')
        )
    )
  );

CREATE POLICY "deviations_select"
  ON public.behavioral_deviations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.behavioral_inspections bi
      WHERE bi.id = behavioral_deviations.inspection_id
        AND (
          bi.operator_id = auth.uid()
          OR bi.observer_id = auth.uid()
          OR public.current_user_role() IN ('admin', 'manager', 'supervisor', 'encarregado')
        )
    )
  );

-- =================================================================
-- FIX M-5: operator_locations — migrar FK de operators para profiles
--           e simplificar RLS para usar auth.uid() diretamente
-- =================================================================

-- A migration 20260429100000 unificou operadores em profiles (aplicada
-- via SQL editor). operator_locations ainda referencia operators(id)
-- e a RLS usa subquery na tabela antiga — upserts de localização falham.

ALTER TABLE public.operator_locations
  DROP CONSTRAINT IF EXISTS operator_locations_operator_id_fkey;

-- Purgar linhas órfãs ANTES de adicionar a FK para profiles.
-- Se operator_id não tiver um match em profiles.id (dados da era
-- pré-unificação com operators.id != auth.uid()), a constraint
-- falharia com foreign key violation.
DELETE FROM public.operator_locations
WHERE operator_id NOT IN (SELECT id FROM public.profiles);

ALTER TABLE public.operator_locations
  ADD CONSTRAINT operator_locations_operator_id_fkey
  FOREIGN KEY (operator_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Substituir RLS: remover subqueries na tabela operators (obsoleta)
DROP POLICY IF EXISTS operator_location_self_upsert   ON public.operator_locations;
DROP POLICY IF EXISTS operator_location_self_update   ON public.operator_locations;
DROP POLICY IF EXISTS operator_location_self_select   ON public.operator_locations;
DROP POLICY IF EXISTS operator_location_admin_select  ON public.operator_locations;
DROP POLICY IF EXISTS operator_location_admin_delete  ON public.operator_locations;

CREATE POLICY operator_location_self_upsert
  ON public.operator_locations FOR INSERT
  TO authenticated
  WITH CHECK (operator_id = auth.uid());

CREATE POLICY operator_location_self_update
  ON public.operator_locations FOR UPDATE
  TO authenticated
  USING  (operator_id = auth.uid())
  WITH CHECK (operator_id = auth.uid());

CREATE POLICY operator_location_self_select
  ON public.operator_locations FOR SELECT
  TO authenticated
  USING (operator_id = auth.uid());

-- Admin/manager/supervisor/encarregado precisam ver localizações da equipe (mapa)
CREATE POLICY operator_location_managers_select
  ON public.operator_locations FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('admin', 'manager', 'supervisor', 'encarregado'));

CREATE POLICY operator_location_admin_delete
  ON public.operator_locations FOR DELETE
  TO authenticated
  USING (public.current_user_role() IN ('admin', 'manager'));

-- =================================================================
-- FIX M-6: Tabela de auditoria — LGPD Art. 37
-- Registra operações sensíveis: criação/deleção de usuários,
-- exportação de relatórios, alterações de role.
-- Escrita exclusiva via service_role (Edge Functions).
-- =================================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid,
  user_role    text,
  action       text        NOT NULL,
  resource_type text,
  resource_id  text,
  metadata     jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.audit_log IS
  'Registro de auditoria para operacoes sensiveis. LGPD Art. 37. '
  'Escrita exclusiva via service_role (Edge Functions). '
  'Retencao recomendada: 2 anos.';

CREATE INDEX IF NOT EXISTS idx_audit_log_user_action
  ON public.audit_log(user_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource
  ON public.audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created
  ON public.audit_log(created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Apenas admin pode consultar o log via dashboard
DROP POLICY IF EXISTS audit_log_admin_select ON public.audit_log;
CREATE POLICY audit_log_admin_select
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.current_user_role() = 'admin');

-- Nenhum role autenticado pode inserir/alterar/deletar diretamente
-- (service_role das Edge Functions ignora RLS e grava diretamente)

-- =================================================================
-- FIX B-1: search_path em funções criadas após o hardening inicial
-- =================================================================

ALTER FUNCTION public.set_locations_updated_at()
  SET search_path = public;

ALTER FUNCTION public.touch_operator_location_updated_at()
  SET search_path = public;

-- Função SECURITY INVOKER (stable) — menor risco, mas boa prática
ALTER FUNCTION public.get_activity_travel_metrics(date, date)
  SET search_path = public;

-- FIX B-1 (complemento): funções criadas em migrations posteriores
-- também sem SET search_path — mesma vulnerabilidade de search_path hijack.
ALTER FUNCTION public.set_activity_questions_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_maintenance_orders_updated_at()
  SET search_path = public;

COMMIT;
