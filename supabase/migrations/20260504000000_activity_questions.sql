-- ============================================================
-- Separa perguntas da atividade de servico das perguntas de pre-operacao
-- Cria: activity_questions, activity_answers
-- ============================================================

-- ------------------------------------------------------------
-- 1. activity_questions
-- ------------------------------------------------------------
create table if not exists public.activity_questions (
  id uuid primary key default gen_random_uuid(),
  key text unique,
  label text not null,
  critical boolean not null default false,
  order_index integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_activity_questions_active_order
  on public.activity_questions(active, order_index);

comment on table public.activity_questions is
  'Perguntas respondidas pelo operador ao iniciar uma atividade de servico';

create or replace function public.set_activity_questions_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_activity_questions_updated_at on public.activity_questions;
create trigger trg_activity_questions_updated_at
  before update on public.activity_questions
  for each row execute function public.set_activity_questions_updated_at();

-- Seed com as mesmas 12 perguntas (idempotente via key)
insert into public.activity_questions (key, label, critical, order_index, active)
values
  ('checklist_fisico',     'Checklist realizado fisico preenchido? (a Vale exige o preenchimento do formulario fisico)', false, 1,  true),
  ('prontos_preenchido',   'Prontos realizado?',                                                                          false, 2,  true),
  ('apto_operar',          'Voce esta apto para operar?',                                                                 true,  3,  true),
  ('conhece_limites',      'Conhece os limites do equipamento?',                                                          false, 4,  true),
  ('art_disponivel',       'ART e de seu conhecimento e encontra-se disponivel na frente de servico?',                    false, 5,  true),
  ('liberacao_acesso',     'E necessario Liberacao de Acesso?',                                                           false, 6,  true),
  ('pts_preenchida',       'Para esta atividade se aplica a PTS? A PTS esta preenchida?',                                 false, 7,  true),
  ('local_adequado',       'O local da atividade esta adequado para realizacao da tarefa?',                               false, 8,  true),
  ('local_sinalizado',     'O local encontra-se sinalizado ou dentro de area controlada?',                                false, 9,  true),
  ('manutencao_valida',    'A manutencao do equipamento encontra-se valida?',                                             true,  10, true),
  ('radio_comunicacao',    'O equipamento disponibiliza de radio de comunicacao?',                                        false, 11, true),
  ('epi_adequado',         'Voce esta com os EPIs adequados para a atividade?',                                           true,  12, true)
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- 2. activity_answers
-- ------------------------------------------------------------
create table if not exists public.activity_answers (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  question_id uuid not null references public.activity_questions(id) on delete restrict,
  value boolean,
  nc_description text,
  nc_photo_url text,
  created_at timestamptz not null default now(),
  unique (activity_id, question_id)
);

create index if not exists idx_activity_answers_activity on public.activity_answers(activity_id);
create index if not exists idx_activity_answers_question on public.activity_answers(question_id);

comment on table public.activity_answers is
  'Respostas das perguntas de atividade de servico por activity_id';

-- ------------------------------------------------------------
-- 3. RLS
-- ------------------------------------------------------------
alter table public.activity_questions enable row level security;
alter table public.activity_answers enable row level security;

-- Perguntas: leitura para autenticados, escrita apenas admin
drop policy if exists "activity_questions_select_all" on public.activity_questions;
create policy "activity_questions_select_all"
  on public.activity_questions for select
  to authenticated
  using (true);

drop policy if exists "activity_questions_admin_write" on public.activity_questions;
create policy "activity_questions_admin_write"
  on public.activity_questions for all
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- Respostas: operador insere/le das proprias atividades; admin/manager le tudo
drop policy if exists "activity_answers_insert_own" on public.activity_answers;
create policy "activity_answers_insert_own"
  on public.activity_answers for insert
  to authenticated
  with check (
    exists (
      select 1 from public.activities a
      where a.id = activity_answers.activity_id
        and a.operator_id = auth.uid()
    )
    or public.current_user_role() in ('admin', 'manager')
  );

drop policy if exists "activity_answers_select_own" on public.activity_answers;
create policy "activity_answers_select_own"
  on public.activity_answers for select
  to authenticated
  using (
    exists (
      select 1 from public.activities a
      where a.id = activity_answers.activity_id
        and a.operator_id = auth.uid()
    )
    or public.current_user_role() in ('admin', 'manager')
  );

drop policy if exists "activity_answers_admin_write" on public.activity_answers;
create policy "activity_answers_admin_write"
  on public.activity_answers for all
  to authenticated
  using (public.current_user_role() in ('admin', 'manager'))
  with check (public.current_user_role() in ('admin', 'manager'));
