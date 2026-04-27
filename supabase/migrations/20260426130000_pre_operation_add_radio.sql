-- ============================================================
-- Adiciona campo radio_comunicacao a pre_operation_checks
-- (formulario Vale exige verificacao de radio bidirecional como
--  parte da pre-operacao, nao apenas no checklist da maquina)
-- ============================================================

ALTER TABLE pre_operation_checks
  ADD COLUMN IF NOT EXISTS radio_comunicacao boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN pre_operation_checks.radio_comunicacao IS
  'Equipamento disponibiliza radio de comunicacao para a atividade';
