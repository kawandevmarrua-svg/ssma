-- ============================================================
-- SPEC: 004_rls_policies.sql
-- Row Level Security para todas as novas tabelas
-- ============================================================

-- Habilitar RLS em todas as novas tabelas
ALTER TABLE equipment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pre_operation_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE behavioral_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE behavioral_inspection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE behavioral_deviations ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_scores ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- equipment_types: leitura publica, escrita somente admin/manager
-- ============================================================
CREATE POLICY "equipment_types_select"
  ON equipment_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "equipment_types_insert"
  ON equipment_types FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

CREATE POLICY "equipment_types_update"
  ON equipment_types FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

CREATE POLICY "equipment_types_delete"
  ON equipment_types FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- checklist_template_items: leitura publica, escrita admin/manager
-- ============================================================
CREATE POLICY "template_items_select"
  ON checklist_template_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "template_items_insert"
  ON checklist_template_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

CREATE POLICY "template_items_update"
  ON checklist_template_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

CREATE POLICY "template_items_delete"
  ON checklist_template_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- pre_operation_checks: operador ve/cria os proprios, admin/manager ve todos
-- ============================================================
CREATE POLICY "pre_op_select"
  ON pre_operation_checks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM operators WHERE id = pre_operation_checks.operator_id AND auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "pre_op_insert"
  ON pre_operation_checks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM operators WHERE id = pre_operation_checks.operator_id AND auth_user_id = auth.uid()
    )
  );

CREATE POLICY "pre_op_update"
  ON pre_operation_checks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM operators WHERE id = pre_operation_checks.operator_id AND auth_user_id = auth.uid()
    )
  );

-- ============================================================
-- checklist_responses: operador ve/cria os proprios, admin/manager ve todos
-- ============================================================
CREATE POLICY "responses_select"
  ON checklist_responses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM checklists c
      JOIN operators o ON o.id = c.operator_id
      WHERE c.id = checklist_responses.checklist_id
        AND (o.auth_user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')))
    )
  );

CREATE POLICY "responses_insert"
  ON checklist_responses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM checklists c
      JOIN operators o ON o.id = c.operator_id
      WHERE c.id = checklist_responses.checklist_id AND o.auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- ============================================================
-- activities: operador ve/cria as proprias, admin/manager ve todas
-- ============================================================
CREATE POLICY "activities_select"
  ON activities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM operators WHERE id = activities.operator_id AND auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "activities_insert"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM operators WHERE id = activities.operator_id AND auth_user_id = auth.uid()
    )
  );

CREATE POLICY "activities_update"
  ON activities FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM operators WHERE id = activities.operator_id AND auth_user_id = auth.uid()
    )
  );

-- ============================================================
-- behavioral_inspections: admin/manager cria e ve, operador ve as proprias
-- ============================================================
CREATE POLICY "behavioral_select"
  ON behavioral_inspections FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM operators WHERE id = behavioral_inspections.operator_id AND auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "behavioral_insert"
  ON behavioral_inspections FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

CREATE POLICY "behavioral_update"
  ON behavioral_inspections FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

-- ============================================================
-- behavioral_inspection_items: segue a inspecao pai
-- ============================================================
CREATE POLICY "behavioral_items_select"
  ON behavioral_inspection_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM behavioral_inspections bi
      WHERE bi.id = behavioral_inspection_items.inspection_id
        AND (
          EXISTS (SELECT 1 FROM operators WHERE id = bi.operator_id AND auth_user_id = auth.uid())
          OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
        )
    )
  );

CREATE POLICY "behavioral_items_insert"
  ON behavioral_inspection_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

-- ============================================================
-- behavioral_deviations: segue a inspecao pai
-- ============================================================
CREATE POLICY "deviations_select"
  ON behavioral_deviations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM behavioral_inspections bi
      WHERE bi.id = behavioral_deviations.inspection_id
        AND (
          EXISTS (SELECT 1 FROM operators WHERE id = bi.operator_id AND auth_user_id = auth.uid())
          OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
        )
    )
  );

CREATE POLICY "deviations_insert"
  ON behavioral_deviations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

CREATE POLICY "deviations_update"
  ON behavioral_deviations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

-- ============================================================
-- operator_scores: operador ve o proprio, admin/manager ve todos
-- ============================================================
CREATE POLICY "scores_select"
  ON operator_scores FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM operators WHERE id = operator_scores.operator_id AND auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "scores_insert"
  ON operator_scores FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

CREATE POLICY "scores_update"
  ON operator_scores FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

-- ============================================================
-- Storage policies para novos buckets
-- ============================================================

-- activity-photos: operador faz upload dos proprios, admin/manager ve todos
CREATE POLICY "activity_photos_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'activity-photos');

CREATE POLICY "activity_photos_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'activity-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- inspection-photos: admin/manager faz upload
CREATE POLICY "inspection_photos_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'inspection-photos');

CREATE POLICY "inspection_photos_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'inspection-photos'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );
