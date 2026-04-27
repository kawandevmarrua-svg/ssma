-- ============================================================
-- Adiciona campo EPI a pre_operation_checks
-- (formulario Vale exige verificacao de EPIs adequados)
-- Marca EPI como criterio critico no trigger de alerta.
-- ============================================================

ALTER TABLE pre_operation_checks
  ADD COLUMN IF NOT EXISTS epi_adequado boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN pre_operation_checks.epi_adequado IS
  'Operador esta com os EPIs adequados para a atividade (item critico - bloqueia liberacao)';

-- Atualiza trigger para incluir EPI como item critico
CREATE OR REPLACE FUNCTION notify_critical_pre_operation()
RETURNS TRIGGER AS $$
DECLARE
  v_operator_name text;
  v_auth_user_id uuid;
  v_issues text := '';
BEGIN
  -- Verificar itens criticos
  IF NEW.apto_operar = true AND NEW.manutencao_valida = true AND NEW.epi_adequado = true THEN
    RETURN NEW;
  END IF;

  -- Montar descricao dos problemas
  IF NEW.apto_operar = false THEN
    v_issues := v_issues || 'NAO APTO para operar. ';
  END IF;
  IF NEW.manutencao_valida = false THEN
    v_issues := v_issues || 'Manutencao do equipamento INVALIDA. ';
  END IF;
  IF NEW.epi_adequado = false THEN
    v_issues := v_issues || 'EPIs INADEQUADOS para a atividade. ';
  END IF;

  -- Buscar dados do operador
  SELECT o.name, o.auth_user_id
  INTO v_operator_name, v_auth_user_id
  FROM operators o
  WHERE o.id = NEW.operator_id;

  -- Criar alerta broadcast
  IF v_auth_user_id IS NOT NULL THEN
    INSERT INTO safety_alerts (title, message, severity, operator_id, created_by)
    VALUES (
      'Pre-Operacao Critica - ' || COALESCE(v_operator_name, 'Operador'),
      'Operador ' || COALESCE(v_operator_name, 'Desconhecido') ||
      ' reportou itens criticos na pre-operacao: ' || v_issues ||
      'Data: ' || NEW.date::text,
      'high',
      NULL,
      v_auth_user_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
