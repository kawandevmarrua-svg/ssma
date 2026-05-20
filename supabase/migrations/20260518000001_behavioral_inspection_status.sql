-- Adiciona coluna status em behavioral_inspections para suporte a fechar/reabrir.
-- Atualiza RLS de update para usar current_user_role() e incluir encarregado/observer.

ALTER TABLE public.behavioral_inspections
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open'
  CHECK (status IN ('open', 'closed'));

CREATE INDEX IF NOT EXISTS idx_behavioral_status
  ON public.behavioral_inspections(status);

-- Reescreve policy de update: usa current_user_role() + permite observer fechar a propria
DROP POLICY IF EXISTS "behavioral_update" ON public.behavioral_inspections;
CREATE POLICY "behavioral_update"
  ON public.behavioral_inspections FOR UPDATE
  TO authenticated
  USING (
    observer_id = auth.uid()
    OR public.current_user_role() IN ('admin', 'manager', 'encarregado')
  )
  WITH CHECK (
    observer_id = auth.uid()
    OR public.current_user_role() IN ('admin', 'manager', 'encarregado')
  );
