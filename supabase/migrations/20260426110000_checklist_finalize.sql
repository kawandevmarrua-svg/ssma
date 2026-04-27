-- ============================================================
-- SPEC: 20260426110000_checklist_finalize.sql
-- Adiciona colunas para finalizar um checklist (apos a inspecao
-- inicial, o operador trabalha e depois finaliza com foto de
-- termino, interferencia, translado e observacoes).
--
-- Fluxo:
--   1) Operador faz inspecao -> checklist gravado com status='pending'
--   2) Operador trabalha
--   3) Operador toca "Finalizar Checklist" -> preenche essas colunas
--      e status passa a 'completed'
-- ============================================================

alter table public.checklists
  add column if not exists ended_at timestamptz,
  add column if not exists end_photo_url text,
  add column if not exists had_interference boolean not null default false,
  add column if not exists interference_notes text,
  add column if not exists transit_start timestamptz,
  add column if not exists transit_end timestamptz,
  add column if not exists end_notes text;

comment on column public.checklists.ended_at is 'Quando o operador finalizou o checklist (apos trabalhar)';
comment on column public.checklists.end_photo_url is 'Foto de termino do trabalho';
