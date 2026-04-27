-- ============================================================
-- CLEANUP: Apaga atividades que foram criadas automaticamente
-- pelo fluxo de checklist (agora que checklist e atividade
-- sao independentes, essas atividades "orfas" nao devem mais
-- aparecer na tela de Atividades).
-- ============================================================

delete from public.activities
where checklist_id is not null;
