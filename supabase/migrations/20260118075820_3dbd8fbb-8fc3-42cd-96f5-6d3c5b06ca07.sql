-- Enable RLS on all tables that currently lack it

-- CONTACTS table - contains PII (names, phones, emails)
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view contacts"
  ON public.contacts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert contacts"
  ON public.contacts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update contacts"
  ON public.contacts FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Admins can delete contacts"
  ON public.contacts FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- AGENT_LOGS table - contains conversation data and phone numbers
ALTER TABLE public.agent_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and support can view agent logs"
  ON public.agent_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'support'));

CREATE POLICY "System can insert agent logs"
  ON public.agent_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- AGENT_SESSIONS table - contains session data with phone numbers
ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and support can view agent sessions"
  ON public.agent_sessions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'support'));

CREATE POLICY "System can manage agent sessions"
  ON public.agent_sessions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- AGENT_CONFIRMATIONS table
ALTER TABLE public.agent_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own confirmations"
  ON public.agent_confirmations FOR SELECT
  TO authenticated
  USING (actor_user_id = auth.uid());

CREATE POLICY "Users can insert own confirmations"
  ON public.agent_confirmations FOR INSERT
  TO authenticated
  WITH CHECK (actor_user_id = auth.uid());

CREATE POLICY "Users can delete own confirmations"
  ON public.agent_confirmations FOR DELETE
  TO authenticated
  USING (actor_user_id = auth.uid());

-- ACCOUNTS table - business accounts
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view accounts"
  ON public.accounts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert accounts"
  ON public.accounts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update accounts"
  ON public.accounts FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Admins can delete accounts"
  ON public.accounts FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- CUSTOMERS table
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view customers"
  ON public.customers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage customers"
  ON public.customers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- SUPPLIERS table
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view suppliers"
  ON public.suppliers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage suppliers"
  ON public.suppliers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- PROJECTS table
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view projects"
  ON public.projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage projects"
  ON public.projects FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ORDERS table
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage orders"
  ON public.orders FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ORDER_ITEMS table
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view order items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage order items"
  ON public.order_items FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- QUOTATIONS table
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view quotations"
  ON public.quotations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage quotations"
  ON public.quotations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- QUOTATION_ITEMS table
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view quotation items"
  ON public.quotation_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage quotation items"
  ON public.quotation_items FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- INVOICES table
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view invoices"
  ON public.invoices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage invoices"
  ON public.invoices FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- PAYMENTS table
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view payments"
  ON public.payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage payments"
  ON public.payments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- MATERIALS table
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view materials"
  ON public.materials FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage materials"
  ON public.materials FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- SUPPLIER_MATERIALS table
ALTER TABLE public.supplier_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view supplier materials"
  ON public.supplier_materials FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage supplier materials"
  ON public.supplier_materials FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- LOCATIONS table
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view locations"
  ON public.locations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage locations"
  ON public.locations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ZONES table
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view zones"
  ON public.zones FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage zones"
  ON public.zones FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- DRIVERS table
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view drivers"
  ON public.drivers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage drivers"
  ON public.drivers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- TRIPS table
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view trips"
  ON public.trips FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage trips"
  ON public.trips FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- TRIP_EVENTS table
ALTER TABLE public.trip_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view trip events"
  ON public.trip_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage trip events"
  ON public.trip_events FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- TASKS table
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tasks"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage tasks"
  ON public.tasks FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- COMMUNICATIONS table
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view communications"
  ON public.communications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage communications"
  ON public.communications FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- COMMUNICATION_ACTION_ITEMS table
ALTER TABLE public.communication_action_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view action items"
  ON public.communication_action_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage action items"
  ON public.communication_action_items FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ATTACHMENTS table
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view attachments"
  ON public.attachments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage attachments"
  ON public.attachments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ACTIVITY_LOG table
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view activity log"
  ON public.activity_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert activity log"
  ON public.activity_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- WHATSAPP tables - contain sensitive conversation data
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view whatsapp conversations"
  ON public.whatsapp_conversations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage whatsapp conversations"
  ON public.whatsapp_conversations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view whatsapp messages"
  ON public.whatsapp_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage whatsapp messages"
  ON public.whatsapp_messages FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.whatsapp_message_status_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view message status events"
  ON public.whatsapp_message_status_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage message status events"
  ON public.whatsapp_message_status_events FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and support can view webhook events"
  ON public.whatsapp_webhook_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'support'));

CREATE POLICY "System can manage webhook events"
  ON public.whatsapp_webhook_events FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);