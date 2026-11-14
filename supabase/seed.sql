-- ============================================================
-- SEED — APENAS ambiente local (supabase db reset / start).
-- Nunca roda no remoto (db push não aplica seed).
--
-- Usuários criados (senha entre parênteses):
--   admin@local.dev       (Admin123!)   → role admin
--   encarregado@local.dev (Chefe123!)   → role encarregado
--   operador@local.dev    (Operar123!)  → role operator
--   kawan@gmail.com       (Kawan123)    → role admin (conta pessoal de teste: web + app)
-- ============================================================

-- ---------- grants (paridade com o remoto) ----------
-- O bootstrap local do CLI restringe as default privileges (sem DML para
-- authenticated/service_role). No remoto esses grants existem. RLS continua
-- sendo a barreira por linha; grant é só o pré-requisito de acesso à tabela.
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;

-- ---------- helper: cria usuário auth + identity ----------
create or replace function pg_temp.seed_user(uid uuid, uemail text, upassword text, uname text)
returns void language plpgsql as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    uemail, extensions.crypt(upassword, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', uname),
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), uid, uid::text,
    jsonb_build_object('sub', uid::text, 'email', uemail, 'email_verified', true),
    'email', now(), now(), now()
  );
end;
$$;

select pg_temp.seed_user('a0000000-0000-4000-8000-000000000001', 'admin@local.dev',       'Admin123!',  'Admin Local');
select pg_temp.seed_user('a0000000-0000-4000-8000-000000000002', 'encarregado@local.dev', 'Chefe123!',  'Encarregado Local');
select pg_temp.seed_user('a0000000-0000-4000-8000-000000000003', 'operador@local.dev',    'Operar123!', 'Operador Local');
select pg_temp.seed_user('a0000000-0000-4000-8000-000000000004', 'kawan@gmail.com',       'Kawan123',   'Kawan');

-- O trigger handle_new_user cria os profiles com role='pending'; promove aqui.
update public.profiles set role = 'admin',       active = true where id = 'a0000000-0000-4000-8000-000000000001';
update public.profiles set role = 'encarregado', active = true, created_by = 'a0000000-0000-4000-8000-000000000001' where id = 'a0000000-0000-4000-8000-000000000002';
update public.profiles set role = 'operator',    active = true, created_by = 'a0000000-0000-4000-8000-000000000001' where id = 'a0000000-0000-4000-8000-000000000003';
update public.profiles set role = 'admin',       active = true, created_by = 'a0000000-0000-4000-8000-000000000001' where id = 'a0000000-0000-4000-8000-000000000004';

-- ---------- máquinas de exemplo ----------
insert into public.machines (name, tag, serial_number, qr_code, active, created_by)
values
  ('Escavadeira CAT 320', 'ESC-001', 'SN-CAT320-0001', 'MAQ-ESC-001', true, 'a0000000-0000-4000-8000-000000000001'),
  ('Guindaste Liebherr LTM', 'GUI-001', 'SN-LTM-0001',   'MAQ-GUI-001', true, 'a0000000-0000-4000-8000-000000000001')
on conflict do nothing;
