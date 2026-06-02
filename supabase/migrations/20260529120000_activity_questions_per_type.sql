-- ============================================================
-- SPEC: 20260529120000_activity_questions_per_type.sql
-- Perguntas de atividade de servico por TIPO (igual itens por maquina).
--
-- Modelo (1:N, espelha machine_checklist_items):
--   activity_questions ganha:
--     - activity_type_id (nullable FK -> activity_types)
--     - is_global (bool)
--   * activity_type_id IS NULL + is_global=true  -> pergunta GLOBAL (as 12 atuais)
--   * activity_type_id = X                        -> pergunta CUSTOM do tipo X
--
--   activity_types ganha:
--     - use_custom_questions (bool, default false)
--   * false -> operador ve as GLOBAIS (comportamento atual, nada quebra)
--   * true  -> operador ve so as perguntas do proprio tipo
--
-- activity_answers.question_id continua referenciando activity_questions,
-- entao respostas funcionam para globais E custom sem alteracao.
-- ============================================================

-- ------------------------------------------------------------
-- 1. activity_types.use_custom_questions
-- ------------------------------------------------------------
alter table public.activity_types
  add column if not exists use_custom_questions boolean not null default false;

comment on column public.activity_types.use_custom_questions is
  'Quando true, o operador responde as perguntas proprias do tipo (activity_questions.activity_type_id = id) em vez das globais.';

-- ------------------------------------------------------------
-- 2. activity_questions: vinculo opcional a um tipo + flag global
-- ------------------------------------------------------------
alter table public.activity_questions
  add column if not exists activity_type_id uuid references public.activity_types(id) on delete cascade,
  add column if not exists is_global boolean not null default false;

-- Perguntas existentes (as 12 seed) viram globais.
update public.activity_questions
  set is_global = true
  where activity_type_id is null and is_global = false;

-- A constraint UNIQUE(key) impede reusar a mesma key em perguntas custom.
-- Perguntas custom nao usam key; deixamos key null nelas.
create index if not exists idx_activity_questions_type_active_order
  on public.activity_questions(activity_type_id, active, order_index);

create index if not exists idx_activity_questions_global_active_order
  on public.activity_questions(is_global, active, order_index);

comment on column public.activity_questions.activity_type_id is
  'NULL = pergunta global; preenchido = pergunta especifica de um tipo de atividade.';
comment on column public.activity_questions.is_global is
  'true = aparece para tipos que usam o conjunto global (use_custom_questions=false).';

-- ------------------------------------------------------------
-- 3. RLS: escrita para admin/manager (modelo do app: manager = acesso total)
--    A policy original era admin-only; ampliamos para manager configurar tambem.
-- ------------------------------------------------------------
drop policy if exists "activity_questions_admin_write" on public.activity_questions;
create policy "activity_questions_admin_write"
  on public.activity_questions for all
  to authenticated
  using (public.current_user_role() in ('admin', 'manager'))
  with check (public.current_user_role() in ('admin', 'manager'));
