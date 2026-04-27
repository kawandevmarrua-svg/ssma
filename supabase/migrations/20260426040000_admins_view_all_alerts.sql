-- ============================================================
-- SPEC: 20260426040000_admins_view_all_alerts.sql
-- Permite que qualquer admin/manager veja todos os alertas,
-- nao apenas os que ele mesmo criou.
-- ============================================================

DROP POLICY IF EXISTS "Admins can view all alerts" ON public.safety_alerts;
CREATE POLICY "Admins can view all alerts"
  ON public.safety_alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Admins can update all alerts" ON public.safety_alerts;
CREATE POLICY "Admins can update all alerts"
  ON public.safety_alerts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Admins can delete all alerts" ON public.safety_alerts;
CREATE POLICY "Admins can delete all alerts"
  ON public.safety_alerts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'manager')
    )
  );
