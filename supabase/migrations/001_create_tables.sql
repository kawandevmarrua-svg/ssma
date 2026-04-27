-- ============================================================
-- SPEC: 001_create_tables.sql
-- Fase 1 - Criacao de todas as novas tabelas
-- Projeto: Seguranca em 360 - Smart Vision
-- Data: 2026-04-26
-- ============================================================

-- Extensao para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. equipment_types
-- Armazena os 29 tipos de equipamento do PRO-040169
-- ============================================================
CREATE TABLE IF NOT EXISTS equipment_types (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  category text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE equipment_types IS 'Tipos de equipamento conforme PRO-040169 rev.02';

-- ============================================================
-- 2. checklist_template_items
-- Itens de inspecao pre-uso por tipo de equipamento
-- ============================================================
CREATE TABLE IF NOT EXISTS checklist_template_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_type_id uuid NOT NULL REFERENCES equipment_types(id) ON DELETE CASCADE,
  description text NOT NULL,
  is_blocking boolean NOT NULL DEFAULT false,
  section text,
  order_index int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_template_items_type ON checklist_template_items(equipment_type_id);

COMMENT ON TABLE checklist_template_items IS 'Itens de inspecao pre-uso. is_blocking=true indica item impeditivo (NC bloqueia liberacao)';

-- ============================================================
-- 3. pre_operation_checks
-- Verificacao pre-operacao (Smart Vision 360)
-- ============================================================
CREATE TABLE IF NOT EXISTS pre_operation_checks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  operator_id uuid NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  checklist_fisico boolean NOT NULL DEFAULT false,
  prontos_preenchido boolean NOT NULL DEFAULT false,
  apto_operar boolean NOT NULL DEFAULT false,
  conhece_limites boolean NOT NULL DEFAULT false,
  art_disponivel boolean NOT NULL DEFAULT false,
  liberacao_acesso boolean,
  pts_preenchida boolean,
  local_adequado boolean NOT NULL DEFAULT false,
  local_sinalizado boolean NOT NULL DEFAULT false,
  manutencao_valida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(operator_id, date)
);

CREATE INDEX idx_pre_op_operator ON pre_operation_checks(operator_id);

COMMENT ON TABLE pre_operation_checks IS 'Verificacao pre-operacao obrigatoria antes de iniciar jornada (Smart Vision 360)';

-- ============================================================
-- 4. Evolucao da tabela checklists (ADD COLUMNS)
-- ============================================================
ALTER TABLE checklists
  ADD COLUMN IF NOT EXISTS equipment_type_id uuid REFERENCES equipment_types(id),
  ADD COLUMN IF NOT EXISTS pre_operation_id uuid REFERENCES pre_operation_checks(id),
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS tag text,
  ADD COLUMN IF NOT EXISTS shift text,
  ADD COLUMN IF NOT EXISTS max_load_capacity text,
  ADD COLUMN IF NOT EXISTS result text CHECK (result IN ('released', 'not_released')),
  ADD COLUMN IF NOT EXISTS inspector_name text,
  ADD COLUMN IF NOT EXISTS inspector_registration text;

COMMENT ON COLUMN checklists.result IS 'released = EQUIPAMENTO LIBERADO AO TRABALHO / not_released = NAO LIBERADO, SOLICITAR MANUTENCAO';

-- ============================================================
-- 5. checklist_responses
-- Respostas C/NC/NA para cada item do template
-- ============================================================
CREATE TABLE IF NOT EXISTS checklist_responses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  checklist_id uuid NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  template_item_id uuid NOT NULL REFERENCES checklist_template_items(id),
  status text NOT NULL CHECK (status IN ('C', 'NC', 'NA')),
  photo_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_responses_checklist ON checklist_responses(checklist_id);

COMMENT ON TABLE checklist_responses IS 'Respostas do operador: C=Conforme, NC=Nao Conforme, NA=Nao Aplicavel';

-- ============================================================
-- 6. activities
-- Registro de atividades diarias do operador
-- ============================================================
CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  operator_id uuid NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  checklist_id uuid REFERENCES checklists(id),
  date date NOT NULL DEFAULT CURRENT_DATE,
  equipment_tag text,
  location text,
  description text,
  start_time timestamptz,
  end_time timestamptz,
  equipment_photo_url text,
  start_photo_url text,
  end_photo_url text,
  had_interference boolean NOT NULL DEFAULT false,
  interference_notes text,
  transit_start timestamptz,
  transit_end timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activities_operator ON activities(operator_id);
CREATE INDEX idx_activities_date ON activities(date);

COMMENT ON TABLE activities IS 'Registro de atividades. Um operador pode ter multiplas atividades por dia';

-- ============================================================
-- 7. behavioral_inspections
-- Inspecao comportamental realizada pelo SSMA via web
-- ============================================================
CREATE TABLE IF NOT EXISTS behavioral_inspections (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  observer_id uuid NOT NULL REFERENCES profiles(id),
  operator_id uuid NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  time time,
  unit_contract text,
  area text,
  equipment text,
  activity_type text,
  observation_type text NOT NULL CHECK (observation_type IN (
    'routine', 'critical_activity', 'post_incident', 'deviation_followup', 'scheduled_audit'
  )),
  overall_classification text CHECK (overall_classification IN ('safe', 'attention', 'critical')),
  safe_behavior_description text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_behavioral_operator ON behavioral_inspections(operator_id);
CREATE INDEX idx_behavioral_date ON behavioral_inspections(date);

-- ============================================================
-- 8. behavioral_inspection_items
-- Itens do checklist comportamental (6 categorias)
-- ============================================================
CREATE TABLE IF NOT EXISTS behavioral_inspection_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_id uuid NOT NULL REFERENCES behavioral_inspections(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN (
    'risk_perception', 'attitude', 'ppe', 'operation', 'communication', 'environment'
  )),
  description text NOT NULL,
  status text NOT NULL CHECK (status IN ('sim', 'nao', 'na')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_behavioral_items_inspection ON behavioral_inspection_items(inspection_id);

-- ============================================================
-- 9. behavioral_deviations
-- Desvios identificados na inspecao comportamental
-- ============================================================
CREATE TABLE IF NOT EXISTS behavioral_deviations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_id uuid NOT NULL REFERENCES behavioral_inspections(id) ON DELETE CASCADE,
  description text NOT NULL,
  risk_level text NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  immediate_action text CHECK (immediate_action IN (
    'verbal_guidance', 'activity_intervention', 'activity_stoppage', 'immediate_correction'
  )),
  immediate_action_description text,
  corrective_action text,
  responsible text,
  deadline date,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_deviations_inspection ON behavioral_deviations(inspection_id);
CREATE INDEX idx_deviations_status ON behavioral_deviations(status);

-- ============================================================
-- 10. operator_scores
-- Indicadores e score mensal do operador
-- ============================================================
CREATE TABLE IF NOT EXISTS operator_scores (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  operator_id uuid NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  period text NOT NULL,
  checklists_total int NOT NULL DEFAULT 0,
  checklists_done int NOT NULL DEFAULT 0,
  inspections_total int NOT NULL DEFAULT 0,
  inspections_done int NOT NULL DEFAULT 0,
  deviations_count int NOT NULL DEFAULT 0,
  critical_deviations int NOT NULL DEFAULT 0,
  productivity_index numeric(5,2) DEFAULT 0,
  avg_operation_minutes int DEFAULT 0,
  interventions_count int NOT NULL DEFAULT 0,
  score numeric(5,2) DEFAULT 0,
  calculated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(operator_id, period)
);

CREATE INDEX idx_scores_operator ON operator_scores(operator_id);
CREATE INDEX idx_scores_period ON operator_scores(period);

COMMENT ON TABLE operator_scores IS 'Score mensal calculado. period formato YYYY-MM';

-- ============================================================
-- 11. Storage buckets
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('activity-photos', 'activity-photos', false),
  ('inspection-photos', 'inspection-photos', false)
ON CONFLICT (id) DO NOTHING;
