-- ============================================================
-- FIX: Permitir admin/manager criar e atualizar atividades
-- A policy original so checava auth_user_id (operador)
-- Faltava fallback para admin/manager
-- ============================================================

-- 1. Recriar INSERT policy com suporte a admin/manager
DROP POLICY IF EXISTS "activities_insert" ON activities;
CREATE POLICY "activities_insert"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM operators WHERE id = activities.operator_id AND auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- 2. Recriar UPDATE policy com suporte a admin/manager
DROP POLICY IF EXISTS "activities_update" ON activities;
CREATE POLICY "activities_update"
  ON activities FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM operators WHERE id = activities.operator_id AND auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );
