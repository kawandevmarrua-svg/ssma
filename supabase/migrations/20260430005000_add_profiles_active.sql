-- Repara histórico: profiles.active foi adicionado manualmente no remoto.
-- Idempotente — no remoto vira no-op.
alter table public.profiles
  add column if not exists active boolean not null default true;
