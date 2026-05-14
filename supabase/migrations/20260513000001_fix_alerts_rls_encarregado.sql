-- Fix: encarregado (and any user) can view and respond to alerts addressed directly to them.
-- The existing policies only cover: creator, operators (via old operators table), admin/manager.
-- Encarregado has no matching policy when operator_id = auth.uid().

-- SELECT: any authenticated user can see alerts where they are the recipient
DROP POLICY IF EXISTS "Users can view alerts addressed to them" ON public.safety_alerts;
CREATE POLICY "Users can view alerts addressed to them"
  ON public.safety_alerts FOR SELECT
  USING (operator_id = auth.uid());

-- UPDATE: recipient can mark as read and respond
DROP POLICY IF EXISTS "Users can update alerts addressed to them" ON public.safety_alerts;
CREATE POLICY "Users can update alerts addressed to them"
  ON public.safety_alerts FOR UPDATE
  USING (operator_id = auth.uid());

-- Also allow encarregado to INSERT alerts (created_by = auth.uid() already covers it,
-- but the existing policy requires created_by = auth.uid() which is correct for inserts
-- from the app. No change needed for INSERT.
