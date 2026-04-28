-- ============================================================
-- Desabilita a criacao automatica de safety_alerts.
-- A partir desta migracao, alertas devem ser criados apenas
-- manualmente pelo painel web (gestor/admin).
--
-- O trigger trg_dispatch_push em safety_alerts e MANTIDO para que
-- alertas criados via web continuem disparando push notification.
-- ============================================================

drop trigger if exists trg_blocking_nc on checklist_responses;
drop function if exists public.notify_blocking_nc();

drop trigger if exists trg_critical_pre_operation on pre_operation_checks;
drop function if exists public.notify_critical_pre_operation();

drop trigger if exists trg_behavioral_inspection on behavioral_inspections;
drop function if exists public.notify_behavioral_inspection();

drop trigger if exists trg_critical_deviation on behavioral_deviations;
drop function if exists public.notify_critical_deviation();
