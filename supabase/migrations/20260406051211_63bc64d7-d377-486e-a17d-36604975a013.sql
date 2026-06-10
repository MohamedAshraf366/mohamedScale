ALTER TABLE public.tasks
ADD COLUMN supplier_account_id uuid REFERENCES public.suppliers(account_id) ON DELETE CASCADE;

CREATE INDEX idx_tasks_supplier_account_id ON public.tasks(supplier_account_id) WHERE supplier_account_id IS NOT NULL;