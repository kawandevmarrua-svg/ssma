-- ===========================================
-- MIGRATION V2: Autenticacao de Operadores
-- ===========================================
-- Execute este SQL no SQL Editor do Supabase APOS o schema v1

-- 1. Permitir role 'operator' em profiles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'manager', 'operator'));

-- 2. Adicionar auth_user_id na tabela operators
ALTER TABLE public.operators ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) UNIQUE;
CREATE INDEX IF NOT EXISTS idx_operators_auth_user_id ON public.operators(auth_user_id);

-- 3. Adicionar campos de resposta em safety_alerts
ALTER TABLE public.safety_alerts ADD COLUMN IF NOT EXISTS response text;
ALTER TABLE public.safety_alerts ADD COLUMN IF NOT EXISTS responded_at timestamptz;

-- 4. Adicionar push_token em profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_token text;

-- 5. Atualizar trigger para ler role do metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'role', 'manager')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- RLS POLICIES para Operadores
-- ===========================================

-- Operadores podem ver seus proprios checklists
CREATE POLICY "Operators can view own checklists"
  ON public.checklists FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.operators
      WHERE operators.id = checklists.operator_id
      AND operators.auth_user_id = auth.uid()
    )
  );

-- Operadores podem atualizar seus proprios checklists
CREATE POLICY "Operators can update own checklists"
  ON public.checklists FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.operators
      WHERE operators.id = checklists.operator_id
      AND operators.auth_user_id = auth.uid()
    )
  );

-- Operadores podem ver items dos seus checklists
CREATE POLICY "Operators can view own checklist items"
  ON public.checklist_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.checklists
      JOIN public.operators ON operators.id = checklists.operator_id
      WHERE checklists.id = checklist_items.checklist_id
      AND operators.auth_user_id = auth.uid()
    )
  );

-- Operadores podem atualizar items dos seus checklists
CREATE POLICY "Operators can update own checklist items"
  ON public.checklist_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.checklists
      JOIN public.operators ON operators.id = checklists.operator_id
      WHERE checklists.id = checklist_items.checklist_id
      AND operators.auth_user_id = auth.uid()
    )
  );

-- Operadores podem ver alertas direcionados a eles
CREATE POLICY "Operators can view own alerts"
  ON public.safety_alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.operators
      WHERE operators.id = safety_alerts.operator_id
      AND operators.auth_user_id = auth.uid()
    )
  );

-- Operadores podem ver alertas enviados para todos (operator_id IS NULL)
CREATE POLICY "Operators can view broadcast alerts"
  ON public.safety_alerts FOR SELECT
  USING (
    operator_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.operators
      WHERE operators.auth_user_id = auth.uid()
    )
  );

-- Operadores podem responder alertas direcionados a eles
CREATE POLICY "Operators can respond to own alerts"
  ON public.safety_alerts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.operators
      WHERE operators.id = safety_alerts.operator_id
      AND operators.auth_user_id = auth.uid()
    )
  );

-- Operadores podem responder alertas broadcast
CREATE POLICY "Operators can respond to broadcast alerts"
  ON public.safety_alerts FOR UPDATE
  USING (
    operator_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.operators
      WHERE operators.auth_user_id = auth.uid()
    )
  );

-- Operadores podem ver seu proprio registro
CREATE POLICY "Operators can view own record"
  ON public.operators FOR SELECT
  USING (auth_user_id = auth.uid());

-- Operadores podem fazer upload de fotos
CREATE POLICY "Operators can upload checklist photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'checklist-photos'
    AND auth.role() = 'authenticated'
  );
