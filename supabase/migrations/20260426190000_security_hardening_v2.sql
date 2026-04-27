-- ============================================================
-- Hardening v2 (resposta ao diagnostico de seguranca):
-- 1. operators: bloquear update de campos sensiveis
--    (auth_user_id, created_by, role, email)
-- 2. safety_alerts: operador so pode atualizar response_text/response_at,
--    nunca title/message/severity/operator_id
-- 3. Storage: enforce MIME e size em todos os buckets
-- 4. Garantir RLS habilitado em safety_alerts (defesa em profundidade)
-- 5. Bloquear DELETE de safety_alerts por nao-admin
-- ============================================================

-- ------------------------------------------------------------
-- 1. operators: trigger de protecao de campos sensiveis
-- ------------------------------------------------------------

create or replace function public.prevent_operator_sensitive_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  caller_role := public.current_user_role();

  -- Service role e admin podem alterar tudo.
  if caller_role = 'admin' then
    return new;
  end if;

  -- Demais (manager que criou, operador) nao podem mudar campos criticos.
  if new.auth_user_id is distinct from old.auth_user_id then
    raise exception 'Apenas admins podem alterar auth_user_id de operators';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'Apenas admins podem alterar created_by de operators';
  end if;
  if new.email is distinct from old.email then
    raise exception 'Apenas admins podem alterar email de operators';
  end if;
  if new.role is distinct from old.role then
    raise exception 'Apenas admins podem alterar role de operators';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_operator_sensitive_updates on public.operators;
create trigger trg_prevent_operator_sensitive_updates
  before update on public.operators
  for each row execute function public.prevent_operator_sensitive_updates();

-- ------------------------------------------------------------
-- 2. safety_alerts: trigger limita o que operador pode atualizar
-- ------------------------------------------------------------

-- Garantir RLS habilitado (defesa em profundidade).
alter table public.safety_alerts enable row level security;

create or replace function public.restrict_safety_alert_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  caller_role := public.current_user_role();

  -- Admin/manager podem alterar qualquer campo.
  if caller_role in ('admin', 'manager') then
    return new;
  end if;

  -- Operador (ou qualquer outro role) so pode tocar em response_text/response_at/responded_by.
  if new.title is distinct from old.title
     or new.message is distinct from old.message
     or new.severity is distinct from old.severity
     or new.operator_id is distinct from old.operator_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Operador nao pode alterar metadados do alerta';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_restrict_safety_alert_updates on public.safety_alerts;
create trigger trg_restrict_safety_alert_updates
  before update on public.safety_alerts
  for each row execute function public.restrict_safety_alert_updates();

-- Bloquear DELETE de alertas por nao-admin (caso exista policy aberta).
drop policy if exists "Operators can delete alerts" on public.safety_alerts;

-- ------------------------------------------------------------
-- 3. Storage: enforce MIME types e tamanho maximo nos buckets
--    (5 MB por foto eh suficiente apos compressao 0.5)
-- ------------------------------------------------------------

do $$
begin
  -- checklist-photos
  if exists (select 1 from storage.buckets where id = 'checklist-photos') then
    update storage.buckets
       set file_size_limit = 5 * 1024 * 1024,
           allowed_mime_types = array['image/jpeg','image/png','image/heic','image/webp']
     where id = 'checklist-photos';
  end if;

  -- activity-photos
  if exists (select 1 from storage.buckets where id = 'activity-photos') then
    update storage.buckets
       set file_size_limit = 5 * 1024 * 1024,
           allowed_mime_types = array['image/jpeg','image/png','image/heic','image/webp']
     where id = 'activity-photos';
  end if;

  -- inspection-photos
  if exists (select 1 from storage.buckets where id = 'inspection-photos') then
    update storage.buckets
       set file_size_limit = 5 * 1024 * 1024,
           allowed_mime_types = array['image/jpeg','image/png','image/heic','image/webp']
     where id = 'inspection-photos';
  end if;
end $$;

-- ------------------------------------------------------------
-- 4. Revogar permissoes default em funcoes SECURITY DEFINER novas
-- ------------------------------------------------------------

revoke all on function public.prevent_operator_sensitive_updates() from public;
revoke all on function public.restrict_safety_alert_updates() from public;
