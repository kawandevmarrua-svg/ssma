-- FIX: supervisor não conseguia ver contratos (units) nas inspeções
-- A migration 20260602000000_create_units.sql esqueceu de incluir supervisor no SELECT

create policy "units_select_supervisor"
  on public.units for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'supervisor'
    )
  );
