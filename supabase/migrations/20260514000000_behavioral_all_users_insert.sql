-- Permite que todos os usuários autenticados façam inspeções comportamentais

BEGIN;

-- behavioral_inspections
DROP POLICY IF EXISTS "behavioral_insert" ON behavioral_inspections;
CREATE POLICY "behavioral_insert"
  ON behavioral_inspections FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- behavioral_inspection_items
DROP POLICY IF EXISTS "behavioral_items_insert" ON behavioral_inspection_items;
CREATE POLICY "behavioral_items_insert"
  ON behavioral_inspection_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- behavioral_deviations
DROP POLICY IF EXISTS "deviations_insert" ON behavioral_deviations;
CREATE POLICY "deviations_insert"
  ON behavioral_deviations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- SELECT: todos autenticados podem ver inspeções (não só operador dono + admin)
DROP POLICY IF EXISTS "behavioral_select" ON behavioral_inspections;
CREATE POLICY "behavioral_select"
  ON behavioral_inspections FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "behavioral_items_select" ON behavioral_inspection_items;
CREATE POLICY "behavioral_items_select"
  ON behavioral_inspection_items FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "deviations_select" ON behavioral_deviations;
CREATE POLICY "deviations_select"
  ON behavioral_deviations FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

COMMIT;
