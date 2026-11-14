-- ============================================================
-- SPEC: 003_seed_template_items.sql
-- Seed de TODOS os itens de inspecao pre-uso dos 29 tipos
-- Fonte: PRO-040169 rev.02 - 13/01/2025
-- is_blocking = true quando "Item impeditivo = Sim"
-- ============================================================

DO $$
DECLARE
  v_id uuid;
BEGIN

-- ============================================================
-- 0. GUINDASTE ARTICULADO
-- Nota: inspecao deve seguir Anexo 08 do PRO-039979 (RAC 05)
-- Sem itens proprios neste documento
-- ============================================================

-- ============================================================
-- 1. CAMINHAO BASCULANTE (21 itens)
-- ============================================================
SELECT id INTO v_id FROM equipment_types WHERE name = 'Caminhao Basculante';
INSERT INTO checklist_template_items (equipment_type_id, description, is_blocking, section, order_index) VALUES
  (v_id, 'Cinto de Seguranca (3 pontos) em boas condicoes de uso?', true, NULL, 1),
  (v_id, 'Alarme para manobras em marcha a re (quando aplicavel)', true, NULL, 2),
  (v_id, 'As setas, farois, luzes de re, de freio estao operantes?', true, NULL, 3),
  (v_id, 'Cabine climatizada com ar condicionado?', true, NULL, 4),
  (v_id, 'Buzina funcionando?', true, NULL, 5),
  (v_id, 'Extintores de incendio em perfeitas condicoes para uso?', true, NULL, 6),
  (v_id, 'Sinalizacao externa de identificacao (TAG) que permita visualizacao a distancia (frente, traseira e laterais)?', true, NULL, 7),
  (v_id, 'Dispositivos para sinalizacao (triangulos refletivos, cones, bombonas ou pontaletes) no minimo 03 pecas', true, NULL, 8),
  (v_id, 'Possui DIPs Dispositivo Identificador de Porcas Soltas, adequadamente fixados?', true, NULL, 9),
  (v_id, 'Sistemas de monitoramento de localizacao e velocidade (telemetria) em funcionamento?', true, NULL, 10),
  (v_id, 'Possui adesivos refletivos (2 cores) nas laterais e traseira?', true, NULL, 11),
  (v_id, 'Sinalizacao de capacidade maxima de carga e tara?', true, NULL, 12),
  (v_id, 'Sistema de Freios em perfeito funcionamento?', true, NULL, 13),
  (v_id, 'Inclinometro em perfeito funcionamento?', true, NULL, 14),
  (v_id, 'Dispositivo limitador de velocidade de deslocamento na condicao bascula levantada?', true, NULL, 15),
  (v_id, 'Indicador de posicao de bascula (visual ou sonoro no painel)?', true, NULL, 16),
  (v_id, 'Isento de vazamentos em geral?', true, NULL, 17),
  (v_id, 'Condicoes estruturais em geral?', false, NULL, 18),
  (v_id, 'Sistema de alerta de proximidade entre equipamentos?', true, 'Obrigatorio somente para areas de lavra', 19),
  (v_id, 'Sistema de deteccao de sonolencia do operador', true, 'Obrigatorio somente para areas de lavra', 20),
  (v_id, 'Radio de comunicacao bidirecional?', true, 'Obrigatorio somente para areas de lavra', 21);

-- ============================================================
-- 2. CAMINHAO BROOK (29 itens)
-- ============================================================
SELECT id INTO v_id FROM equipment_types WHERE name = 'Caminhao Brook';
INSERT INTO checklist_template_items (equipment_type_id, description, is_blocking, section, order_index) VALUES
  (v_id, 'Cinto de Seguranca (3 pontos) em boas condicoes de uso?', true, NULL, 1),
  (v_id, 'Alerta sonoro de re acoplado ao sistema de acionamento de marcha a re (quando aplicavel)', true, NULL, 2),
  (v_id, 'Adesivos refletivos nas laterais e traseira?', true, NULL, 3),
  (v_id, 'As setas, farois, luzes de re, de freio estao operantes?', true, NULL, 4),
  (v_id, 'Cabine climatizada com ar condicionado?', true, NULL, 5),
  (v_id, 'Buzina funcionando?', true, NULL, 6),
  (v_id, 'Funcionamento na tomada de forca?', true, NULL, 7),
  (v_id, 'Desgaste na corrente de icamento da cacamba?', true, NULL, 8),
  (v_id, 'Olhal de icamento da bascula empenado?', true, NULL, 9),
  (v_id, 'Gancho de icamento da cacamba avariado?', true, NULL, 10),
  (v_id, 'Cilindro de elevacao da bascula com avarias?', true, NULL, 11),
  (v_id, 'Funcionamento gancho de basculamento cacamba?', true, NULL, 12),
  (v_id, 'Funcionamento das alavancas?', true, NULL, 13),
  (v_id, 'Funcionamento da patola?', true, NULL, 14),
  (v_id, 'Mola do gancho de icamento da cacamba avariada?', true, NULL, 15),
  (v_id, 'Funcionamento no dispositivos de patolamento (sistemas estabilizadores) hidraulico?', true, NULL, 16),
  (v_id, 'Possui calcos disponiveis para uso, que impeca seu deslocamento?', true, NULL, 17),
  (v_id, 'Extintores de incendio em perfeitas condicoes para uso?', true, NULL, 18),
  (v_id, 'Sinalizacao externa de identificacao (TAG) que permita visualizacao a distancia (frente, traseira e laterais)?', true, NULL, 19),
  (v_id, 'Sinalizacao de capacidade maxima de carga e tara?', true, NULL, 20),
  (v_id, 'Possui DIPs Dispositivo Identificador de Porcas Soltas, adequadamente fixados?', true, NULL, 21),
  (v_id, 'Sistemas de monitoramento de localizacao e velocidade (telemetria) em funcionamento?', true, NULL, 22),
  (v_id, 'Dispositivos para sinalizacao (triangulos refletivos, cones, bombonas ou pontaletes) no minimo 03 pecas', true, NULL, 23),
  (v_id, 'Sistema de Freios em perfeito funcionamento?', true, NULL, 24),
  (v_id, 'Isento de vazamentos em geral?', true, NULL, 25),
  (v_id, 'Condicoes estruturais em geral?', false, NULL, 26),
  (v_id, 'Sistema de alerta de proximidade entre equipamentos?', true, 'Obrigatorio somente para areas de lavra', 27),
  (v_id, 'Sistema de deteccao de sonolencia do operador', true, 'Obrigatorio somente para areas de lavra', 28),
  (v_id, 'Radio de comunicacao bidirecional?', true, 'Obrigatorio somente para areas de lavra', 29);

-- ============================================================
-- 3. CAMINHAO CARROCERIA (21 itens)
-- ============================================================
SELECT id INTO v_id FROM equipment_types WHERE name = 'Caminhao Carroceria';
INSERT INTO checklist_template_items (equipment_type_id, description, is_blocking, section, order_index) VALUES
  (v_id, 'Cinto de Seguranca (3 pontos) em boas condicoes de uso?', true, NULL, 1),
  (v_id, 'Alarme para manobras em marcha a re (quando aplicavel)', true, NULL, 2),
  (v_id, 'As setas, farois, luzes de re, de freio estao operantes?', true, NULL, 3),
  (v_id, 'Cabine climatizada com ar condicionado?', true, NULL, 4),
  (v_id, 'Buzina funcionando?', true, NULL, 5),
  (v_id, 'Extintores de incendio em perfeitas condicoes para uso?', true, NULL, 6),
  (v_id, 'Sinalizacao externa de identificacao (TAG) que permita visualizacao a distancia (frente, traseira e laterais)?', true, NULL, 7),
  (v_id, 'Possui DIPs Dispositivo Identificador de Porcas Soltas, adequadamente fixados?', true, NULL, 8),
  (v_id, 'Sistemas de monitoramento de localizacao e velocidade (telemetria) em funcionamento?', true, NULL, 9),
  (v_id, 'Dispositivos para sinalizacao (triangulos refletivos, cones, bombonas ou pontaletes) no minimo 03 pecas', true, NULL, 10),
  (v_id, 'Sinalizacao de capacidade maxima de carga e tara?', true, NULL, 11),
  (v_id, 'Adesivos refletivos nas laterais e traseira?', true, NULL, 12),
  (v_id, 'Sistema de freios em perfeito funcionamento?', true, NULL, 13),
  (v_id, 'Guarda corpos instalados ao longo da carroceria?', true, NULL, 14),
  (v_id, 'Possui calcos compativeis com as dimensoes dos pneus do equipamento movel?', true, NULL, 15),
  (v_id, 'Isento de vazamentos em geral?', true, NULL, 16),
  (v_id, 'Condicoes estruturais em geral?', false, NULL, 17),
  (v_id, 'Sistema de alerta de proximidade entre equipamentos?', true, 'Obrigatorio somente para areas de lavra', 18),
  (v_id, 'Sistema de deteccao de sonolencia do operador', true, 'Obrigatorio somente para areas de lavra', 19),
  (v_id, 'Tracao em no minimo dois eixos quando possuir 3 ou mais eixos?', true, 'Obrigatorio somente para areas de lavra', 20),
  (v_id, 'Radio de comunicacao bidirecional?', true, 'Obrigatorio somente para areas de lavra', 21);

-- ============================================================
-- 4. CAMINHAO COMBOIO (30 itens)
-- ============================================================
SELECT id INTO v_id FROM equipment_types WHERE name = 'Caminhao Comboio';
INSERT INTO checklist_template_items (equipment_type_id, description, is_blocking, section, order_index) VALUES
  (v_id, 'Cinto de Seguranca (3 pontos) em boas condicoes de uso?', true, NULL, 1),
  (v_id, 'Alarme para manobras em marcha a re (quando aplicavel)', true, NULL, 2),
  (v_id, 'As setas, farois, luzes de re, de freio estao operantes?', true, NULL, 3),
  (v_id, 'Cabine climatizada com ar condicionado?', true, NULL, 4),
  (v_id, 'Buzina funcionando?', true, NULL, 5),
  (v_id, 'Extintores de incendio em perfeitas condicoes para uso?', true, NULL, 6),
  (v_id, 'Sinalizacao externa de identificacao (TAG) que permita visualizacao a distancia (frente, traseira e laterais)?', true, NULL, 7),
  (v_id, 'Dispositivos para sinalizacao (triangulos refletivos, cones, bombonas ou pontaletes) no minimo 03 pecas', true, NULL, 8),
  (v_id, 'Possui DIPs Dispositivo Identificador de Porcas Soltas, adequadamente fixados?', true, NULL, 9),
  (v_id, 'Sistemas de monitoramento de localizacao e velocidade (telemetria) em funcionamento?', true, NULL, 10),
  (v_id, 'Sinalizacao de capacidade maxima de carga e tara?', true, NULL, 11),
  (v_id, 'Sistema de freios em perfeito funcionamento?', true, NULL, 12),
  (v_id, 'Possui calcos compativeis com as dimensoes dos pneus do equipamento movel?', true, NULL, 13),
  (v_id, 'Adesivos refletivos nas laterais e traseira?', true, NULL, 14),
  (v_id, 'Luz auxiliar para operacao noturna?', true, NULL, 15),
  (v_id, 'Dispositivo para aterramento, quando transportando substancias inflamaveis?', true, NULL, 16),
  (v_id, 'Inspecao visual de mangueiras, conexoes, valvulas e bicos do sistema de abastecimento, ressuprimento e sistema de filtragem dos comboios, incluindo tampa de vedacao', true, NULL, 17),
  (v_id, 'Bombas em funcionamento sem vazamentos', true, NULL, 18),
  (v_id, 'Roldanas integras e lubrificadas?', true, NULL, 19),
  (v_id, 'Mangueiras integras, com protecao e fixadas com bracadeiras?', true, NULL, 20),
  (v_id, 'Gatilhos dos lubrificantes, integros sem vazamentos e bocal limpo', true, NULL, 21),
  (v_id, 'Compartimento de fluidos identificados e sinalizados, sem vazamentos, integros?', true, NULL, 22),
  (v_id, 'Estrutura dos compartimentos fixados, aterrados, limpos, com trancas/travas integras, protecao nos girantes (bomba, cardam, outros)', true, NULL, 23),
  (v_id, 'Verificacao de corrosao no tanque e acessorios', true, NULL, 24),
  (v_id, 'Funcionamento das cameras de video traseira (quando aplicavel)', true, NULL, 25),
  (v_id, 'Isento de vazamentos em geral?', true, NULL, 26),
  (v_id, 'Sistema de alerta de proximidade entre equipamentos?', true, 'Obrigatorio somente para areas de lavra', 27),
  (v_id, 'Sistema de deteccao de sonolencia do operador', true, 'Obrigatorio somente para areas de lavra', 28),
  (v_id, 'Tracao em no minimo dois eixos quando possuir 3 ou mais eixos?', true, 'Obrigatorio somente para areas de lavra', 29),
  (v_id, 'Radio de comunicacao bidirecional?', true, 'Obrigatorio somente para areas de lavra', 30);

-- ============================================================
-- 5. CAMINHAO CONJUGADO (31 itens)
-- ============================================================
SELECT id INTO v_id FROM equipment_types WHERE name = 'Caminhao Conjugado';
INSERT INTO checklist_template_items (equipment_type_id, description, is_blocking, section, order_index) VALUES
  (v_id, 'Cinto de Seguranca (3 pontos) em boas condicoes de uso?', true, NULL, 1),
  (v_id, 'Alarme para manobras em marcha a re (quando aplicavel)', true, NULL, 2),
  (v_id, 'As setas, farois, luzes de re, de freio estao operantes?', true, NULL, 3),
  (v_id, 'Cabine climatizada com ar condicionado?', true, NULL, 4),
  (v_id, 'Buzina funcionando?', true, NULL, 5),
  (v_id, 'Extintores de incendio em perfeitas condicoes para uso?', true, NULL, 6),
  (v_id, 'Sinalizacao externa de identificacao (TAG) que permita visualizacao a distancia (frente, traseira e laterais)?', true, NULL, 7),
  (v_id, 'Possui DIPs Dispositivo Identificador de Porcas Soltas, adequadamente fixados?', true, NULL, 8),
  (v_id, 'Sistemas de monitoramento de localizacao e velocidade (telemetria) em funcionamento?', true, NULL, 9),
  (v_id, 'Dispositivos para sinalizacao (triangulos refletivos, cones, bombonas ou pontaletes) no minimo 03 pecas', true, NULL, 10),
  (v_id, 'Sinalizacao de capacidade maxima de carga e tara?', true, NULL, 11),
  (v_id, 'Adesivos refletivos nas laterais e traseira?', true, NULL, 12),
  (v_id, 'Sistema de freios em perfeito funcionamento?', true, NULL, 13),
  (v_id, 'Cabo de aco de seguranca entre conexoes nao conforme?', true, NULL, 14),
  (v_id, 'Possui calcos compativeis com as dimensoes dos pneus do equipamento movel?', true, NULL, 15),
  (v_id, 'Funcionamento na tomada de forca?', true, NULL, 16),
  (v_id, 'Nivel de oleo da bomba de alta pressao esta abaixo do minimo?', false, NULL, 17),
  (v_id, 'Nivel de oleo da bomba de vacuo esta abaixo do minimo?', true, NULL, 18),
  (v_id, 'Funcionamento no manometro da bomba de alta pressao?', true, NULL, 19),
  (v_id, 'Nivel de oleo e agua do motor estacionario abaixo do minimo?', true, NULL, 20),
  (v_id, 'Funcionamento da valvula de pressao/giratoria?', true, NULL, 21),
  (v_id, 'Funcionamento da pistola de jateamento (inclusive conexao)?', true, NULL, 22),
  (v_id, 'Funcionamento do torpedo?', true, NULL, 23),
  (v_id, 'Alta pressao esta fora da faixa de trabalho adequada?', true, NULL, 24),
  (v_id, 'Pressao de vacuo esta fora da faixa de trabalho adequada?', true, NULL, 25),
  (v_id, 'Isento de vazamentos em geral?', true, NULL, 26),
  (v_id, 'Condicoes estruturais em geral?', false, NULL, 27),
  (v_id, 'Sistema de alerta de proximidade entre equipamentos?', true, 'Obrigatorio somente para areas de lavra', 28),
  (v_id, 'Sistema de deteccao de sonolencia do operador', true, 'Obrigatorio somente para areas de lavra', 29),
  (v_id, 'Tracao em no minimo dois eixos quando possuir 3 ou mais eixos?', true, 'Obrigatorio somente para areas de lavra', 30),
  (v_id, 'Radio de comunicacao bidirecional?', true, 'Obrigatorio somente para areas de lavra', 31);

-- ============================================================
-- 6. CAMINHAO HIDROJATEAMENTO (34 itens)
-- ============================================================
SELECT id INTO v_id FROM equipment_types WHERE name = 'Caminhao Hidrojateamento';
INSERT INTO checklist_template_items (equipment_type_id, description, is_blocking, section, order_index) VALUES
  (v_id, 'Cinto de Seguranca (3 pontos) em boas condicoes de uso?', true, NULL, 1),
  (v_id, 'Alarme para manobras em marcha a re (quando aplicavel)', true, NULL, 2),
  (v_id, 'As setas, farois, luzes de re, de freio estao operantes?', true, NULL, 3),
  (v_id, 'Cabine climatizada com ar condicionado?', true, NULL, 4),
  (v_id, 'Buzina funcionando?', true, NULL, 5),
  (v_id, 'Extintores de incendio em perfeitas condicoes para uso?', true, NULL, 6),
  (v_id, 'Sinalizacao externa de identificacao (TAG) que permita visualizacao a distancia (frente, traseira e laterais)?', true, NULL, 7),
  (v_id, 'Dispositivos para sinalizacao (triangulos refletivos, cones, bombonas ou pontaletes) no minimo 03 pecas', true, NULL, 8),
  (v_id, 'Possui DIPs Dispositivo Identificador de Porcas Soltas, adequadamente fixados?', true, NULL, 9),
  (v_id, 'Sistemas de monitoramento de localizacao e velocidade (telemetria) em funcionamento?', true, NULL, 10),
  (v_id, 'Sinalizacao de capacidade maxima de carga e tara?', true, NULL, 11),
  (v_id, 'Sistema de freios em perfeito funcionamento?', true, NULL, 12),
  (v_id, 'Possui calcos compativeis com as dimensoes dos pneus do equipamento movel?', true, NULL, 13),
  (v_id, 'Adesivos refletivos nas laterais e traseira?', true, NULL, 14),
  (v_id, 'Luz auxiliar para operacao noturna?', true, NULL, 15),
  (v_id, 'Mal funcionamento na tomada de forca?', true, NULL, 16),
  (v_id, 'Nivel de oleo da bomba de alta pressao esta abaixo do minimo?', true, NULL, 17),
  (v_id, 'Mal funcionamento no manometro de pressao da bomba de alta pressao?', true, NULL, 18),
  (v_id, 'Nivel de oleo do motor estacionario abaixo do minimo?', true, NULL, 19),
  (v_id, 'Nivel de agua do motor estacionario esta abaixo do minimo?', true, NULL, 20),
  (v_id, 'Mal funcionamento da valvula de pressao/giratoria?', true, NULL, 21),
  (v_id, 'Ruido anormal na bomba de alta pressao?', true, NULL, 22),
  (v_id, 'Conexao/fixacao da pistola para jateamento adequada?', true, NULL, 23),
  (v_id, 'Mal funcionamento da pistola de jateamento?', true, NULL, 24),
  (v_id, 'Mal funcionamento do torpedo?', true, NULL, 25),
  (v_id, 'Alta pressao esta fora da faixa de trabalho adequada?', true, NULL, 26),
  (v_id, 'Cabo de aco de seguranca entre conexoes nao conforme?', true, NULL, 27),
  (v_id, 'Irregularidade na partida do motor estacionario (arranque)?', true, NULL, 28),
  (v_id, 'Condicoes estruturais em geral?', true, NULL, 29),
  (v_id, 'Isento de vazamentos em geral?', false, NULL, 30),
  (v_id, 'Sistema de alerta de proximidade entre equipamentos?', true, 'Obrigatorio somente para areas de lavra', 31),
  (v_id, 'Sistema de deteccao de sonolencia do operador', true, 'Obrigatorio somente para areas de lavra', 32),
  (v_id, 'Tracao em no minimo dois eixos quando possuir 3 ou mais eixos?', true, 'Obrigatorio somente para areas de lavra', 33),
  (v_id, 'Radio de comunicacao bidirecional?', true, 'Obrigatorio somente para areas de lavra', 34);

-- ============================================================
-- 7. CAMINHAO HIPERVACUO (32 itens)
-- ============================================================
SELECT id INTO v_id FROM equipment_types WHERE name = 'Caminhao Hipervacuo';
INSERT INTO checklist_template_items (equipment_type_id, description, is_blocking, section, order_index) VALUES
  (v_id, 'Cinto de Seguranca (3 pontos) em boas condicoes de uso?', true, NULL, 1),
  (v_id, 'Alarme para manobras em marcha a re (quando aplicavel)', true, NULL, 2),
  (v_id, 'As setas, farois, luzes de re, de freio estao operantes?', true, NULL, 3),
  (v_id, 'Cabine climatizada com ar condicionado?', true, NULL, 4),
  (v_id, 'Buzina funcionando?', true, NULL, 5),
  (v_id, 'Extintores de incendio em perfeitas condicoes para uso?', true, NULL, 6),
  (v_id, 'Sinalizacao externa de identificacao (TAG) que permita visualizacao a distancia (frente, traseira e laterais)?', true, NULL, 7),
  (v_id, 'Dispositivos para sinalizacao (triangulos refletivos, cones, bombonas ou pontaletes) no minimo 03 pecas', true, NULL, 8),
  (v_id, 'Possui DIPs Dispositivo Identificador de Porcas Soltas, adequadamente fixados?', true, NULL, 9),
  (v_id, 'Sistemas de monitoramento de localizacao e velocidade (telemetria) em funcionamento?', true, NULL, 10),
  (v_id, 'Sinalizacao de capacidade maxima de carga e tara?', true, NULL, 11),
  (v_id, 'Sistema de freios em perfeito funcionamento?', true, NULL, 12),
  (v_id, 'Possui calcos compativeis com as dimensoes dos pneus do equipamento movel?', true, NULL, 13),
  (v_id, 'Adesivos refletivos nas laterais e traseira?', true, NULL, 14),
  (v_id, 'Indicador de posicao de bascula (visual ou sonoro no painel)', true, NULL, 15),
  (v_id, 'Dispositivo limitador de velocidade de deslocamento na condicao bascula levantada', true, NULL, 16),
  (v_id, 'Inclinometro em perfeito funcionamento?', true, NULL, 17),
  (v_id, 'Luz auxiliar para operacao noturna?', true, NULL, 18),
  (v_id, 'Mal funcionamento na tomada de forca?', true, NULL, 19),
  (v_id, 'Falta de lubrificacao na engrenagem da bomba?', true, NULL, 20),
  (v_id, 'Nivel oleo da bomba de vacuo esta abaixo do minimo?', true, NULL, 21),
  (v_id, 'Ausencia de avarias na correia da bomba de vacuo?', true, NULL, 22),
  (v_id, 'Pressao de vacuo esta fora da faixa de trabalho adequada?', true, NULL, 23),
  (v_id, 'Funcionamento nas alavancas de comando?', true, NULL, 24),
  (v_id, 'Filtro de manga obstruido?', true, NULL, 25),
  (v_id, 'Trava de seguranca da tampa traseira?', true, NULL, 26),
  (v_id, 'Condicoes estruturais em geral?', true, NULL, 27),
  (v_id, 'Isento de vazamentos em geral?', false, NULL, 28),
  (v_id, 'Sistema de alerta de proximidade entre equipamentos?', true, 'Obrigatorio somente para areas de lavra', 29),
  (v_id, 'Sistema de deteccao de sonolencia do operador', true, 'Obrigatorio somente para areas de lavra', 30),
  (v_id, 'Tracao em no minimo dois eixos quando possuir 3 ou mais eixos?', true, 'Obrigatorio somente para areas de lavra', 31),
  (v_id, 'Radio de comunicacao bidirecional?', true, 'Obrigatorio somente para areas de lavra', 32);

-- ============================================================
-- 8. CAMINHAO PIPA (22 itens)
-- ============================================================
SELECT id INTO v_id FROM equipment_types WHERE name = 'Caminhao Pipa';
INSERT INTO checklist_template_items (equipment_type_id, description, is_blocking, section, order_index) VALUES
  (v_id, 'Cinto de Seguranca (3 pontos) em boas condicoes de uso?', true, NULL, 1),
  (v_id, 'Alerta sonoro de re acoplado ao sistema de acionamento de marcha a re (quando aplicavel)?', true, NULL, 2),
  (v_id, 'As setas, farois, luzes de re, de freio estao operantes?', true, NULL, 3),
  (v_id, 'Cabine climatizada com ar condicionado?', true, NULL, 4),
  (v_id, 'Buzina funcionando?', true, NULL, 5),
  (v_id, 'Extintores de incendio em perfeitas condicoes para uso?', true, NULL, 6),
  (v_id, 'Sinalizacao externa de identificacao (TAG) que permita visualizacao a distancia (frente, traseira e laterais)?', true, NULL, 7),
  (v_id, 'Dispositivos para sinalizacao (triangulos refletivos, cones, bombonas ou pontaletes) no minimo 03 pecas', true, NULL, 8),
  (v_id, 'Possui DIPs Dispositivo Identificador de Porcas Soltas, adequadamente fixados?', true, NULL, 9),
  (v_id, 'Sistemas de monitoramento de localizacao e velocidade (telemetria) em funcionamento?', true, NULL, 10),
  (v_id, 'Sinalizacao de capacidade maxima de carga e tara?', true, NULL, 11),
  (v_id, 'Sistema de freios em perfeito funcionamento?', true, NULL, 12),
  (v_id, 'Possui calcos compativeis com as dimensoes dos pneus do equipamento movel?', true, NULL, 13),
  (v_id, 'Adesivos refletivos nas laterais e traseira?', true, NULL, 14),
  (v_id, 'Luz auxiliar para operacao noturna?', true, NULL, 15),
  (v_id, 'Isento de vazamentos em geral?', true, NULL, 16),
  (v_id, 'Condicoes estruturais em geral?', true, NULL, 17),
  (v_id, 'Verificacao de corrosao no tanque e acessorios?', false, NULL, 18),
  (v_id, 'Sistema de alerta de proximidade entre equipamentos?', true, 'Obrigatorio somente para areas de lavra', 19),
  (v_id, 'Sistema de deteccao de sonolencia do operador', true, 'Obrigatorio somente para areas de lavra', 20),
  (v_id, 'Tracao em no minimo dois eixos quando possuir 3 ou mais eixos?', true, 'Obrigatorio somente para areas de lavra', 21),
  (v_id, 'Radio de comunicacao bidirecional?', true, 'Obrigatorio somente para areas de lavra', 22);

-- ============================================================
-- 9. CAMINHAO PRANCHA (22 itens)
-- ============================================================
SELECT id INTO v_id FROM equipment_types WHERE name = 'Caminhao Prancha';
INSERT INTO checklist_template_items (equipment_type_id, description, is_blocking, section, order_index) VALUES
  (v_id, 'Cinto de Seguranca (3 pontos) em boas condicoes de uso?', true, NULL, 1),
  (v_id, 'Alerta sonoro de re acoplado ao sistema de acionamento de marcha a re (quando aplicavel)?', true, NULL, 2),
  (v_id, 'As setas, farois, luzes de re, de freio estao operantes?', true, NULL, 3),
  (v_id, 'Cabine climatizada com ar condicionado?', true, NULL, 4),
  (v_id, 'Buzina funcionando?', true, NULL, 5),
  (v_id, 'Extintores de incendio em perfeitas condicoes para uso?', true, NULL, 6),
  (v_id, 'Sinalizacao externa de identificacao (TAG) que permita visualizacao a distancia (frente, traseira e laterais)?', true, NULL, 7),
  (v_id, 'Dispositivos para sinalizacao (triangulos refletivos, cones, bombonas ou pontaletes) no minimo 03 pecas', true, NULL, 8),
  (v_id, 'Possui DIPs Dispositivo Identificador de Porcas Soltas, adequadamente fixados?', true, NULL, 9),
  (v_id, 'Sistemas de monitoramento de localizacao e velocidade (telemetria) em funcionamento?', true, NULL, 10),
  (v_id, 'Sinalizacao de capacidade maxima de carga e tara?', true, NULL, 11),
  (v_id, 'Sistema de freios em perfeito funcionamento?', true, NULL, 12),
  (v_id, 'Possui calcos compativeis com as dimensoes dos pneus do equipamento movel?', true, NULL, 13),
  (v_id, 'Adesivos refletivos nas laterais e traseira?', true, NULL, 14),
  (v_id, 'Luz auxiliar para operacao noturna?', true, NULL, 15),
  (v_id, 'Condicoes estruturais em geral?', false, NULL, 16),
  (v_id, 'Isento de vazamentos em geral?', true, NULL, 17),
  (v_id, 'Sistema de alerta de proximidade entre equipamentos?', true, 'Obrigatorio somente para areas de lavra', 18),
  (v_id, 'Sistema de deteccao de sonolencia do operador', true, 'Obrigatorio somente para areas de lavra', 19),
  (v_id, 'Tracao em no minimo dois eixos quando possuir 3 ou mais eixos?', true, 'Obrigatorio somente para areas de lavra', 20),
  (v_id, 'Radio de comunicacao bidirecional?', true, 'Obrigatorio somente para areas de lavra', 21);

-- ============================================================
-- 10. CAMINHAO SUCCAO (30 itens)
-- ============================================================
SELECT id INTO v_id FROM equipment_types WHERE name = 'Caminhao Succao';
INSERT INTO checklist_template_items (equipment_type_id, description, is_blocking, section, order_index) VALUES
  (v_id, 'Cinto de Seguranca (3 pontos) em boas condicoes de uso?', true, NULL, 1),
  (v_id, 'Alarme para manobras em marcha a re (quando aplicavel)', true, NULL, 2),
  (v_id, 'As setas, farois, luzes de re, de freio estao operantes?', true, NULL, 3),
  (v_id, 'Cabine climatizada com ar condicionado?', true, NULL, 4),
  (v_id, 'Buzina funcionando?', true, NULL, 5),
  (v_id, 'Extintores de incendio em perfeitas condicoes para uso?', true, NULL, 6),
  (v_id, 'Sinalizacao externa de identificacao (TAG) que permita visualizacao a distancia (frente, traseira e laterais)?', true, NULL, 7),
  (v_id, 'Dispositivos para sinalizacao (triangulos refletivos, cones, bombonas ou pontaletes) no minimo 03 pecas', true, NULL, 8),
  (v_id, 'Possui DIPs Dispositivo Identificador de Porcas Soltas, adequadamente fixados?', true, NULL, 9),
  (v_id, 'Sistemas de monitoramento de localizacao e velocidade (telemetria) em funcionamento?', true, NULL, 10),
  (v_id, 'Indicador de posicao de bascula (visual ou sonoro no painel)', true, NULL, 11),
  (v_id, 'Dispositivo limitador de velocidade de deslocamento na condicao bascula levantada', true, NULL, 12),
  (v_id, 'Inclinometro em perfeito funcionamento?', true, NULL, 13),
  (v_id, 'Sinalizacao de capacidade maxima de carga e tara?', true, NULL, 14),
  (v_id, 'Sistema de freios em perfeito funcionamento?', true, NULL, 15),
  (v_id, 'Possui calcos compativeis com as dimensoes dos pneus do equipamento movel?', true, NULL, 16),
  (v_id, 'Adesivos refletivos nas laterais e traseira?', true, NULL, 17),
  (v_id, 'Luz auxiliar para operacao noturna?', true, NULL, 18),
  (v_id, 'Funcionamento na tomada de forca?', true, NULL, 19),
  (v_id, 'Nivel oleo da bomba de vacuo esta abaixo do minimo?', true, NULL, 20),
  (v_id, 'Correia na bomba de vacuo?', true, NULL, 21),
  (v_id, 'Pressao de vacuo esta fora da faixa de trabalho adequada?', true, NULL, 22),
  (v_id, 'Vazamento nas valvulas de retencao de materiais?', true, NULL, 23),
  (v_id, 'Nivel de combustivel abaixo do minimo?', true, NULL, 24),
  (v_id, 'Condicoes estruturais em geral?', false, NULL, 25),
  (v_id, 'Isento de vazamentos em geral?', true, NULL, 26),
  (v_id, 'Sistema de alerta de proximidade entre equipamentos?', true, 'Obrigatorio somente para areas de lavra', 27),
  (v_id, 'Sistema de deteccao de sonolencia do operador', true, 'Obrigatorio somente para areas de lavra', 28),
  (v_id, 'Tracao em no minimo dois eixos quando possuir 3 ou mais eixos?', true, 'Obrigatorio somente para areas de lavra', 29),
  (v_id, 'Radio de comunicacao bidirecional?', true, 'Obrigatorio somente para areas de lavra', 30);

-- ============================================================
-- 11. CAMINHAO VASSOURA (37 itens)
-- ============================================================
SELECT id INTO v_id FROM equipment_types WHERE name = 'Caminhao Vassoura';
INSERT INTO checklist_template_items (equipment_type_id, description, is_blocking, section, order_index) VALUES
  (v_id, 'Cinto de Seguranca (3 pontos) em boas condicoes de uso?', true, NULL, 1),
  (v_id, 'Alarme para manobras em marcha a re (quando aplicavel)', true, NULL, 2),
  (v_id, 'As setas, farois, luzes de re, de freio estao operantes?', true, NULL, 3),
  (v_id, 'Cabine climatizada com ar condicionado?', true, NULL, 4),
  (v_id, 'Buzina funcionando?', true, NULL, 5),
  (v_id, 'Extintores de incendio em perfeitas condicoes para uso?', true, NULL, 6),
  (v_id, 'Sinalizacao externa de identificacao (TAG) que permita visualizacao a distancia (frente, traseira e laterais)?', true, NULL, 7),
  (v_id, 'Dispositivos para sinalizacao (triangulos refletivos, cones, bombonas ou pontaletes) no minimo 03 pecas', true, NULL, 8),
  (v_id, 'Possui DIPs Dispositivo Identificador de Porcas Soltas, adequadamente fixados?', true, NULL, 9),
  (v_id, 'Sistemas de monitoramento de localizacao e velocidade (telemetria) em funcionamento?', true, NULL, 10),
  (v_id, 'Indicador de posicao de bascula (visual ou sonoro no painel)', true, NULL, 11),
  (v_id, 'Dispositivo limitador de velocidade de deslocamento na condicao bascula levantada', true, NULL, 12),
  (v_id, 'Inclinometro em perfeito funcionamento?', true, NULL, 13),
  (v_id, 'Sinalizacao de capacidade maxima de carga e tara?', true, NULL, 14),
  (v_id, 'Sistema de freios em perfeito funcionamento?', true, NULL, 15),
  (v_id, 'Possui calcos compativeis com as dimensoes dos pneus do equipamento movel?', true, NULL, 16),
  (v_id, 'Adesivos refletivos nas laterais e traseira?', false, NULL, 17),
  (v_id, 'Condicoes estruturais em geral?', false, NULL, 18),
  (v_id, 'Isento de vazamentos em geral?', true, NULL, 19),
  (v_id, 'Nivel da agua do motor estacionario abaixo do minimo?', true, 'Itens do motor estacionario', 20),
  (v_id, 'Nivel de oleo motor estacionario abaixo do minimo?', true, 'Itens do motor estacionario', 21),
  (v_id, 'Nivel de oleo da caixa de engrenagem abaixo do minimo?', true, 'Itens do motor estacionario', 22),
  (v_id, 'Nivel de oleo da wap abaixo do minimo?', true, 'Itens do motor estacionario', 23),
  (v_id, 'Nivel de oleo hidraulico abaixo do minimo?', true, 'Itens do motor estacionario', 24),
  (v_id, 'Mal funcionamento do cilindro de basculamento?', true, 'Itens do motor estacionario', 25),
  (v_id, 'Mal funcionamento da turbina e protecoes?', true, 'Itens do motor estacionario', 26),
  (v_id, 'Mal funcionamento na trava da tampa traseira?', true, 'Itens do motor estacionario', 27),
  (v_id, 'Mal funcionamento do giroflex ou giroled?', true, 'Itens do motor estacionario', 28),
  (v_id, 'Mal funcionamento da trava de seguranca?', true, 'Itens do motor estacionario', 29),
  (v_id, 'Mal funcionamento / regulagem do rolo central?', true, 'Itens do motor estacionario', 30),
  (v_id, 'Filtro de ar com impurezas presentes?', true, 'Itens do motor estacionario', 31),
  (v_id, 'Mal funcionamento dos aspersores?', true, 'Itens do motor estacionario', 32),
  (v_id, 'Ha indicios de falha no funcionamento do joystick (quando disponivel)?', true, 'Itens do motor estacionario', 33),
  (v_id, 'Sistema de alerta de proximidade entre equipamentos?', true, 'Obrigatorio somente para areas de lavra', 34),
  (v_id, 'Sistema de deteccao de sonolencia do operador', true, 'Obrigatorio somente para areas de lavra', 35),
  (v_id, 'Tracao em no minimo dois eixos quando possuir 3 ou mais eixos?', true, 'Obrigatorio somente para areas de lavra', 36),
  (v_id, 'Radio de comunicacao bidirecional?', true, 'Obrigatorio somente para areas de lavra', 37);

-- ============================================================
-- 12. FORA DE ESTRADA (21 itens)
-- ============================================================
SELECT id INTO v_id FROM equipment_types WHERE name = 'Fora de Estrada';
INSERT INTO checklist_template_items (equipment_type_id, description, is_blocking, section, order_index) VALUES
  (v_id, 'Cinto de Seguranca?', true, NULL, 1),
  (v_id, 'Saidas de fuga e desembarque em emergencias?', true, NULL, 2),
  (v_id, 'Freio de estacionamento e freio de servico? Verificar as condicoes do freio e sua eficiencia e freio de parque em emergencias?', true, NULL, 3),
  (v_id, 'Cameras de video lateral, frontal e traseira, funcionais?', true, NULL, 4),
  (v_id, 'Radio de comunicacao bidirecional em funcionamento?', true, NULL, 5),
  (v_id, 'Sistemas de monitoramento de localizacao e velocidade (telemetria)?', true, NULL, 6),
  (v_id, 'Sistemas de monitoramento de carga?', true, NULL, 7),
  (v_id, 'As setas, farois, luzes de re, de freio estao operantes?', true, NULL, 8),
  (v_id, 'Dispositivo limitador de velocidade em funcionamento?', true, NULL, 9),
  (v_id, 'Indicador de posicao de bascula (visual ou sonoro no painel) efetivo?', true, NULL, 10),
  (v_id, 'Cabine climatizada com ar condicionado?', true, NULL, 11),
  (v_id, 'Buzina funcionando?', true, NULL, 12),
  (v_id, 'Extintores de incendio em perfeitas condicoes para uso?', true, NULL, 13),
  (v_id, 'Os sistemas automaticos de deteccao e supressao de incendios estao disponiveis para uso?', true, NULL, 14),
  (v_id, 'Sinalizacao externa de identificacao (TAG) que permita visualizacao a distancia (frente, traseira e laterais)?', true, NULL, 15),
  (v_id, 'Equipamento isento de vazamentos em geral?', true, NULL, 16),
  (v_id, 'Verificar as condicoes do freio e sua eficiencia?', true, NULL, 17),
  (v_id, 'Sinalizacao de capacidade maxima de carga e tara?', false, NULL, 18),
  (v_id, 'Condicoes estruturais em geral?', false, NULL, 19);

-- ============================================================
-- 13. ESCAVADEIRA (14 itens)
-- ============================================================
SELECT id INTO v_id FROM equipment_types WHERE name = 'Escavadeira';
INSERT INTO checklist_template_items (equipment_type_id, description, is_blocking, section, order_index) VALUES
  (v_id, 'Cinto de Seguranca?', true, NULL, 1),
  (v_id, 'Saidas de fuga e desembarque em emergencias?', true, NULL, 2),
  (v_id, 'Cameras de video lateral e traseira - obrigatorio para equipamentos de grande porte - tara igual ou superior a 45 ton?', true, NULL, 3),
  (v_id, 'Radio de comunicacao bidirecional?', true, NULL, 4),
  (v_id, 'Alarme para manobras em marcha a re (quando aplicavel)', true, NULL, 5),
  (v_id, 'Cabine climatizada com ar condicionado?', true, NULL, 6),
  (v_id, 'Buzina funcionando?', true, NULL, 7),
  (v_id, 'Extintores de incendio em perfeitas condicoes para uso?', true, NULL, 8),
  (v_id, 'Os sistemas automaticos de deteccao e supressao de incendios estao disponiveis para uso (quando aplicavel)?', true, NULL, 9),
  (v_id, 'Sinalizacao externa de identificacao (TAG) que permita visualizacao a distancia (frente, traseira e laterais)?', true, NULL, 10),
  (v_id, 'Luz auxiliar para operacao noturna?', true, NULL, 11),
  (v_id, 'Isento de vazamentos em geral?', true, NULL, 12),
  (v_id, 'Sinalizacao de capacidade maxima de carga e tara?', false, NULL, 13),
  (v_id, 'Condicoes estruturais em geral?', false, NULL, 14);

-- ============================================================
-- 14. ESCAVADEIRA ANFIBIA (28 itens)
-- ============================================================
SELECT id INTO v_id FROM equipment_types WHERE name = 'Escavadeira Anfibia';
INSERT INTO checklist_template_items (equipment_type_id, description, is_blocking, section, order_index) VALUES
  (v_id, 'Possui o modo operacao remota?', true, NULL, 1),
  (v_id, 'Cinto de seguranca', true, NULL, 2),
  (v_id, 'Radio de comunicacao bidirecional', true, NULL, 3),
  (v_id, 'Possui kit de emergencia (colete, apito, martelo)?', true, NULL, 4),
  (v_id, 'Operador treinado nos recursos/dispositivos de emergencia?', true, NULL, 5),
  (v_id, 'Placa de identificacao com a capacidade maxima permitida', true, NULL, 6),
  (v_id, 'Cameras de video lateral e traseira (obrigatorio para equipamentos de grande porte)', true, NULL, 7),
  (v_id, 'Alarme para manobras em marcha a re', true, NULL, 8),
  (v_id, 'Luz auxiliar para operacao noturna', true, NULL, 9),
  (v_id, 'Extintores de incendio em perfeitas condicoes para uso?', true, NULL, 10),
  (v_id, 'Os sistemas automaticos de deteccao e supressao de incendios estao disponiveis para uso (quando aplicavel)?', true, NULL, 11),
  (v_id, 'Alternativas de fuga segura/desembarque do equipamento para casos de emergencia', true, NULL, 12),
  (v_id, 'Cabine climatizada com ar condicionado', true, NULL, 13),
  (v_id, 'Verificar as condicoes do freio e sua eficiencia?', true, NULL, 14),
  (v_id, 'Estrutura de protecao contra capotamento (ROPS)', true, NULL, 15),
  (v_id, 'Nivel do reservatorio do Sistema Hidraulico', true, NULL, 16),
  (v_id, 'Nivel do fluido de arrefecimento no visor', true, NULL, 17),
  (v_id, 'Condicoes da estrutura em geral (trincas, amassados, farois, cacamba, chassi, escadas, guarda corpo etc)', true, NULL, 18),
  (v_id, 'Condicoes estruturais dos flutuadores (amassamento e furos)', true, NULL, 19),
  (v_id, 'Material rodante condicoes dos links, roda guia, tensionamento da esteira, sapatas, pinos e contra pinos', true, NULL, 20),
  (v_id, 'Ranhuras e vazamentos nos cilindros de movimentacao do implemento', true, NULL, 21),
  (v_id, 'Condicoes de travamento das portas, vidros e macanetas e trava de seguranca do hidraulico do equipamento', true, NULL, 22),
  (v_id, 'Funcionamento da instrumentacao da cabine', true, NULL, 23),
  (v_id, 'Pivotamento dos implementos (Pinos, buchas e folgas)', true, NULL, 24),
  (v_id, 'Vidro dianteiro laminado, temperados com pelicula de seguranca ou policarbonato?', true, NULL, 25),
  (v_id, 'Sinalizacao externa de identificacao (TAG) que permita visualizacao a distancia (frente, traseira e laterais)?', false, NULL, 26),
  (v_id, 'Vazamentos em Geral (oleo, fluido, agua, graxa)', false, NULL, 27),
  (v_id, 'Ausencia de objetos soltos no interior do equipamento que possam gerar riscos em caso de acidentes', false, NULL, 28);

-- ============================================================
-- 15. EMPILHADEIRA (15 itens)
-- ============================================================
SELECT id INTO v_id FROM equipment_types WHERE name = 'Empilhadeira';
INSERT INTO checklist_template_items (equipment_type_id, description, is_blocking, section, order_index) VALUES
  (v_id, 'Cinto de Seguranca?', true, NULL, 1),
  (v_id, 'Radio de comunicacao bidirecional?', true, NULL, 2),
  (v_id, 'Alarme para manobras em marcha a re (quando aplicavel)', true, NULL, 3),
  (v_id, 'Adesivos refletivos nas laterais e traseira', true, NULL, 4),
  (v_id, 'Buzina funcionando?', true, NULL, 5),
  (v_id, 'Extintores de incendio em perfeitas condicoes para uso?', true, NULL, 6),
  (v_id, 'Sistema de deteccao de presenca do operador?', true, NULL, 7),
  (v_id, 'Sinalizacao externa de identificacao (TAG) que permita visualizacao a distancia (frente, traseira e laterais)?', true, NULL, 8),
  (v_id, 'Luz auxiliar para operacao noturna?', true, NULL, 9),
  (v_id, 'Luz de alerta de marcha a re?', true, NULL, 10),
  (v_id, 'Isento de vazamentos em geral?', true, NULL, 11),
  (v_id, 'Sinalizacao de capacidade maxima de carga e tara?', false, NULL, 12),
  (v_id, 'Condicoes estruturais em geral?', false, NULL, 13),
  (v_id, 'Acionamento hidraulico da abertura e fechamento do garfo?', true, NULL, 14),
  (v_id, 'Tabela de carga fixada proxima aos comandos?', true, NULL, 15);

-- ============================================================
-- 16. ESCRAIPERS (13 itens)
-- ============================================================
SELECT id INTO v_id FROM equipment_types WHERE name = 'Escraipers';
INSERT INTO checklist_template_items (equipment_type_id, description, is_blocking, section, order_index) VALUES
  (v_id, 'Cinto de Seguranca?', true, NULL, 1),
  (v_id, 'Saidas de fuga e desembarque em emergencias?', true, NULL, 2),
  (v_id, 'Radio de comunicacao bidirecional?', true, NULL, 3),
  (v_id, 'Alarme para manobras em marcha a re (quando aplicavel)', true, NULL, 4),
  (v_id, 'Cabine climatizada com ar condicionado?', true, NULL, 5),
  (v_id, 'Buzina funcionando?', true, NULL, 6),
  (v_id, 'Extintores de incendio em perfeitas condicoes para uso?', true, NULL, 7),
  (v_id, 'Sinalizacao externa de identificacao (TAG) que permita visualizacao a distancia (frente, traseira e laterais)?', true, NULL, 8),
  (v_id, 'Luz auxiliar para operacao noturna?', true, NULL, 9),
  (v_id, 'As setas, farois, luzes de re, de freio estao operantes?', true, NULL, 10),
  (v_id, 'Isento de vazamentos em geral?', true, NULL, 11),
  (v_id, 'Condicoes estruturais em geral?', false, NULL, 12),
  (v_id, 'Sistema de alerta de proximidade entre equipamentos?', true, 'Obrigatorio somente para areas de lavra', 13);

-- ============================================================
-- 17. MOTONIVELADORA (13 itens)
-- ============================================================
SELECT id INTO v_id FROM equipment_types WHERE name = 'Motoniveladora';
INSERT INTO checklist_template_items (equipment_type_id, description, is_blocking, section, order_index) VALUES
  (v_id, 'Cinto de Seguranca?', true, NULL, 1),
  (v_id, 'Saidas de fuga e desembarque em emergencias?', true, NULL, 2),
  (v_id, 'Radio de comunicacao bidirecional?', true, NULL, 3),
  (v_id, 'Alarme para manobras em marcha a re (quando aplicavel)', true, NULL, 4),
  (v_id, 'Cabine climatizada com ar condicionado?', true, NULL, 5),
  (v_id, 'Buzina funcionando?', true, NULL, 6),
  (v_id, 'Extintores de incendio em perfeitas condicoes para uso?', true, NULL, 7),
  (v_id, 'Luz de alerta de marcha a re?', true, NULL, 8),
  (v_id, 'Sinalizacao externa de identificacao (TAG) que permita visualizacao a distancia (frente, traseira e laterais)?', true, NULL, 9),
  (v_id, 'Luz auxiliar para operacao noturna?', true, NULL, 10),
  (v_id, 'Isento de vazamentos em geral?', true, NULL, 11),
  (v_id, 'Condicoes estruturais em geral?', false, NULL, 12),
  (v_id, 'Sistema de alerta de proximidade entre equipamentos?', true, 'Obrigatorio somente para areas de lavra', 13);

-- ============================================================
-- 18. PA CARREGADEIRA (17 itens)
-- ============================================================
SELECT id INTO v_id FROM equipment_types WHERE name = 'Pa Carregadeira';
INSERT INTO checklist_template_items (equipment_type_id, description, is_blocking, section, order_index) VALUES
  (v_id, 'Cinto de Seguranca?', true, NULL, 1),
  (v_id, 'Saidas de fuga e desembarque em emergencias?', true, NULL, 2),
  (v_id, 'Radio de comunicacao bidirecional?', true, NULL, 3),
  (v_id, 'Alarme para manobras em marcha a re (quando aplicavel)', true, NULL, 4),
  (v_id, 'Cabine climatizada com ar condicionado?', true, NULL, 5),
  (v_id, 'Buzina funcionando?', true, NULL, 6),
  (v_id, 'Extintores de incendio em perfeitas condicoes para uso?', true, NULL, 7),
  (v_id, 'Os sistemas automaticos de deteccao e supressao de incendios estao disponiveis para uso (quando aplicavel)?', true, NULL, 8),
  (v_id, 'Sinalizacao externa de identificacao (TAG) que permita visualizacao a distancia (frente, traseira e laterais)?', true, NULL, 9),
  (v_id, 'Luz auxiliar para operacao noturna?', true, NULL, 10),
  (v_id, 'Isento de vazamentos em geral?', true, NULL, 11),
  (v_id, 'Sinalizacao de capacidade maxima de carga e tara?', false, NULL, 12),
  (v_id, 'Condicoes estruturais em geral?', false, NULL, 13),
  (v_id, 'Camera de video traseira?', true, 'Obrigatorio para equipamentos de grande porte', 14),
  (v_id, 'Sistemas de monitoramento de pressao e temperatura nos pneus?', true, 'Obrigatorio para equipamentos de grande porte', 15),
  (v_id, 'Grade de protecao sobre o para-brisa (FOG)?', true, 'Obrigatorio para supressao vegetal e demolicao', 16),
  (v_id, 'Sistema de alerta de proximidade entre equipamentos?', true, 'Obrigatorio somente para areas de lavra', 17);

-- ============================================================
-- 19. PERFURATRIZ (14 itens)
-- ============================================================
SELECT id INTO v_id FROM equipment_types WHERE name = 'Perfuratriz';
INSERT INTO checklist_template_items (equipment_type_id, description, is_blocking, section, order_index) VALUES
  (v_id, 'Cinto de Seguranca?', true, NULL, 1),
  (v_id, 'Radio de comunicacao bidirecional?', true, NULL, 2),
  (v_id, 'Alarme para manobras em marcha a re (quando aplicavel)', true, NULL, 3),
  (v_id, 'Cabine climatizada com ar condicionado?', true, NULL, 4),
  (v_id, 'Buzina funcionando?', true, NULL, 5),
  (v_id, 'Extintores de incendio em perfeitas condicoes para uso?', true, NULL, 6),
  (v_id, 'Sistema automatico de deteccao e supressao de incendio operante (quando aplicavel)?', true, NULL, 7),
  (v_id, 'Sinalizacao externa de identificacao (TAG) que permita visualizacao a distancia (frente, traseira e laterais)?', true, NULL, 8),
  (v_id, 'Luz auxiliar para operacao noturna?', true, NULL, 9),
  (v_id, 'Sinalizacao de capacidade maxima de carga e tara?', true, NULL, 10),
  (v_id, 'Isento de vazamentos em geral?', true, NULL, 11),
  (v_id, 'Condicoes estruturais em geral?', false, NULL, 12),
  (v_id, 'Camera de video traseira?', true, 'Obrigatorio para equipamentos de grande porte (tara >= 45 ton)', 13),
  (v_id, 'Camera de video lateral?', true, 'Obrigatorio para equipamentos de grande porte (tara >= 45 ton)', 14);

-- ============================================================
-- 20. RETROESCAVADEIRA (15 itens)
-- ============================================================
SELECT id INTO v_id FROM equipment_types WHERE name = 'Retroescavadeira';
INSERT INTO checklist_template_items (equipment_type_id, description, is_blocking, section, order_index) VALUES
  (v_id, 'Cinto de Seguranca?', true, NULL, 1),
  (v_id, 'Saidas de fuga e desembarque em emergencias?', true, NULL, 2),
  (v_id, 'Radio de comunicacao bidirecional?', true, NULL, 3),
  (v_id, 'Alarme para manobras em marcha a re (quando aplicavel)', true, NULL, 4),
  (v_id, 'Cabine climatizada com ar condicionado?', true, NULL, 5),
  (v_id, 'Buzina funcionando?', true, NULL, 6),
  (v_id, 'Grade de protecao sobre o para-brisa (FOG)? Obrigatorio para supressao vegetal e demolicao', true, NULL, 7),
  (v_id, 'Extintores de incendio em perfeitas condicoes para uso?', true, NULL, 8),
  (v_id, 'Os sistemas automaticos de deteccao e supressao de incendios estao disponiveis para uso (quando aplicavel)?', true, NULL, 9),
  (v_id, 'Sinalizacao externa de identificacao (TAG) que permita visualizacao a distancia (frente, traseira e laterais)?', true, NULL, 10),
  (v_id, 'Luz auxiliar para operacao noturna?', true, NULL, 11),
  (v_id, 'Isento de vazamentos em geral?', true, NULL, 12),
  (v_id, 'Sinalizacao de capacidade maxima de carga e tara?', false, NULL, 13),
  (v_id, 'Condicoes estruturais em geral?', false, NULL, 14),
  (v_id, 'Sistema de alerta de proximidade entre equipamentos?', true, 'Obrigatorio somente para areas de lavra', 15);

-- ============================================================
-- 21. TRATOR (18 itens)
-- ============================================================
SELECT id INTO v_id FROM equipment_types WHERE name = 'Trator';
INSERT INTO checklist_template_items (equipment_type_id, description, is_blocking, section, order_index) VALUES
  (v_id, 'Cinto de Seguranca?', true, NULL, 1),
  (v_id, 'Saidas de fuga e desembarque em emergencias?', true, NULL, 2),
  (v_id, 'Radio de comunicacao bidirecional?', true, NULL, 3),
  (v_id, 'Alarme para manobras em marcha a re (quando aplicavel)', true, NULL, 4),
  (v_id, 'Cabine climatizada com ar condicionado?', true, NULL, 5),
  (v_id, 'Buzina funcionando?', true, NULL, 6),
  (v_id, 'Extintores de incendio em perfeitas condicoes para uso?', true, NULL, 7),
  (v_id, 'Os sistemas automaticos de deteccao e supressao de incendios estao disponiveis para uso (quando aplicavel)?', true, NULL, 8),
  (v_id, 'Sinalizacao externa de identificacao (TAG) que permita visualizacao a distancia (frente, traseira e laterais)?', true, NULL, 9),
  (v_id, 'Luz auxiliar para operacao noturna?', true, NULL, 10),
  (v_id, 'Luz de alerta de marcha a re para tratores de pneu?', true, NULL, 11),
  (v_id, 'Isento de vazamentos em geral?', true, NULL, 12),
  (v_id, 'Sinalizacao de capacidade maxima de carga e tara?', false, NULL, 13),
  (v_id, 'Condicoes estruturais em geral?', false, NULL, 14),
  (v_id, 'Camera de video traseira?', true, 'Obrigatorio para equipamentos de grande porte', 15),
  (v_id, 'Camera de video lateral?', true, 'Obrigatorio para equipamentos de grande porte', 16),
  (v_id, 'Grade de protecao sobre o para-brisa (FOG)?', true, 'Obrigatorio para supressao vegetal e demolicao', 17),
  (v_id, 'Sistema de alerta de proximidade entre equipamentos?', true, 'Obrigatorio somente para areas de lavra', 18);

-- ============================================================
-- 22. MANIPULADOR DE PNEUS (16 itens)
-- ============================================================
SELECT id INTO v_id FROM equipment_types WHERE name = 'Manipulador de Pneus';
INSERT INTO checklist_template_items (equipment_type_id, description, is_blocking, section, order_index) VALUES
  (v_id, 'Cinto de Seguranca?', true, NULL, 1),
  (v_id, 'Radio de comunicacao bidirecional?', true, NULL, 2),
  (v_id, 'Alarme para manobras em marcha a re (quando aplicavel)', true, NULL, 3),
  (v_id, 'Adesivos refletivos nas laterais e traseira', true, NULL, 4),
  (v_id, 'Buzina funcionando?', true, NULL, 5),
  (v_id, 'Extintores de incendio em perfeitas condicoes para uso?', true, NULL, 6),
  (v_id, 'Os sistemas automaticos de deteccao e supressao de incendios estao disponiveis para uso (quando aplicavel)?', true, NULL, 7),
  (v_id, 'Sistema de deteccao de presenca do operador?', true, NULL, 8),
  (v_id, 'Sinalizacao externa de identificacao (TAG) que permita visualizacao a distancia (frente, traseira e laterais)?', true, NULL, 9),
  (v_id, 'Luz auxiliar para operacao noturna?', true, NULL, 10),
  (v_id, 'Luz de alerta de marcha a re?', true, NULL, 11),
  (v_id, 'Cabine climatizada com ar condicionado?', true, NULL, 12),
  (v_id, 'Isento de vazamentos em geral?', true, NULL, 13),
  (v_id, 'Sinalizacao de capacidade maxima de carga e tara?', false, NULL, 14),
  (v_id, 'Condicoes estruturais em geral?', false, NULL, 15),
  (v_id, 'Tabela de carga fixada proxima aos comandos?', false, NULL, 16);

-- ============================================================
-- 23. MANIPULADOR TELESCOPICO (16 itens)
-- ============================================================
SELECT id INTO v_id FROM equipment_types WHERE name = 'Manipulador Telescopico';
INSERT INTO checklist_template_items (equipment_type_id, description, is_blocking, section, order_index) VALUES
  (v_id, 'Cinto de Seguranca?', true, NULL, 1),
  (v_id, 'Saidas de fuga e desembarque em emergencias?', true, NULL, 2),
  (v_id, 'Radio de comunicacao bidirecional?', true, NULL, 3),
  (v_id, 'Alarme para manobras em marcha a re (quando aplicavel)', true, NULL, 4),
  (v_id, 'Cabine climatizada com ar condicionado?', true, NULL, 5),
  (v_id, 'Buzina funcionando?', true, NULL, 6),
  (v_id, 'Grade de protecao sobre o para-brisa (FOG)? Obrigatorio para supressao vegetal e demolicao', true, NULL, 7),
  (v_id, 'Extintores de incendio em perfeitas condicoes para uso?', true, NULL, 8),
  (v_id, 'Os sistemas automaticos de deteccao e supressao de incendios estao disponiveis para uso (quando aplicavel)?', true, NULL, 9),
  (v_id, 'Sinalizacao externa de identificacao (TAG) que permita visualizacao a distancia (frente, traseira e laterais)?', true, NULL, 10),
  (v_id, 'Luz auxiliar para operacao noturna?', true, NULL, 11),
  (v_id, 'Isento de vazamentos em geral?', true, NULL, 12),
  (v_id, 'Sinalizacao de capacidade maxima de carga e tara?', false, NULL, 13),
  (v_id, 'Condicoes estruturais em geral?', false, NULL, 14),
  (v_id, 'Tabela de carga fixada proxima aos comandos?', true, NULL, 15),
  (v_id, 'Sistema de alerta de proximidade entre equipamentos?', true, 'Obrigatorio somente para areas de lavra', 16);

-- ============================================================
-- 24. MINI CARREGADEIRA (13 itens)
-- ============================================================
SELECT id INTO v_id FROM equipment_types WHERE name = 'Mini Carregadeira';
INSERT INTO checklist_template_items (equipment_type_id, description, is_blocking, section, order_index) VALUES
  (v_id, 'Cinto de Seguranca?', true, NULL, 1),
  (v_id, 'Saidas de fuga e desembarque em emergencias?', true, NULL, 2),
  (v_id, 'Radio de comunicacao bidirecional?', true, NULL, 3),
  (v_id, 'Alarme para manobras em marcha a re?', true, NULL, 4),
  (v_id, 'Cabine climatizada com ar condicionado?', true, NULL, 5),
  (v_id, 'Buzina funcionando?', true, NULL, 6),
  (v_id, 'Extintores de incendio em perfeitas condicoes para uso?', true, NULL, 7),
  (v_id, 'Sinalizacao externa de identificacao (TAG) que permita visualizacao a distancia (frente, traseira e laterais)?', true, NULL, 8),
  (v_id, 'Luz auxiliar para operacao noturna?', true, NULL, 9),
  (v_id, 'Sinalizacao de capacidade maxima de carga e tara?', true, NULL, 10),
  (v_id, 'Verificar as condicoes do freio e sua eficiencia?', true, NULL, 11),
  (v_id, 'Isento de vazamentos em geral?', true, NULL, 12),
  (v_id, 'Condicoes estruturais em geral?', false, NULL, 13);

-- ============================================================
-- 25. MINI ESCAVADEIRA HIDRAULICA (27 itens)
-- ============================================================
SELECT id INTO v_id FROM equipment_types WHERE name = 'Mini Escavadeira Hidraulica';
INSERT INTO checklist_template_items (equipment_type_id, description, is_blocking, section, order_index) VALUES
  (v_id, 'CNH vencida?', true, NULL, 1),
  (v_id, 'Cracha de RAC e licenca de operacao dentro do prazo de validade?', true, NULL, 2),
  (v_id, 'Nivel de oleo do motor abaixo do minimo?', true, NULL, 3),
  (v_id, 'Nivel de liquido de arrefecimento abaixo do limite?', true, NULL, 4),
  (v_id, 'Nivel combustivel abaixo do limite?', true, NULL, 5),
  (v_id, 'Nivel de oleo do redutor de giro abaixo do limite minimo?', true, NULL, 6),
  (v_id, 'Nivel de oleo hidraulico abaixo do limite minimo?', true, NULL, 7),
  (v_id, 'Vazamentos oleo / Lubrificantes?', true, NULL, 8),
  (v_id, 'Extintor de incendio - Manometro e lacre intacto?', true, NULL, 9),
  (v_id, 'Farois, luzes e lanternas de sinalizacao em condicao de uso?', true, NULL, 10),
  (v_id, 'Balanca fora de funcionamento?', true, NULL, 11),
  (v_id, 'Alavanca de seguranca danificada?', true, NULL, 12),
  (v_id, 'Lanca isenta de danos?', true, NULL, 13),
  (v_id, 'Esteiras isenta de danos?', true, NULL, 14),
  (v_id, 'Carro (Chassi) isento de irregularidade?', true, NULL, 15),
  (v_id, 'Cilindros hidraulicos / Mangueiras isento de irregularidades?', true, NULL, 16),
  (v_id, 'Escapamento / Emissao de fumaca isento de irregularidades?', true, NULL, 17),
  (v_id, 'Cabina em geral em perfeitas condicoes de uso?', true, NULL, 18),
  (v_id, 'Cinto de seguranca sem danos e em perfeitas condicoes para uso?', true, NULL, 19),
  (v_id, 'Banco / Assento - Suporte e fixacao isento de irregularidades?', true, NULL, 20),
  (v_id, 'Para-brisas / Limpador apresentando alguma irregularidade?', true, NULL, 21),
  (v_id, 'Sistemas de Freios isento de irregularidade?', true, NULL, 22),
  (v_id, 'Ar condicionado em boas condicoes para utilizacao?', true, NULL, 23),
  (v_id, 'Bom estado geral de limpeza?', true, NULL, 24),
  (v_id, 'Alarme de re isento de irregularidade?', true, NULL, 25),
  (v_id, 'Local de trabalho / Operacao em boas condicoes para operacao do equipamento?', true, NULL, 26),
  (v_id, 'Buzina isenta de irregularidades?', true, NULL, 27);

-- ============================================================
-- 26. MINI ESCAVADEIRA MAMUTE (37 itens)
-- ============================================================
SELECT id INTO v_id FROM equipment_types WHERE name = 'Mini Escavadeira Mamute';
INSERT INTO checklist_template_items (equipment_type_id, description, is_blocking, section, order_index) VALUES
  (v_id, 'Cracha de RAC e licenca de operacao dentro do prazo de validade?', true, NULL, 1),
  (v_id, 'CNH vencida?', true, NULL, 2),
  (v_id, 'Falha no funcionamento dos Farois, luzes e lanternas de sinalizacao?', true, NULL, 3),
  (v_id, 'Falha no funcionamento do ar condicionado?', true, NULL, 4),
  (v_id, 'Falha no funcionamento do Para-brisas / Limpador?', true, NULL, 5),
  (v_id, 'Falha no funcionamento do Radio de comunicacao?', true, NULL, 6),
  (v_id, 'Falha no funcionamento dos Marcadores do painel?', true, NULL, 7),
  (v_id, 'Alarme de re em condicoes de uso (operante)?', true, NULL, 8),
  (v_id, 'Buzina com defeito ou com som baixo?', true, NULL, 9),
  (v_id, 'Falha no teste do sistema de Freio?', true, 'Sistema de freio', 10),
  (v_id, 'Nivel de oleo do hidraulico abaixo do nivel minimo?', true, 'Sistema Hidraulico', 11),
  (v_id, 'Vazamentos oleo / Lubrificantes?', true, 'Sistema Hidraulico', 12),
  (v_id, 'Nivel de oleo do motor abaixo do nivel minimo?', true, 'Sistema Hidraulico', 13),
  (v_id, 'Nivel de oleo do redutor de giro abaixo do nivel minimo?', true, 'Sistema Hidraulico', 14),
  (v_id, 'Cilindros hidraulicos / Mangueiras com vazamentos?', true, 'Sistema Hidraulico', 15),
  (v_id, 'Nivel de liquido de arrefecimento abaixo do nivel minimo?', true, 'Geral', 16),
  (v_id, 'Extintor de incendio - Manometro e lacre com defeito?', true, 'Geral', 17),
  (v_id, 'Balanca danificada?', true, 'Geral', 18),
  (v_id, 'Alavanca de seguranca danificada?', true, 'Geral', 19),
  (v_id, 'Concha isenta de danos?', true, 'Geral', 20),
  (v_id, 'Lanca isenta de danos?', true, 'Geral', 21),
  (v_id, 'Esteiras danificadas?', true, 'Geral', 22),
  (v_id, 'Carro (Chassi) sem danos?', true, 'Geral', 23),
  (v_id, 'Roletes inferior e superior danificado?', true, 'Geral', 24),
  (v_id, 'Cabina em geral com anomalias, banco/assento - suporte e fixacao, etc?', true, 'Geral', 25),
  (v_id, 'Cinto de seguranca danificado?', true, 'Geral', 26),
  (v_id, 'Falha no sistemas de atracadores?', true, 'Geral', 27),
  (v_id, 'Ha vazamentos no conjunto de valvulas?', true, 'Itens Track Lifter', 28),
  (v_id, 'Ha vazamento das mangueiras e conexoes?', true, 'Itens Track Lifter', 29),
  (v_id, 'Ha vazamento dos cilindros hidraulicos?', true, 'Itens Track Lifter', 30),
  (v_id, 'Existe falha no funcionamento do grupo de garras e atracadores?', true, 'Itens Track Lifter', 31),
  (v_id, 'Existe amassados, arranhoes, empenos etc?', true, 'Itens Track Lifter', 32),
  (v_id, 'Ha falha no funcionamento de deslocamento lateral do Track lifter?', true, 'Itens Track Lifter', 33),
  (v_id, 'Pinos e contrapinos estao desencaixados?', true, 'Itens Track Lifter', 34),
  (v_id, 'Existe trincas, amassados e avarias no kit Track lifter?', true, 'Itens Track Lifter', 35),
  (v_id, 'Falha no sinal luminoso ou sonoro do dispositivo de alerta de aproximacao de pessoas esta funcionando?', true, 'Sistema de sinalizacao de aproximacao de pessoas', 36),
  (v_id, 'Algum empregado envolvido na atividade esta sem as tags no capacete ou, em caso de visitante, sem o cracha tageado?', true, 'Sistema de sinalizacao de aproximacao de pessoas', 37);

-- ============================================================
-- 27. ROLO COMPACTADOR (14 itens)
-- ============================================================
SELECT id INTO v_id FROM equipment_types WHERE name = 'Rolo Compactador';
INSERT INTO checklist_template_items (equipment_type_id, description, is_blocking, section, order_index) VALUES
  (v_id, 'Cinto de Seguranca?', true, NULL, 1),
  (v_id, 'Saidas de fuga e desembarque em emergencias?', true, NULL, 2),
  (v_id, 'Radio de comunicacao bidirecional?', true, NULL, 3),
  (v_id, 'Alarme para manobras em marcha a re', true, NULL, 4),
  (v_id, 'Cabine climatizada com ar condicionado?', true, NULL, 5),
  (v_id, 'Buzina funcionando?', true, NULL, 6),
  (v_id, 'Extintores de incendio em perfeitas condicoes para uso?', true, NULL, 7),
  (v_id, 'Os sistemas automaticos de deteccao e supressao de incendios estao disponiveis para uso (quando aplicavel)?', true, NULL, 8),
  (v_id, 'Sinalizacao externa de identificacao (TAG) que permita visualizacao a distancia (frente, traseira e laterais)?', true, NULL, 9),
  (v_id, 'Possui luz auxiliar para operacao noturna e/ou sob neblina?', true, NULL, 10),
  (v_id, 'Verificar as condicoes do freio e sua eficiencia?', true, NULL, 11),
  (v_id, 'Possui adesivos refletivos (2 cores) nas laterais e traseira?', true, NULL, 12),
  (v_id, 'Isento de vazamentos em geral?', true, NULL, 13),
  (v_id, 'Condicoes estruturais em geral?', false, NULL, 14);

-- ============================================================
-- 28. ROMPEDOR (14 itens)
-- ============================================================
SELECT id INTO v_id FROM equipment_types WHERE name = 'Rompedor';
INSERT INTO checklist_template_items (equipment_type_id, description, is_blocking, section, order_index) VALUES
  (v_id, 'Cinto de Seguranca?', true, NULL, 1),
  (v_id, 'Saidas de fuga e desembarque em emergencias?', true, NULL, 2),
  (v_id, 'Radio de comunicacao bidirecional?', true, NULL, 3),
  (v_id, 'Alarme para manobras em marcha a re', true, NULL, 4),
  (v_id, 'Cabine climatizada com ar condicionado?', true, NULL, 5),
  (v_id, 'Buzina funcionando?', true, NULL, 6),
  (v_id, 'Extintores de incendio em perfeitas condicoes para uso?', true, NULL, 7),
  (v_id, 'Os sistemas automaticos de deteccao e supressao de incendios estao disponiveis para uso (quando aplicavel)?', true, NULL, 8),
  (v_id, 'Sinalizacao externa de identificacao (TAG) que permita visualizacao a distancia (frente, traseira e laterais)?', true, NULL, 9),
  (v_id, 'Possui luz auxiliar para operacao noturna e/ou sob neblina?', true, NULL, 10),
  (v_id, 'Isento de vazamentos em geral?', true, NULL, 11),
  (v_id, 'Possui adesivos refletivos (2 cores) nas laterais e traseira?', true, NULL, 12),
  (v_id, 'Grade de protecao sobre o para-brisa (FOG)?', true, NULL, 13),
  (v_id, 'Condicoes estruturais em geral?', false, NULL, 14);

END $$;
