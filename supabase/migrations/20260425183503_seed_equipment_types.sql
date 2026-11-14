-- ============================================================
-- SPEC: 002_seed_equipment_types.sql
-- Seed dos 29 tipos de equipamento conforme PRO-040169 rev.02
-- ============================================================

INSERT INTO equipment_types (name, category) VALUES
  ('Guindaste Articulado',          'guindaste'),
  ('Caminhao Basculante',           'caminhao'),
  ('Caminhao Brook',                'caminhao'),
  ('Caminhao Carroceria',           'caminhao'),
  ('Caminhao Comboio',              'caminhao'),
  ('Caminhao Conjugado',            'caminhao'),
  ('Caminhao Hidrojateamento',      'caminhao'),
  ('Caminhao Hipervacuo',           'caminhao'),
  ('Caminhao Pipa',                 'caminhao'),
  ('Caminhao Prancha',              'caminhao'),
  ('Caminhao Succao',               'caminhao'),
  ('Caminhao Vassoura',             'caminhao'),
  ('Fora de Estrada',               'fora_estrada'),
  ('Escavadeira',                   'escavadeira'),
  ('Escavadeira Anfibia',           'escavadeira'),
  ('Empilhadeira',                  'empilhadeira'),
  ('Escraipers',                    'escraipers'),
  ('Motoniveladora',                'motoniveladora'),
  ('Pa Carregadeira',               'pa_carregadeira'),
  ('Perfuratriz',                   'perfuratriz'),
  ('Retroescavadeira',              'retroescavadeira'),
  ('Trator',                        'trator'),
  ('Manipulador de Pneus',          'manipulador'),
  ('Manipulador Telescopico',       'manipulador'),
  ('Mini Carregadeira',             'mini_carregadeira'),
  ('Mini Escavadeira Hidraulica',   'mini_escavadeira'),
  ('Mini Escavadeira Mamute',       'mini_escavadeira'),
  ('Rolo Compactador',              'rolo_compactador'),
  ('Rompedor',                      'rompedor')
ON CONFLICT (name) DO NOTHING;
