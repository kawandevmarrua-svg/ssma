-- ============================================================
-- Permite uma pre-operacao por atividade (em vez de uma por dia)
-- 1. Remove UNIQUE(operator_id, date) de pre_operation_checks
-- 2. Adiciona FK pre_operation_id em activities
-- ============================================================

-- 1. Remove constraint UNIQUE para permitir multiplas pre-ops por dia
ALTER TABLE pre_operation_checks
  DROP CONSTRAINT IF EXISTS pre_operation_checks_operator_id_date_key;

-- 2. Adiciona FK em activities apontando para pre_operation_checks
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS pre_operation_id uuid REFERENCES pre_operation_checks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_activities_pre_op ON activities(pre_operation_id);

COMMENT ON COLUMN activities.pre_operation_id IS
  'Pre-operacao especifica desta atividade (formulario Vale com 12 perguntas)';
