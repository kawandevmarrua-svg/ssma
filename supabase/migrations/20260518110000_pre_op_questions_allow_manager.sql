-- Allow manager role to manage pre_op_questions (previously admin-only)
BEGIN;

DROP POLICY IF EXISTS "pre_op_questions_admin_write" ON public.pre_op_questions;

CREATE POLICY "pre_op_questions_admin_manager_write"
  ON public.pre_op_questions FOR ALL
  TO authenticated
  USING (public.current_user_role() IN ('admin', 'manager'))
  WITH CHECK (public.current_user_role() IN ('admin', 'manager'));

COMMIT;
