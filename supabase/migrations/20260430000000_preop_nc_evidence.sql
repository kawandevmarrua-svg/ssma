-- ============================================================
-- SPEC: 20260430000000_preop_nc_evidence.sql
-- Adiciona evidencia de nao conformidade na pre-operacao.
-- Quando o operador responde "Nao" em uma pergunta da pre-op
-- ele e obrigado a anexar uma foto e pode descrever o que houve.
-- ============================================================

alter table public.pre_op_answers
  add column if not exists nc_description text,
  add column if not exists nc_photo_url text;

comment on column public.pre_op_answers.nc_description is 'Descricao opcional do operador quando responde "Nao" (NC).';
comment on column public.pre_op_answers.nc_photo_url is 'Storage path da foto obrigatoria quando responde "Nao" (NC).';
