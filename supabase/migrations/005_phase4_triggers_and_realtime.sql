-- ============================================================
-- SPEC: 005_phase4_triggers_and_realtime.sql
-- Fase 4 - Triggers automaticos e Realtime
-- Projeto: Seguranca em 360 - Smart Vision
-- Data: 2026-04-26
-- ============================================================

-- ============================================================
-- 1. Habilitar Realtime em tabelas adicionais
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE checklists;
ALTER PUBLICATION supabase_realtime ADD TABLE activities;
ALTER PUBLICATION supabase_realtime ADD TABLE behavioral_inspections;

-- ============================================================
-- 2. Trigger: Item impeditivo NC -> Alerta automatico ao gestor
-- Quando um operador marca NC em item impeditivo (is_blocking),
-- cria um safety_alert automaticamente.
-- ============================================================
CREATE OR REPLACE FUNCTION notify_blocking_nc()
RETURNS TRIGGER AS $$
DECLARE
  v_operator_id uuid;
  v_operator_name text;
  v_equipment_name text;
  v_item_description text;
  v_is_blocking boolean;
  v_auth_user_id uuid;
BEGIN
  -- Somente se status = NC
  IF NEW.status <> 'NC' THEN
    RETURN NEW;
  END IF;

  -- Verificar se o item eh impeditivo
  SELECT cti.description, cti.is_blocking
  INTO v_item_description, v_is_blocking
  FROM checklist_template_items cti
  WHERE cti.id = NEW.template_item_id;

  -- Se nao encontrou ou nao eh impeditivo, ignorar
  IF NOT FOUND OR v_is_blocking IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Buscar dados do checklist e operador
  SELECT c.operator_id
  INTO v_operator_id
  FROM checklists c
  WHERE c.id = NEW.checklist_id;

  SELECT o.name, o.auth_user_id
  INTO v_operator_name, v_auth_user_id
  FROM operators o
  WHERE o.id = v_operator_id;

  -- Buscar nome do equipamento
  SELECT et.name
  INTO v_equipment_name
  FROM checklists c
  JOIN equipment_types et ON et.id = c.equipment_type_id
  WHERE c.id = NEW.checklist_id;

  -- Criar alerta (operator_id = NULL para gestores verem no web)
  -- created_by = auth_user_id do operador que gerou o NC
  IF v_auth_user_id IS NOT NULL THEN
    INSERT INTO safety_alerts (title, message, severity, operator_id, created_by)
    VALUES (
      'Item Impeditivo NC - ' || COALESCE(v_equipment_name, 'Equipamento'),
      'Operador ' || COALESCE(v_operator_name, 'Desconhecido') ||
      ' marcou NAO CONFORME no item impeditivo: "' ||
      COALESCE(v_item_description, 'Item') ||
      '". Equipamento NAO liberado para trabalho.',
      'high',
      NULL,
      v_auth_user_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_blocking_nc ON checklist_responses;
CREATE TRIGGER trg_blocking_nc
  AFTER INSERT ON checklist_responses
  FOR EACH ROW
  EXECUTE FUNCTION notify_blocking_nc();

-- ============================================================
-- 3. Trigger: Inspecao comportamental -> Notificar operador
-- Quando SSMA registra uma inspecao, o operador recebe alerta.
-- ============================================================
CREATE OR REPLACE FUNCTION notify_behavioral_inspection()
RETURNS TRIGGER AS $$
DECLARE
  v_operator_name text;
  v_observer_name text;
  v_classification text;
BEGIN
  -- Buscar nome do operador
  SELECT o.name INTO v_operator_name
  FROM operators o
  WHERE o.id = NEW.operator_id;

  -- Buscar nome do observador
  SELECT p.full_name INTO v_observer_name
  FROM profiles p
  WHERE p.id = NEW.observer_id;

  -- Classificacao legivel
  v_classification := CASE NEW.overall_classification
    WHEN 'safe' THEN 'Seguro'
    WHEN 'attention' THEN 'Em Atencao'
    WHEN 'critical' THEN 'Critico'
    ELSE 'Pendente'
  END;

  -- Criar alerta para o operador inspecionado
  -- Precisamos do operator.auth_user_id para ver no app
  INSERT INTO safety_alerts (title, message, severity, operator_id, created_by)
  SELECT
    'Inspecao Comportamental Realizada',
    'Uma inspecao comportamental foi registrada por ' ||
    COALESCE(v_observer_name, 'SSMA') ||
    '. Classificacao: ' || v_classification || '.' ||
    CASE WHEN NEW.safe_behavior_description IS NOT NULL
      THEN ' Comportamento seguro: ' || NEW.safe_behavior_description
      ELSE ''
    END,
    CASE NEW.overall_classification
      WHEN 'critical' THEN 'critical'
      WHEN 'attention' THEN 'medium'
      ELSE 'low'
    END,
    NEW.operator_id,
    NEW.observer_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_behavioral_inspection ON behavioral_inspections;
CREATE TRIGGER trg_behavioral_inspection
  AFTER INSERT ON behavioral_inspections
  FOR EACH ROW
  EXECUTE FUNCTION notify_behavioral_inspection();

-- ============================================================
-- 4. Trigger: Desvio critico -> Alerta para equipe SSMA
-- Quando um desvio 'critical' ou 'high' eh registrado,
-- cria alerta broadcast (operator_id = NULL).
-- ============================================================
CREATE OR REPLACE FUNCTION notify_critical_deviation()
RETURNS TRIGGER AS $$
DECLARE
  v_operator_id uuid;
  v_operator_name text;
  v_observer_id uuid;
  v_area text;
BEGIN
  -- Somente desvios high ou critical
  IF NEW.risk_level NOT IN ('high', 'critical') THEN
    RETURN NEW;
  END IF;

  -- Buscar dados da inspecao
  SELECT bi.operator_id, bi.observer_id, bi.area
  INTO v_operator_id, v_observer_id, v_area
  FROM behavioral_inspections bi
  WHERE bi.id = NEW.inspection_id;

  -- Buscar nome do operador
  SELECT o.name INTO v_operator_name
  FROM operators o
  WHERE o.id = v_operator_id;

  -- Criar alerta broadcast para gestores/SSMA
  INSERT INTO safety_alerts (title, message, severity, operator_id, created_by)
  VALUES (
    'Desvio ' || CASE NEW.risk_level WHEN 'critical' THEN 'CRITICO' ELSE 'ALTO' END || ' Identificado',
    'Desvio identificado na area ' || COALESCE(v_area, 'N/I') ||
    ' com operador ' || COALESCE(v_operator_name, 'N/I') ||
    ': "' || NEW.description || '".' ||
    CASE WHEN NEW.immediate_action IS NOT NULL
      THEN ' Acao imediata: ' || REPLACE(NEW.immediate_action, '_', ' ') || '.'
      ELSE ''
    END,
    CASE NEW.risk_level
      WHEN 'critical' THEN 'critical'
      ELSE 'high'
    END,
    NULL,
    v_observer_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_critical_deviation ON behavioral_deviations;
CREATE TRIGGER trg_critical_deviation
  AFTER INSERT ON behavioral_deviations
  FOR EACH ROW
  EXECUTE FUNCTION notify_critical_deviation();

-- ============================================================
-- 5. Trigger: Pre-operacao critica -> Alerta ao gestor
-- Quando operador marca "Nao" em item critico da pre-operacao
-- (apto_operar = false OU manutencao_valida = false)
-- ============================================================
CREATE OR REPLACE FUNCTION notify_critical_pre_operation()
RETURNS TRIGGER AS $$
DECLARE
  v_operator_name text;
  v_auth_user_id uuid;
  v_issues text := '';
BEGIN
  -- Verificar itens criticos
  IF NEW.apto_operar = true AND NEW.manutencao_valida = true THEN
    RETURN NEW;
  END IF;

  -- Montar descricao dos problemas
  IF NEW.apto_operar = false THEN
    v_issues := v_issues || 'NAO APTO para operar. ';
  END IF;
  IF NEW.manutencao_valida = false THEN
    v_issues := v_issues || 'Manutencao do equipamento INVALIDA. ';
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

DROP TRIGGER IF EXISTS trg_critical_pre_operation ON pre_operation_checks;
CREATE TRIGGER trg_critical_pre_operation
  AFTER INSERT ON pre_operation_checks
  FOR EACH ROW
  EXECUTE FUNCTION notify_critical_pre_operation();

-- ============================================================
-- 6. Trigger: safety_alert criado -> Dispara push notification
-- Usa pg_net para chamar a Edge Function notify-blocking-item
-- automaticamente quando um alerta eh inserido.
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION dispatch_push_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_type text;
  v_supabase_url text;
  v_service_key text;
BEGIN
  -- Determinar tipo de notificacao baseado no titulo
  IF NEW.title LIKE 'Item Impeditivo%' THEN
    v_type := 'blocking_nc';
  ELSIF NEW.title LIKE 'Inspecao Comportamental%' THEN
    v_type := 'behavioral_inspection';
  ELSIF NEW.title LIKE 'Desvio%' THEN
    v_type := 'critical_deviation';
  ELSIF NEW.title LIKE 'Pre-Operacao%' THEN
    v_type := 'blocking_nc';
  ELSE
    v_type := 'custom';
  END IF;

  -- Buscar URL do Supabase das variaveis de ambiente do vault
  -- Fallback: usar a URL direta se pg_net estiver disponivel
  v_supabase_url := current_setting('app.settings.supabase_url', true);

  -- Se nao tiver a URL configurada, nao tenta enviar push
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    RETURN NEW;
  END IF;

  v_service_key := current_setting('app.settings.service_role_key', true);

  IF v_service_key IS NULL OR v_service_key = '' THEN
    RETURN NEW;
  END IF;

  -- Chamar Edge Function via pg_net
  PERFORM extensions.http_post(
    url := v_supabase_url || '/functions/v1/notify-blocking-item',
    body := json_build_object(
      'type', v_type,
      'alert_id', NEW.id::text,
      'operator_id', NEW.operator_id::text
    )::text,
    headers := json_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    )::jsonb
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Se pg_net nao estiver disponivel ou falhar, nao bloqueia o INSERT
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_dispatch_push ON safety_alerts;
CREATE TRIGGER trg_dispatch_push
  AFTER INSERT ON safety_alerts
  FOR EACH ROW
  EXECUTE FUNCTION dispatch_push_notification();
