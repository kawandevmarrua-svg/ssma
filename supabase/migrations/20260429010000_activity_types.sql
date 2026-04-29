-- ============================================================
-- Catalogo de tipos de atividade (codigos P/S da Vale)
-- Permite cadastrar pelo painel e selecionar no app mobile
-- por codigo ou descricao.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.activity_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null,
  category text not null check (category in ('parada', 'servico', 'outro')),
  allow_custom boolean not null default false,
  active boolean not null default true,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_activity_types_active_order
  on public.activity_types(active, category, order_index);
create index if not exists idx_activity_types_code on public.activity_types(code);

comment on table public.activity_types is
  'Catalogo de tipos de atividade (P=Parada, S=Servico). allow_custom=true => requer descricao adicional do operador.';

create or replace function public.set_activity_types_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_activity_types_updated_at on public.activity_types;
create trigger trg_activity_types_updated_at
  before update on public.activity_types
  for each row execute function public.set_activity_types_updated_at();

-- ------------------------------------------------------------
-- Seed: Paradas (P) e Servicos (S)
-- ------------------------------------------------------------
insert into public.activity_types (code, description, category, allow_custom, order_index) values
  ('P01', 'Dialogo Diario de Seguranca',                                  'parada',  false,  1),
  ('P02', 'A Disposicao da Vale',                                         'parada',  false,  2),
  ('P03', 'Almoco',                                                       'parada',  false,  3),
  ('P04', 'Manutencao (Incluindo Lubrificacao)',                          'parada',  false,  4),
  ('P05', 'Condicoes climaticas',                                         'parada',  false,  5),
  ('P06', 'Abastecimento',                                                'parada',  false,  6),
  ('P07', 'Locomocao sobre carreta',                                      'parada',  false,  7),
  ('P08', 'Treinamentos',                                                 'parada',  false,  8),
  ('P09', 'Campanhas e eventos de SSMA',                                  'parada',  false,  9),
  ('P10', 'Aguardando transporte de prancha',                             'parada',  false, 10),
  ('P11', 'Locomocao propria (Maquina x frente de servico)',              'parada',  false, 11),
  ('P12', 'Deslocamento (operador x frente de servico)',                  'parada',  false, 12),
  ('P13', 'Aguardando apoio logistico (caminhonete)',                     'parada',  false, 13),
  ('P14', 'Retirada para desmonte',                                       'parada',  false, 14),
  ('P15', 'Aguardando liberacao de checklist secundario',                 'parada',  false, 15),
  ('P_OUTROS', 'Outros (informar)',                                       'parada',  true,  99),
  ('S01', 'Construcao de praca',                                          'servico', false,  1),
  ('S02', 'Construcao de talude',                                         'servico', false,  2),
  ('S03', 'Limpeza do sump',                                              'servico', false,  3),
  ('S04', 'Abertura de canaletas',                                        'servico', false,  4),
  ('S05', 'Abastecimento de equipamento',                                 'servico', false,  5),
  ('S06', 'Locomocao sobre esteira',                                      'servico', false,  6),
  ('S07', 'Confeccao de leira',                                           'servico', false,  7),
  ('S08', 'Abertura de solo para tubulacao',                              'servico', false,  8),
  ('S09', 'Revitalizacao de acesso',                                      'servico', false,  9),
  ('S10', 'Aterro',                                                       'servico', false, 10),
  ('S11', 'Limpeza de berma',                                             'servico', false, 11),
  ('S12', 'Confeccao de sump',                                            'servico', false, 12),
  ('S13', 'Apoio a Outros Terceiros da Vale',                             'servico', false, 13),
  ('S14', 'Mov. De Carga',                                                'servico', false, 14),
  ('S15', 'Abertura de acesso',                                           'servico', false, 15),
  ('S16', 'Lubrificacao',                                                 'servico', false, 16),
  ('S_OUTROS', 'Outro (informar)',                                        'servico', true,  99)
on conflict (code) do nothing;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.activity_types enable row level security;

drop policy if exists "activity_types_select_all" on public.activity_types;
create policy "activity_types_select_all"
  on public.activity_types for select
  to authenticated
  using (true);

drop policy if exists "activity_types_admin_write" on public.activity_types;
create policy "activity_types_admin_write"
  on public.activity_types for all
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- ------------------------------------------------------------
-- activities.activity_type_id (nullable: nao bloqueia atividades antigas)
-- ------------------------------------------------------------
alter table public.activities
  add column if not exists activity_type_id uuid references public.activity_types(id) on delete set null;

create index if not exists idx_activities_activity_type on public.activities(activity_type_id);

comment on column public.activities.activity_type_id is
  'Tipo de atividade (FK para activity_types). Description da activity continua sendo usado para texto adicional/livre.';
