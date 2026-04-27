-- ============================================================
-- SPEC: 20260426030000_add_response_type_to_mci.sql
-- Adiciona tipo de resposta as perguntas do checklist
-- ============================================================

ALTER TABLE public.machine_checklist_items
  ADD COLUMN IF NOT EXISTS response_type text NOT NULL DEFAULT 'yes_no'
    CHECK (response_type IN ('yes_no', 'yes_no_na', 'text', 'photo', 'numeric'));

COMMENT ON COLUMN public.machine_checklist_items.response_type IS
  'yes_no = Sim/Nao | yes_no_na = Sim/Nao/N.A. | text = Texto livre | photo = Foto obrigatoria | numeric = Numero';
