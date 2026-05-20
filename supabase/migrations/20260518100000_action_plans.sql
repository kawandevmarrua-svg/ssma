-- =================================================================
-- PLANOS DE AÇÃO (CAPA) — Corrective and Preventive Actions
--
-- Transforma NC de checklists, desvios comportamentais e ordens
-- de manutenção em planos de ação rastreáveis com ciclo PDCA.
-- =================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.action_plans (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text        NOT NULL,
  description      text,

  -- Origem do plano (rastreabilidade)
  origin_type      text        NOT NULL DEFAULT 'manual'
                               CHECK (origin_type IN ('checklist_nc', 'behavioral_deviation', 'maintenance', 'manual')),
  origin_id        text,                -- ID do registro de origem (checklist_response, deviation, etc.)
  checklist_id     uuid        REFERENCES public.checklists(id) ON DELETE SET NULL,
  inspection_id    uuid        REFERENCES public.behavioral_inspections(id) ON DELETE SET NULL,
  machine_id       uuid        REFERENCES public.machines(id) ON DELETE SET NULL,

  -- Classificação e workflow
  priority         text        NOT NULL DEFAULT 'medium'
                               CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status           text        NOT NULL DEFAULT 'open'
                               CHECK (status IN ('open', 'in_progress', 'completed', 'verified', 'cancelled')),
  category         text        CHECK (category IN ('corrective', 'preventive', 'improvement')),

  -- Responsáveis
  responsible_id   uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by       uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  verified_by      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Datas
  deadline         date,
  completed_at     timestamptz,
  verified_at      timestamptz,

  -- Análise e evidência
  root_cause       text,
  corrective_action text,
  preventive_action text,
  evidence_urls    text[],
  evidence_notes   text,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.action_plans IS
  'Planos de ação CAPA. Origem: NC checklist, desvio comportamental, manutenção ou manual.';

-- Índices
CREATE INDEX IF NOT EXISTS idx_action_plans_status     ON public.action_plans(status);
CREATE INDEX IF NOT EXISTS idx_action_plans_priority   ON public.action_plans(priority);
CREATE INDEX IF NOT EXISTS idx_action_plans_responsible ON public.action_plans(responsible_id);
CREATE INDEX IF NOT EXISTS idx_action_plans_deadline   ON public.action_plans(deadline);
CREATE INDEX IF NOT EXISTS idx_action_plans_origin     ON public.action_plans(origin_type, origin_id);
CREATE INDEX IF NOT EXISTS idx_action_plans_created    ON public.action_plans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_plans_created_by ON public.action_plans(created_by);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_action_plans_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_action_plans_updated_at
  BEFORE UPDATE ON public.action_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_action_plans_updated_at();

-- RLS
ALTER TABLE public.action_plans ENABLE ROW LEVEL SECURITY;

-- SELECT: admin/manager/supervisor/encarregado veem todos; operador vê onde é responsável
CREATE POLICY action_plans_select
  ON public.action_plans FOR SELECT
  TO authenticated
  USING (
    responsible_id = auth.uid()
    OR created_by = auth.uid()
    OR public.current_user_role() IN ('admin', 'manager', 'supervisor', 'encarregado')
  );

-- INSERT: admin/manager/supervisor/encarregado podem criar
CREATE POLICY action_plans_insert
  ON public.action_plans FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('admin', 'manager', 'supervisor', 'encarregado')
  );

-- UPDATE: admin/manager podem editar qualquer; encarregado/supervisor apenas os que criou
CREATE POLICY action_plans_update
  ON public.action_plans FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR responsible_id = auth.uid()
    OR public.current_user_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    created_by = auth.uid()
    OR responsible_id = auth.uid()
    OR public.current_user_role() IN ('admin', 'manager')
  );

-- DELETE: apenas admin/manager
CREATE POLICY action_plans_delete
  ON public.action_plans FOR DELETE
  TO authenticated
  USING (
    public.current_user_role() IN ('admin', 'manager')
  );

COMMIT;
