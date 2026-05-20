-- Corrige pre_op_answers.question_id:
-- ON DELETE RESTRICT impedia excluir perguntas com respostas vinculadas.
-- Muda para ON DELETE SET NULL para permitir exclusao historica sem perder respostas.
-- Remove NOT NULL para aceitar o valor null apos o set null.

ALTER TABLE public.pre_op_answers
  ALTER COLUMN question_id DROP NOT NULL;

ALTER TABLE public.pre_op_answers
  DROP CONSTRAINT IF EXISTS pre_op_answers_question_id_fkey;

ALTER TABLE public.pre_op_answers
  ADD CONSTRAINT pre_op_answers_question_id_fkey
  FOREIGN KEY (question_id)
  REFERENCES public.pre_op_questions(id)
  ON DELETE SET NULL;
