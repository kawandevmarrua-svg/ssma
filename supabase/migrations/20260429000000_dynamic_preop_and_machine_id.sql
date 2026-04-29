-- ============================================================
-- 1. Pre-operacao dinamica:
--    - Tabela pre_op_questions (perguntas editaveis pelo painel)
--    - Tabela pre_op_answers (respostas em linhas, nao colunas)
--    - Migra dados existentes de pre_operation_checks (colunas) -> pre_op_answers
--    - Remove colunas antigas
--    - Atualiza trigger de pre-operacao critica
-- 2. activities.machine_id (FK direta para machines), backfill via checklists
-- ============================================================

-- ------------------------------------------------------------
-- 1.1 pre_op_questions
-- ------------------------------------------------------------
create table if not exists public.pre_op_questions (
  id uuid primary key default gen_random_uuid(),
  key text unique,
  label text not null,
  critical boolean not null default false,
  order_index integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pre_op_questions_active_order
  on public.pre_op_questions(active, order_index);

comment on table public.pre_op_questions is
  'Perguntas da pre-operacao gerenciadas pelo painel admin';

create or replace function public.set_pre_op_questions_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_pre_op_questions_updated_at on public.pre_op_questions;
create trigger trg_pre_op_questions_updated_at
  before update on public.pre_op_questions
  for each row execute function public.set_pre_op_questions_updated_at();

-- Seed com as 12 perguntas atuais (idempotente via key)
insert into public.pre_op_questions (key, label, critical, order_index, active)
values
  ('checklist_fisico',     'Checklist realizado fisico preenchido? (a Vale exige o preenchimento do formulario fisico)', false, 1, true),
  ('prontos_preenchido',   'Prontos realizado?',                                                                          false, 2, true),
  ('apto_operar',          'Voce esta apto para operar?',                                                                 true,  3, true),
  ('conhece_limites',      'Conhece os limites do equipamento?',                                                          false, 4, true),
  ('art_disponivel',       'ART e de seu conhecimento e encontra-se disponivel na frente de servico?',                    false, 5, true),
  ('liberacao_acesso',     'E necessario Liberacao de Acesso?',                                                           false, 6, true),
  ('pts_preenchida',       'Para esta atividade se aplica a PTS? A PTS esta preenchida?',                                 false, 7, true),
  ('local_adequado',       'O local da atividade esta adequado para realizacao da tarefa?',                               false, 8, true),
  ('local_sinalizado',     'O local encontra-se sinalizado ou dentro de area controlada?',                                false, 9, true),
  ('manutencao_valida',    'A manutencao do equipamento encontra-se valida?',                                             true,  10, true),
  ('radio_comunicacao',    'O equipamento disponibiliza de radio de comunicacao?',                                        false, 11, true),
  ('epi_adequado',         'Voce esta com os EPIs adequados para a atividade?',                                           true,  12, true)
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- 1.2 pre_op_answers
-- ------------------------------------------------------------
create table if not exists public.pre_op_answers (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references public.pre_operation_checks(id) on delete cascade,
  question_id uuid not null references public.pre_op_questions(id) on delete restrict,
  value boolean,
  created_at timestamptz not null default now(),
  unique (check_id, question_id)
);

create index if not exists idx_pre_op_answers_check on public.pre_op_answers(check_id);
create index if not exists idx_pre_op_answers_question on public.pre_op_answers(question_id);

comment on table public.pre_op_answers is
  'Respostas das perguntas pre-operacao (modelo flexivel)';

-- ------------------------------------------------------------
-- 1.3 Migra dados antigos: para cada pre_operation_checks, insere
--     respostas em pre_op_answers usando as colunas existentes.
--     Roda apenas se as colunas antigas ainda existem.
-- ------------------------------------------------------------
do $$
declare
  has_old_cols boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pre_operation_checks'
      and column_name = 'apto_operar'
  ) into has_old_cols;

  if has_old_cols then
    insert into public.pre_op_answers (check_id, question_id, value)
    select c.id, q.id,
      case q.key
        when 'checklist_fisico'  then c.checklist_fisico
        when 'prontos_preenchido' then c.prontos_preenchido
        when 'apto_operar'        then c.apto_operar
        when 'conhece_limites'    then c.conhece_limites
        when 'art_disponivel'     then c.art_disponivel
        when 'liberacao_acesso'   then c.liberacao_acesso
        when 'pts_preenchida'     then c.pts_preenchida
        when 'local_adequado'     then c.local_adequado
        when 'local_sinalizado'   then c.local_sinalizado
        when 'manutencao_valida'  then c.manutencao_valida
        when 'radio_comunicacao'  then c.radio_comunicacao
        when 'epi_adequado'       then c.epi_adequado
      end as value
    from public.pre_operation_checks c
    cross join public.pre_op_questions q
    where q.key in (
      'checklist_fisico','prontos_preenchido','apto_operar','conhece_limites',
      'art_disponivel','liberacao_acesso','pts_preenchida','local_adequado',
      'local_sinalizado','manutencao_valida','radio_comunicacao','epi_adequado'
    )
    on conflict (check_id, question_id) do nothing;
  end if;
end $$;

-- ------------------------------------------------------------
-- 1.4 Trigger antigo de pre-operacao critica
--     A migracao 20260427120000_disable_auto_safety_alerts.sql ja
--     removeu o trigger e a funcao. Nao recriamos: alertas agora sao
--     criados manualmente pelo painel web.
-- ------------------------------------------------------------
drop trigger if exists trg_critical_pre_operation on public.pre_operation_checks;
drop function if exists public.notify_critical_pre_operation();

-- ------------------------------------------------------------
-- 1.5 Remove colunas antigas de pre_operation_checks
-- ------------------------------------------------------------
alter table public.pre_operation_checks
  drop column if exists checklist_fisico,
  drop column if exists prontos_preenchido,
  drop column if exists apto_operar,
  drop column if exists conhece_limites,
  drop column if exists art_disponivel,
  drop column if exists liberacao_acesso,
  drop column if exists pts_preenchida,
  drop column if exists local_adequado,
  drop column if exists local_sinalizado,
  drop column if exists manutencao_valida,
  drop column if exists radio_comunicacao,
  drop column if exists epi_adequado;

-- ------------------------------------------------------------
-- 1.6 RLS para pre_op_questions e pre_op_answers
-- ------------------------------------------------------------
alter table public.pre_op_questions enable row level security;
alter table public.pre_op_answers enable row level security;

-- Perguntas: leitura para autenticados, escrita apenas admin
drop policy if exists "pre_op_questions_select_all" on public.pre_op_questions;
create policy "pre_op_questions_select_all"
  on public.pre_op_questions for select
  to authenticated
  using (true);

drop policy if exists "pre_op_questions_admin_write" on public.pre_op_questions;
create policy "pre_op_questions_admin_write"
  on public.pre_op_questions for all
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- Respostas: operador insere/le as proprias; admin/manager le tudo
-- (operator_id agora referencia profiles.id que e auth.uid())
drop policy if exists "pre_op_answers_insert_own" on public.pre_op_answers;
create policy "pre_op_answers_insert_own"
  on public.pre_op_answers for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.pre_operation_checks c
      where c.id = pre_op_answers.check_id
        and c.operator_id = auth.uid()
    )
    or public.current_user_role() in ('admin','manager')
  );

drop policy if exists "pre_op_answers_select_own" on public.pre_op_answers;
create policy "pre_op_answers_select_own"
  on public.pre_op_answers for select
  to authenticated
  using (
    exists (
      select 1
      from public.pre_operation_checks c
      where c.id = pre_op_answers.check_id
        and c.operator_id = auth.uid()
    )
    or public.current_user_role() in ('admin','manager')
  );

drop policy if exists "pre_op_answers_admin_write" on public.pre_op_answers;
create policy "pre_op_answers_admin_write"
  on public.pre_op_answers for all
  to authenticated
  using (public.current_user_role() in ('admin','manager'))
  with check (public.current_user_role() in ('admin','manager'));

-- ------------------------------------------------------------
-- 2. activities.machine_id
-- ------------------------------------------------------------
alter table public.activities
  add column if not exists machine_id uuid references public.machines(id) on delete set null;

create index if not exists idx_activities_machine on public.activities(machine_id);

-- Backfill: usa machine_id do checklist quando existir
update public.activities a
   set machine_id = c.machine_id
  from public.checklists c
 where a.checklist_id = c.id
   and a.machine_id is null
   and c.machine_id is not null;

comment on column public.activities.machine_id is
  'Maquina cadastrada utilizada na atividade (denormalizado para filtros)';
