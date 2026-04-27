-- Vincula usuarios à auth.users
alter table public.usuarios
  add column auth_user_id uuid unique references auth.users(id) on delete set null;
