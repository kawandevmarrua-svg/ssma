-- ============================================================
-- Hardening v3:
-- 1. pre_operation_checks: bloquear operador de alterar campos
--    apos a primeira gravacao (anti-tampering em pre-op reprovada).
--    Operador so pode UPDATE no mesmo dia da criacao e nao pode
--    mudar operator_id nem voltar a data.
-- ============================================================

create or replace function public.restrict_pre_op_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  caller_role := public.current_user_role();

  -- Admin/manager podem corrigir tudo.
  if caller_role in ('admin', 'manager') then
    return new;
  end if;

  -- Operador (ou qualquer outro role) nao pode mudar identidade nem data.
  if new.operator_id is distinct from old.operator_id then
    raise exception 'Operador nao pode alterar operator_id da pre-operacao';
  end if;
  if new.date is distinct from old.date then
    raise exception 'Operador nao pode alterar a data da pre-operacao';
  end if;
  if new.created_at is distinct from old.created_at then
    raise exception 'Operador nao pode alterar created_at';
  end if;

  -- Apos o dia da criacao, congela o registro.
  -- Justificativa: pre-op reprovada nao pode ser "consertada" no dia seguinte.
  if old.created_at::date < current_date then
    raise exception 'Pre-operacao so pode ser editada no mesmo dia da criacao';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_restrict_pre_op_updates on public.pre_operation_checks;
create trigger trg_restrict_pre_op_updates
  before update on public.pre_operation_checks
  for each row execute function public.restrict_pre_op_updates();

revoke all on function public.restrict_pre_op_updates() from public;
