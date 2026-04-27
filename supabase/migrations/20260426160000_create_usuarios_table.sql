-- ===========================================
-- TABELA: usuarios
-- Cadastro de usuários do sistema web (web admin/gestor)
-- com cargos: Técnico de segurança, Engenheiro de segurança,
-- Coordenador de segurança, Analista de SSMA, Supervisor de operações
-- ===========================================
create table public.usuarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null unique,
  cargo text not null check (cargo in (
    'Técnico de segurança',
    'Engenheiro de segurança',
    'Coordenador de segurança',
    'Analista de SSMA',
    'Supervisor de operações'
  )),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.usuarios enable row level security;

create policy "usuarios_select_authenticated"
  on public.usuarios for select
  to authenticated using (true);

create policy "usuarios_insert_authenticated"
  on public.usuarios for insert
  to authenticated with check (true);

create policy "usuarios_update_authenticated"
  on public.usuarios for update
  to authenticated using (true) with check (true);

create policy "usuarios_delete_authenticated"
  on public.usuarios for delete
  to authenticated using (true);
