-- ===========================================
-- Apagar todos os alertas existentes
-- ===========================================
delete from public.safety_alerts;

-- ===========================================
-- Funcao para buscar push tokens dos operadores (bypassa RLS)
-- ===========================================
create or replace function public.get_operator_push_tokens(target_operator_id uuid default null)
returns table(push_token text) as $$
begin
  if target_operator_id is not null then
    return query
      select p.push_token
      from public.profiles p
      join public.operators o on o.auth_user_id = p.id
      where o.id = target_operator_id
      and p.push_token is not null;
  else
    return query
      select p.push_token
      from public.profiles p
      where p.role = 'operator'
      and p.push_token is not null;
  end if;
end;
$$ language plpgsql security definer;
