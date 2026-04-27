-- ============================================================
-- FIX: Permitir operadores criarem checklists e checklist_items
-- Problema: a policy INSERT original so permitia o gestor (created_by)
-- Faltava policy INSERT para operadores (auth_user_id)
-- ============================================================

-- 1. Operador pode CRIAR checklists para si mesmo
DROP POLICY IF EXISTS "Operators can create own checklists" ON public.checklists;
CREATE POLICY "Operators can create own checklists"
  ON public.checklists FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.operators
      WHERE operators.id = checklists.operator_id
      AND operators.auth_user_id = auth.uid()
    )
  );

-- 2. Operador pode CRIAR itens nos seus checklists
DROP POLICY IF EXISTS "Operators can create own checklist items" ON public.checklist_items;
CREATE POLICY "Operators can create own checklist items"
  ON public.checklist_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.checklists
      JOIN public.operators ON operators.id = checklists.operator_id
      WHERE checklists.id = checklist_items.checklist_id
      AND operators.auth_user_id = auth.uid()
    )
  );
