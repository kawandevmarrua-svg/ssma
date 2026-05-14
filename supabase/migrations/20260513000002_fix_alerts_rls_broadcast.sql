-- Fix: broadcast alerts (operator_id IS NULL) are not readable by operators/encarregados
-- in the new profile-based system. The old "Operators can view own alerts" policy
-- used operators.id (old table UUID) which no longer matches safety_alerts.operator_id
-- (now set to profiles.id = auth.uid()). New operators not in operators table fail entirely.
--
-- Solution: allow any authenticated user to read/update broadcast alerts.
-- Direct alerts (operator_id = auth.uid()) already covered by migration 20260513000001.

-- SELECT: any authenticated user can read broadcast alerts
DROP POLICY IF EXISTS "Users can view broadcast alerts" ON public.safety_alerts;
CREATE POLICY "Users can view broadcast alerts"
  ON public.safety_alerts FOR SELECT
  TO authenticated
  USING (operator_id IS NULL);

-- UPDATE: any authenticated user can mark broadcast alerts as read / respond
DROP POLICY IF EXISTS "Users can update broadcast alerts" ON public.safety_alerts;
CREATE POLICY "Users can update broadcast alerts"
  ON public.safety_alerts FOR UPDATE
  TO authenticated
  USING (operator_id IS NULL);

-- Drop the broken old operator policies that reference the stale operators table
-- (they never match in the new system since operators.id != auth.uid())
DROP POLICY IF EXISTS "Operators can view own alerts" ON public.safety_alerts;
DROP POLICY IF EXISTS "Operators can respond to own alerts" ON public.safety_alerts;
