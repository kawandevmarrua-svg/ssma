-- ============================================================
-- SPEC: 20260426050000_admins_view_all_profiles.sql
-- Permite que admins/managers leiam todos os profiles,
-- para exibir nome do criador em alertas e listagens.
-- ============================================================

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.role IN ('admin', 'manager')
    )
  );
