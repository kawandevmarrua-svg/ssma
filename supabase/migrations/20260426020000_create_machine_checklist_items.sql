-- ============================================================
-- SPEC: 20260426020000_create_machine_checklist_items.sql
-- Itens de checklist (perguntas) vinculados a cada maquina
-- ============================================================

CREATE TABLE IF NOT EXISTS public.machine_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  order_index int NOT NULL DEFAULT 0,
  section text,
  description text NOT NULL,
  is_blocking boolean NOT NULL DEFAULT false,
  response_type text NOT NULL DEFAULT 'yes_no',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mci_machine ON public.machine_checklist_items(machine_id);
CREATE INDEX IF NOT EXISTS idx_mci_order ON public.machine_checklist_items(machine_id, order_index);

COMMENT ON TABLE public.machine_checklist_items IS 'Perguntas do checklist exibidas no app quando o operador escolhe uma maquina';

ALTER TABLE public.machine_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mci_select_own"
  ON public.machine_checklist_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.machines m
      WHERE m.id = machine_checklist_items.machine_id
        AND m.created_by = auth.uid()
    )
  );

CREATE POLICY "mci_insert_own"
  ON public.machine_checklist_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.machines m
      WHERE m.id = machine_checklist_items.machine_id
        AND m.created_by = auth.uid()
    )
  );

CREATE POLICY "mci_update_own"
  ON public.machine_checklist_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.machines m
      WHERE m.id = machine_checklist_items.machine_id
        AND m.created_by = auth.uid()
    )
  );

CREATE POLICY "mci_delete_own"
  ON public.machine_checklist_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.machines m
      WHERE m.id = machine_checklist_items.machine_id
        AND m.created_by = auth.uid()
    )
  );
