-- =============================================================
-- MIGRATION: Adicionar role 'encarregado' nas RLS policies
-- Encarregado tem as mesmas permissoes de visualizacao que
-- admin/manager nas tabelas de dados operacionais.
-- =============================================================

BEGIN;

-- activities
DROP POLICY IF EXISTS "activities_select" ON activities;
CREATE POLICY "activities_select" ON activities FOR SELECT USING (
  operator_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','manager','encarregado'))
);

DROP POLICY IF EXISTS "activities_insert" ON activities;
CREATE POLICY "activities_insert" ON activities FOR INSERT WITH CHECK (
  operator_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','manager','encarregado'))
);

DROP POLICY IF EXISTS "activities_update" ON activities;
CREATE POLICY "activities_update" ON activities FOR UPDATE USING (
  operator_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','manager','encarregado'))
);

-- checklists
DROP POLICY IF EXISTS "checklists_select" ON checklists;
CREATE POLICY "checklists_select" ON checklists FOR SELECT USING (
  operator_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = checklists.operator_id AND profiles.created_by = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','manager','encarregado'))
);

DROP POLICY IF EXISTS "checklists_insert" ON checklists;
CREATE POLICY "checklists_insert" ON checklists FOR INSERT WITH CHECK (
  operator_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = checklists.operator_id AND profiles.created_by = auth.uid())
);

DROP POLICY IF EXISTS "checklists_update" ON checklists;
CREATE POLICY "checklists_update" ON checklists FOR UPDATE USING (
  operator_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = checklists.operator_id AND profiles.created_by = auth.uid())
);

-- pre_operation_checks
DROP POLICY IF EXISTS "pre_op_select" ON pre_operation_checks;
CREATE POLICY "pre_op_select" ON pre_operation_checks FOR SELECT USING (
  operator_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','manager','encarregado'))
);

-- operator_scores
DROP POLICY IF EXISTS "scores_select" ON operator_scores;
CREATE POLICY "scores_select" ON operator_scores FOR SELECT USING (
  operator_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','manager','encarregado'))
);

-- behavioral_inspections
DROP POLICY IF EXISTS "behavioral_select" ON behavioral_inspections;
CREATE POLICY "behavioral_select" ON behavioral_inspections FOR SELECT USING (
  operator_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','manager','encarregado'))
);

-- checklist_responses
DROP POLICY IF EXISTS "responses_select" ON checklist_responses;
CREATE POLICY "responses_select" ON checklist_responses FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM checklists c
    WHERE c.id = checklist_responses.checklist_id
    AND (c.operator_id = auth.uid()
         OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','manager','encarregado')))
  )
);

DROP POLICY IF EXISTS "responses_insert" ON checklist_responses;
CREATE POLICY "responses_insert" ON checklist_responses FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM checklists c
    WHERE c.id = checklist_responses.checklist_id
    AND (c.operator_id = auth.uid()
         OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','manager','encarregado')))
  )
);

-- profiles: encarregado pode ver todos os profiles
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (
  id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','manager','encarregado'))
);

COMMIT;
