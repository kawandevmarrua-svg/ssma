-- Repara o histórico de migrations: profiles.created_by foi adicionado
-- manualmente no dashboard remoto e nunca entrou numa migration, o que
-- quebrava o `supabase db reset` local. Idempotente (IF NOT EXISTS) —
-- no remoto vira no-op.
alter table public.profiles
  add column if not exists created_by uuid references public.profiles(id) on delete set null;
