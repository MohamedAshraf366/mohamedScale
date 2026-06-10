
-- Phase 1a: extend universal activity-log trigger to gap tables
-- record_activity() and the trigger pattern already exist; we just attach.

CREATE TRIGGER trg_activity_log
AFTER INSERT OR UPDATE OR DELETE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.record_activity();

CREATE TRIGGER trg_activity_log
AFTER INSERT OR UPDATE OR DELETE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.record_activity();

CREATE TRIGGER trg_activity_log
AFTER INSERT OR UPDATE OR DELETE ON public.kpi_targets
FOR EACH ROW EXECUTE FUNCTION public.record_activity();

CREATE TRIGGER trg_activity_log
AFTER INSERT OR UPDATE OR DELETE ON public.agent_actions
FOR EACH ROW EXECUTE FUNCTION public.record_activity();

CREATE TRIGGER trg_activity_log
AFTER INSERT OR UPDATE OR DELETE ON public.agent_table_schema
FOR EACH ROW EXECUTE FUNCTION public.record_activity();
