-- ============================================================
-- SPEC: 20260426080000_machines_mobile_integration.sql
-- Conecta o cadastro de Maquinas (web) ao fluxo de Checklist (mobile)
--
-- Mudancas:
-- 1. RLS: operadores autenticados podem LER machines e machine_checklist_items
-- 2. checklists ganha coluna machine_id (nullable, p/ compatibilidade)
-- 3. checklist_responses ganha:
--      - machine_item_id (nullable, FK p/ machine_checklist_items)
--      - response_value text (texto/numero p/ response_type != yes_no/yes_no_na)
--      - template_item_id passa a ser nullable
-- 4. RLS de checklist_responses INSERT considera o novo machine_item_id
-- ============================================================

-- 1. RLS: leitura aberta de machines para qualquer usuario autenticado
--    (operadores precisam ler maquinas mesmo sem ser o created_by)
drop policy if exists "machines_select_authenticated" on public.machines;
create policy "machines_select_authenticated"
  on public.machines for select
  to authenticated
  using (true);

-- 2. RLS: leitura aberta de machine_checklist_items para qualquer autenticado
drop policy if exists "mci_select_authenticated" on public.machine_checklist_items;
create policy "mci_select_authenticated"
  on public.machine_checklist_items for select
  to authenticated
  using (true);

-- 3. checklists.machine_id
alter table public.checklists
  add column if not exists machine_id uuid references public.machines(id) on delete set null;

create index if not exists idx_checklists_machine on public.checklists(machine_id);

-- 4. checklist_responses: novas colunas + template_item_id nullable
alter table public.checklist_responses
  add column if not exists machine_item_id uuid references public.machine_checklist_items(id) on delete cascade,
  add column if not exists response_value text;

alter table public.checklist_responses
  alter column template_item_id drop not null;

-- Garante que cada resposta esta vinculada a UM tipo de item (template OU machine)
alter table public.checklist_responses
  drop constraint if exists checklist_responses_item_xor;
alter table public.checklist_responses
  add constraint checklist_responses_item_xor
  check (
    (template_item_id is not null and machine_item_id is null)
    or (template_item_id is null and machine_item_id is not null)
  );

create index if not exists idx_responses_machine_item on public.checklist_responses(machine_item_id);

-- 5. RLS de INSERT de checklist_responses ja existe e checa via checklist_id+operator,
--    o que permanece valido. Nao precisa mudar.
