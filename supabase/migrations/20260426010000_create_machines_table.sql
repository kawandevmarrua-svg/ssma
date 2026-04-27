-- ============================================================
-- SPEC: 20260426010000_create_machines_table.sql
-- Cadastro de maquinas/equipamentos do site de seguranca
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tag text,
  max_load_capacity text,
  serial_number text,
  notes text,
  qr_code text UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_machines_created_by ON public.machines(created_by);
CREATE INDEX IF NOT EXISTS idx_machines_active ON public.machines(active);
CREATE INDEX IF NOT EXISTS idx_machines_qr_code ON public.machines(qr_code);

CREATE OR REPLACE FUNCTION public.generate_machine_qr_code()
RETURNS trigger AS $$
DECLARE
  candidate text;
  exists_count int;
BEGIN
  IF NEW.qr_code IS NOT NULL AND NEW.qr_code <> '' THEN
    RETURN NEW;
  END IF;

  LOOP
    candidate := 'MAQ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    SELECT count(*) INTO exists_count FROM public.machines WHERE qr_code = candidate;
    EXIT WHEN exists_count = 0;
  END LOOP;

  NEW.qr_code := candidate;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_machines_generate_qr ON public.machines;
CREATE TRIGGER trg_machines_generate_qr
  BEFORE INSERT ON public.machines
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_machine_qr_code();

COMMENT ON TABLE public.machines IS 'Maquinas/equipamentos cadastrados pelo site de seguranca';

ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "machines_select_own"
  ON public.machines FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "machines_insert_own"
  ON public.machines FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "machines_update_own"
  ON public.machines FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "machines_delete_own"
  ON public.machines FOR DELETE
  USING (auth.uid() = created_by);

CREATE OR REPLACE FUNCTION public.set_machines_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_machines_updated_at ON public.machines;
CREATE TRIGGER trg_machines_updated_at
  BEFORE UPDATE ON public.machines
  FOR EACH ROW
  EXECUTE FUNCTION public.set_machines_updated_at();
