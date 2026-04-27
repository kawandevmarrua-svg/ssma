-- ===========================================
-- FIX: Corrigir profiles de operadores que ficaram com role='manager'
-- O bug era que o signup nao passava role='operator' no metadata,
-- e o update do profile falhava silenciosamente por RLS.
-- ===========================================

-- Atualizar todos os profiles que tem um operator vinculado mas estao com role errado
UPDATE public.profiles
SET role = 'operator'
WHERE id IN (
  SELECT auth_user_id FROM public.operators WHERE auth_user_id IS NOT NULL
)
AND role != 'operator';

-- Garantir que as policies de alertas para operadores existem
-- (DROP + CREATE para evitar erro se ja existirem com definicao diferente)
DROP POLICY IF EXISTS "Operators can view own alerts" ON public.safety_alerts;
CREATE POLICY "Operators can view own alerts"
  ON public.safety_alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.operators
      WHERE operators.auth_user_id = auth.uid()
      AND (
        safety_alerts.operator_id = operators.id
        OR safety_alerts.operator_id IS NULL
      )
    )
  );

DROP POLICY IF EXISTS "Operators can respond to own alerts" ON public.safety_alerts;
CREATE POLICY "Operators can respond to own alerts"
  ON public.safety_alerts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.operators
      WHERE operators.auth_user_id = auth.uid()
      AND (
        safety_alerts.operator_id = operators.id
        OR safety_alerts.operator_id IS NULL
      )
    )
  );

-- Garantir que operadores podem ver seus proprios dados
DROP POLICY IF EXISTS "Operators can view own record" ON public.operators;
CREATE POLICY "Operators can view own record"
  ON public.operators FOR SELECT
  USING (auth_user_id = auth.uid());
