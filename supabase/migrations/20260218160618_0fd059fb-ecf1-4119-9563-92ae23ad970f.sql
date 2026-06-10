-- Clean all business/sample data, preserve schema + materials catalog

-- Truncate in dependency-safe order using CASCADE
TRUNCATE TABLE public.payments CASCADE;
TRUNCATE TABLE public.invoices CASCADE;
TRUNCATE TABLE public.order_items CASCADE;
TRUNCATE TABLE public.orders CASCADE;
TRUNCATE TABLE public.quotation_items CASCADE;
TRUNCATE TABLE public.quotations CASCADE;
TRUNCATE TABLE public.communication_action_items CASCADE;
TRUNCATE TABLE public.communications CASCADE;
TRUNCATE TABLE public.opportunities CASCADE;
TRUNCATE TABLE public.projects CASCADE;
TRUNCATE TABLE public.delivery_rates CASCADE;
TRUNCATE TABLE public.supplier_materials CASCADE;
TRUNCATE TABLE public.suppliers CASCADE;
TRUNCATE TABLE public.customers CASCADE;
TRUNCATE TABLE public.contacts CASCADE;
TRUNCATE TABLE public.accounts CASCADE;
TRUNCATE TABLE public.activity_log CASCADE;
TRUNCATE TABLE public.attachments CASCADE;
TRUNCATE TABLE public.agent_sessions CASCADE;
TRUNCATE TABLE public.agent_logs CASCADE;
TRUNCATE TABLE public.agent_confirmations CASCADE;