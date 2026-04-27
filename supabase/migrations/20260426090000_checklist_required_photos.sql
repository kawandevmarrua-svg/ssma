-- ============================================================
-- SPEC: 20260426090000_checklist_required_photos.sql
-- Apos as perguntas, o operador deve anexar:
--  - 4 fotos do equipamento (frente, traseira, lateral esquerda, lateral direita / livre)
--  - 1 foto do ambiente onde vai trabalhar
-- ============================================================

alter table public.checklists
  add column if not exists equipment_photo_1_url text,
  add column if not exists equipment_photo_2_url text,
  add column if not exists equipment_photo_3_url text,
  add column if not exists equipment_photo_4_url text,
  add column if not exists environment_photo_url text;

comment on column public.checklists.equipment_photo_1_url is 'Foto 1 do equipamento (storage path)';
comment on column public.checklists.equipment_photo_2_url is 'Foto 2 do equipamento (storage path)';
comment on column public.checklists.equipment_photo_3_url is 'Foto 3 do equipamento (storage path)';
comment on column public.checklists.equipment_photo_4_url is 'Foto 4 do equipamento (storage path)';
comment on column public.checklists.environment_photo_url is 'Foto do ambiente de trabalho (storage path)';
