-- ============================================================
-- Operations Module — Full Migration
-- Scale ERP — mohamedAshraf366/mohamedScale
-- Additive only — no breaking changes to existing tables
-- ============================================================

-- ─────────────────────────────────────────────────
-- 1.  ADD COLUMNS TO orders (all nullable / defaulted)
-- ─────────────────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_contact_e164 text,
  ADD COLUMN IF NOT EXISTS customer_email         text,
  ADD COLUMN IF NOT EXISTS preferred_channel      text NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS current_stage          text,
  ADD COLUMN IF NOT EXISTS status_history         jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS cancelled_reason       text;

COMMENT ON COLUMN public.orders.customer_contact_e164 IS 'Snapshot E.164 phone for notifications (e.g. 966512345678)';
COMMENT ON COLUMN public.orders.preferred_channel      IS 'whatsapp | email | both | none';
COMMENT ON COLUMN public.orders.status_history         IS 'Append-only [{status,at,by}]';

-- ─────────────────────────────────────────────────
-- 2.  STATUS GUARD TRIGGER ON orders
-- ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_guard_order_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  allowed_next text[];
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  CASE OLD.status
    WHEN 'created'     THEN allowed_next := ARRAY['confirmed','cancelled'];
    WHEN 'confirmed'   THEN allowed_next := ARRAY['in_progress','cancelled'];
    WHEN 'in_progress' THEN allowed_next := ARRAY['delivered','cancelled'];
    WHEN 'delivered'   THEN allowed_next := ARRAY[]::text[];
    WHEN 'cancelled'   THEN allowed_next := ARRAY[]::text[];
    ELSE                    allowed_next := ARRAY[]::text[];
  END CASE;

  IF NOT (NEW.status = ANY(allowed_next)) THEN
    RAISE EXCEPTION 'Invalid status transition: % → %', OLD.status, NEW.status;
  END IF;

  -- Append to status_history
  NEW.status_history := COALESCE(OLD.status_history,'[]'::jsonb) || jsonb_build_object(
    'status', NEW.status,
    'at',     now(),
    'by',     auth.uid()
  );

  -- Write activity_log
  INSERT INTO public.activity_log(entity_type, entity_id, action, actor_id, old_data, new_data, summary)
  VALUES(
    'order', NEW.id, 'status_changed', auth.uid(),
    jsonb_build_object('status', OLD.status),
    jsonb_build_object('status', NEW.status),
    'Order status changed from ' || OLD.status || ' to ' || NEW.status
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_status_guard ON public.orders;
CREATE TRIGGER trg_order_status_guard
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_order_status();

-- ─────────────────────────────────────────────────
-- 3.  deliveries
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deliveries (
  id                 uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           uuid    NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  attempt_no         integer NOT NULL DEFAULT 1,
  status             text    NOT NULL DEFAULT 'pending',
    -- pending | scheduled | dispatched | out_for_delivery | delivered | failed | cancelled
  scheduled_at       timestamptz,
  dispatched_at      timestamptz,
  out_for_delivery_at timestamptz,
  delivered_at       timestamptz,
  failed_at          timestamptz,
  driver_id          uuid    REFERENCES public.drivers(id),
  vehicle_plate      text,
  pickup_location_id uuid    REFERENCES public.locations(id),
  dropoff_address    text,
  dropoff_lat        numeric,
  dropoff_lng        numeric,
  notes              text,
  signed_by          text,
  pod_attachment_id  uuid    REFERENCES public.attachments(id),
  failure_reason     text,
  next_retry_date    date,
  created_by         uuid    REFERENCES auth.users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  metadata           jsonb   NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_deliveries_order_id ON public.deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status   ON public.deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_scheduled ON public.deliveries(scheduled_at);

COMMENT ON TABLE public.deliveries IS 'One row per delivery attempt for an order';

-- ─────────────────────────────────────────────────
-- 4.  delivery_events
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.delivery_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  order_id    uuid NOT NULL REFERENCES public.orders(id),   -- denormalized
  event_type  text NOT NULL,
    -- created | scheduled | dispatched | out_for_delivery | arrived | delivered
    -- | failed | cancelled | rescheduled | note_added | pod_uploaded
  payload     jsonb NOT NULL DEFAULT '{}',
  actor_id    uuid  REFERENCES auth.users(id),
  actor_name  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_del_events_delivery ON public.delivery_events(delivery_id);
CREATE INDEX IF NOT EXISTS idx_del_events_order    ON public.delivery_events(order_id);

COMMENT ON TABLE public.delivery_events IS 'Append-only timeline of events per delivery attempt';

-- auto-stamp updated_at on deliveries
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_deliveries_updated_at ON public.deliveries;
CREATE TRIGGER trg_deliveries_updated_at
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ─────────────────────────────────────────────────
-- 5.  notification_templates
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key                 text NOT NULL,
    -- order.confirmed | order.in_progress | delivery.scheduled | delivery.dispatched
    -- | delivery.out_for_delivery | delivery.delivered | delivery.failed
    -- | order.cancelled | order.completed | payment.reminder
  channel                   text NOT NULL,  -- whatsapp | email
  language                  text NOT NULL DEFAULT 'ar',  -- ar | en
  subject                   text,           -- email only
  body_template             text NOT NULL,
  whatsapp_template_name    text,           -- pre-approved WABA template name
  whatsapp_template_language text DEFAULT 'ar',
  variables                 jsonb NOT NULL DEFAULT '[]',
    -- array of variable names: ["customer_name","order_code",...]
  status                    text NOT NULL DEFAULT 'active',  -- active | draft
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_key, channel, language)
);

DROP TRIGGER IF EXISTS trg_notif_templates_updated_at ON public.notification_templates;
CREATE TRIGGER trg_notif_templates_updated_at
  BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ─────────────────────────────────────────────────
-- 6.  notification_logs
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid REFERENCES public.orders(id),
  delivery_id         uuid REFERENCES public.deliveries(id),
  event_key           text NOT NULL,
  channel             text NOT NULL,  -- whatsapp | email
  recipient           text NOT NULL,  -- E.164 phone or email
  template_id         uuid REFERENCES public.notification_templates(id),
  rendered_body       text,
  status              text NOT NULL DEFAULT 'queued',
    -- queued | sent | delivered | failed | skipped
  provider_message_id text,
  error               text,
  attempts            integer NOT NULL DEFAULT 0,
  next_retry_at       timestamptz,
  payload             jsonb NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_logs_status    ON public.notification_logs(status) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_notif_logs_order     ON public.notification_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_notif_logs_delivery  ON public.notification_logs(delivery_id);

DROP TRIGGER IF EXISTS trg_notif_logs_updated_at ON public.notification_logs;
CREATE TRIGGER trg_notif_logs_updated_at
  BEFORE UPDATE ON public.notification_logs
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ─────────────────────────────────────────────────
-- 7.  order_tracking_tokens
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_tracking_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  token      text NOT NULL UNIQUE,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tracking_token ON public.order_tracking_tokens(token);

-- ─────────────────────────────────────────────────
-- 8.  RLS
-- ─────────────────────────────────────────────────
ALTER TABLE public.deliveries            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_tracking_tokens ENABLE ROW LEVEL SECURITY;

-- deliveries
CREATE POLICY "auth_select_deliveries" ON public.deliveries FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_deliveries" ON public.deliveries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_deliveries" ON public.deliveries FOR UPDATE TO authenticated USING (true);

-- delivery_events (append-only; no DELETE for regular users)
CREATE POLICY "auth_select_del_events" ON public.delivery_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_del_events" ON public.delivery_events FOR INSERT TO authenticated WITH CHECK (true);

-- notification_templates
CREATE POLICY "auth_select_notif_tpls" ON public.notification_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_modify_notif_tpls" ON public.notification_templates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin')));

-- notification_logs
CREATE POLICY "auth_select_notif_logs" ON public.notification_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_notif_logs" ON public.notification_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_notif_logs" ON public.notification_logs FOR UPDATE TO authenticated USING (true);

-- order_tracking_tokens (no anon access — public edge fn handles public lookup)
CREATE POLICY "auth_select_tokens" ON public.order_tracking_tokens FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_tokens" ON public.order_tracking_tokens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_tokens" ON public.order_tracking_tokens FOR UPDATE TO authenticated USING (true);

-- ─────────────────────────────────────────────────
-- 9.  RPCs
-- ─────────────────────────────────────────────────

-- 9.1  update_order_status
CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id   uuid,
  p_new_status text,
  p_reason     text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_order public.orders;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF p_new_status = 'cancelled' AND p_reason IS NULL THEN
    RAISE EXCEPTION 'Cancellation requires a reason';
  END IF;

  UPDATE public.orders
    SET status           = p_new_status,
        cancelled_reason = CASE WHEN p_new_status = 'cancelled' THEN p_reason ELSE cancelled_reason END,
        updated_at       = now()
  WHERE id = p_order_id;

  -- Queue notification
  INSERT INTO public.notification_logs(order_id, event_key, channel, recipient, status)
  SELECT p_order_id,
         'order.' || p_new_status,
         COALESCE(v_order.preferred_channel, 'whatsapp'),
         COALESCE(v_order.customer_contact_e164, v_order.customer_email, ''),
         'queued'
  WHERE COALESCE(v_order.customer_contact_e164, v_order.customer_email, '') <> '';

  RETURN jsonb_build_object('ok', true, 'status', p_new_status);
END;
$$;

-- 9.2  create_delivery
CREATE OR REPLACE FUNCTION public.create_delivery(
  p_order_id     uuid,
  p_scheduled_at timestamptz,
  p_driver_id    uuid DEFAULT NULL,
  p_dropoff      text DEFAULT NULL,
  p_notes        text DEFAULT NULL,
  p_vehicle_plate text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_attempt  integer;
  v_delivery_id uuid;
  v_order    public.orders;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  SELECT COALESCE(MAX(attempt_no), 0) + 1 INTO v_attempt
  FROM public.deliveries WHERE order_id = p_order_id;

  INSERT INTO public.deliveries(order_id, attempt_no, status, scheduled_at, driver_id, dropoff_address, notes, vehicle_plate, created_by)
  VALUES(p_order_id, v_attempt, 'scheduled', p_scheduled_at, p_driver_id, p_dropoff, p_notes, p_vehicle_plate, auth.uid())
  RETURNING id INTO v_delivery_id;

  -- Event
  INSERT INTO public.delivery_events(delivery_id, order_id, event_type, payload, actor_id)
  VALUES(v_delivery_id, p_order_id, 'scheduled',
    jsonb_build_object('scheduled_at', p_scheduled_at, 'attempt_no', v_attempt),
    auth.uid());

  -- Queue notification
  INSERT INTO public.notification_logs(order_id, delivery_id, event_key, channel, recipient, status)
  SELECT p_order_id, v_delivery_id, 'delivery.scheduled',
         COALESCE(v_order.preferred_channel,'whatsapp'),
         COALESCE(v_order.customer_contact_e164,''),
         'queued'
  WHERE COALESCE(v_order.customer_contact_e164,'') <> '';

  RETURN jsonb_build_object('ok', true, 'delivery_id', v_delivery_id, 'attempt_no', v_attempt);
END;
$$;

-- 9.3  update_delivery_status
CREATE OR REPLACE FUNCTION public.update_delivery_status(
  p_delivery_id uuid,
  p_new_status  text,
  p_notes       text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_d     public.deliveries;
  v_order public.orders;
  v_ts_col text;
BEGIN
  SELECT * INTO v_d FROM public.deliveries WHERE id = p_delivery_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Delivery not found'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = v_d.order_id;

  -- Timestamp mapping
  v_ts_col := CASE p_new_status
    WHEN 'dispatched'        THEN 'dispatched_at'
    WHEN 'out_for_delivery'  THEN 'out_for_delivery_at'
    WHEN 'delivered'         THEN 'delivered_at'
    WHEN 'failed'            THEN 'failed_at'
    ELSE NULL END;

  UPDATE public.deliveries
    SET status          = p_new_status,
        notes           = COALESCE(p_notes, notes),
        dispatched_at       = CASE WHEN p_new_status = 'dispatched'       THEN now() ELSE dispatched_at END,
        out_for_delivery_at = CASE WHEN p_new_status = 'out_for_delivery' THEN now() ELSE out_for_delivery_at END,
        delivered_at        = CASE WHEN p_new_status = 'delivered'        THEN now() ELSE delivered_at END,
        failed_at           = CASE WHEN p_new_status = 'failed'           THEN now() ELSE failed_at END,
        updated_at      = now()
  WHERE id = p_delivery_id;

  -- Append delivery event
  INSERT INTO public.delivery_events(delivery_id, order_id, event_type, payload, actor_id, actor_name)
  VALUES(p_delivery_id, v_d.order_id, p_new_status,
    jsonb_build_object('notes', p_notes),
    auth.uid(),
    (SELECT display_name FROM public.profiles WHERE id = auth.uid()));

  -- If delivered → try to advance order to in_progress / delivered
  IF p_new_status = 'delivered' THEN
    IF v_order.status = 'confirmed' THEN
      UPDATE public.orders SET status = 'in_progress', updated_at = now() WHERE id = v_d.order_id;
    END IF;
    -- Check if all deliveries are done → mark order delivered
    IF NOT EXISTS(
      SELECT 1 FROM public.deliveries
      WHERE order_id = v_d.order_id AND status NOT IN ('delivered','cancelled')
    ) THEN
      UPDATE public.orders SET status = 'delivered', updated_at = now() WHERE id = v_d.order_id;
    END IF;
  END IF;

  -- Queue notification
  INSERT INTO public.notification_logs(order_id, delivery_id, event_key, channel, recipient, status)
  SELECT v_d.order_id, p_delivery_id, 'delivery.' || p_new_status,
         COALESCE(v_order.preferred_channel,'whatsapp'),
         COALESCE(v_order.customer_contact_e164,''),
         'queued'
  WHERE COALESCE(v_order.customer_contact_e164,'') <> ''
    AND p_new_status IN ('dispatched','out_for_delivery','delivered','failed');

  RETURN jsonb_build_object('ok', true, 'delivery_id', p_delivery_id, 'status', p_new_status);
END;
$$;

-- 9.4  attach_pod
CREATE OR REPLACE FUNCTION public.attach_pod(
  p_delivery_id    uuid,
  p_attachment_id  uuid,
  p_signed_by      text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_d public.deliveries; BEGIN
  SELECT * INTO v_d FROM public.deliveries WHERE id = p_delivery_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Delivery not found'; END IF;

  UPDATE public.deliveries
    SET pod_attachment_id = p_attachment_id,
        signed_by         = COALESCE(p_signed_by, signed_by),
        updated_at        = now()
  WHERE id = p_delivery_id;

  INSERT INTO public.delivery_events(delivery_id, order_id, event_type, payload, actor_id)
  VALUES(p_delivery_id, v_d.order_id, 'pod_uploaded',
    jsonb_build_object('attachment_id', p_attachment_id, 'signed_by', p_signed_by),
    auth.uid());

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 9.5  issue_tracking_token
CREATE OR REPLACE FUNCTION public.issue_tracking_token(
  p_order_id uuid,
  p_ttl_days integer DEFAULT 30
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_token text;
  v_expires timestamptz;
BEGIN
  v_token   := encode(gen_random_bytes(24), 'base64');
  v_token   := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');
  v_expires := now() + (p_ttl_days || ' days')::interval;

  INSERT INTO public.order_tracking_tokens(order_id, token, expires_at)
  VALUES(p_order_id, v_token, v_expires)
  ON CONFLICT (order_id) DO UPDATE
    SET token = EXCLUDED.token, expires_at = EXCLUDED.expires_at, revoked_at = NULL;

  RETURN jsonb_build_object('token', v_token, 'expires_at', v_expires);
END;
$$;

-- 9.6  get_public_order_tracking (no auth — called by public edge fn)
CREATE OR REPLACE FUNCTION public.get_public_order_tracking(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rec record;
  v_last_event record;
BEGIN
  SELECT o.code, o.status, o.current_stage,
         a.display_name AS customer_name,
         t.expires_at, t.revoked_at, t.order_id
  INTO v_rec
  FROM public.order_tracking_tokens t
  JOIN public.orders   o ON o.id = t.order_id
  JOIN public.accounts a ON a.id = o.customer_account_id
  WHERE t.token = p_token
    AND (t.expires_at IS NULL OR t.expires_at > now())
    AND t.revoked_at IS NULL;

  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Token not found or expired'); END IF;

  -- Latest delivery event
  SELECT de.event_type, de.created_at, de.payload
  INTO v_last_event
  FROM public.delivery_events de
  JOIN public.deliveries d ON d.id = de.delivery_id
  WHERE d.order_id = v_rec.order_id
  ORDER BY de.created_at DESC LIMIT 1;

  RETURN jsonb_build_object(
    'order_code',    v_rec.code,
    'status',        v_rec.status,
    'current_stage', v_rec.current_stage,
    'last_event',    CASE WHEN v_last_event IS NULL THEN NULL
                          ELSE jsonb_build_object('type', v_last_event.event_type, 'at', v_last_event.created_at) END
  );
END;
$$;

-- 9.7  backfill orders customer_contact_e164 from poc_contact
UPDATE public.orders o
SET customer_contact_e164 = c.phone,
    customer_email        = c.email
FROM public.accounts a
JOIN public.contacts c ON c.id = a.poc_contact_id
WHERE a.id = o.customer_account_id
  AND o.customer_contact_e164 IS NULL;

-- 9.8  Seed notification_templates (idempotent)
INSERT INTO public.notification_templates(event_key, channel, language, subject, body_template, variables, status)
VALUES
  -- Arabic WhatsApp
  ('order.confirmed',           'whatsapp','ar', NULL, 'مرحباً {{customer_name}}، تم تأكيد طلبكم رقم {{order_code}} بقيمة {{order_total_incl_vat}} {{currency}}. يمكنكم متابعة حالة الطلب: {{tracking_url}}', '["customer_name","order_code","order_total_incl_vat","currency","tracking_url"]', 'active'),
  ('order.in_progress',         'whatsapp','ar', NULL, 'طلبكم رقم {{order_code}} قيد التجهيز. سنُبلغكم فور جدولة موعد التسليم.', '["order_code"]', 'active'),
  ('delivery.scheduled',        'whatsapp','ar', NULL, 'تم جدولة تسليم طلبكم رقم {{order_code}} بتاريخ {{scheduled_at}}. رابط التتبع: {{tracking_url}}', '["order_code","scheduled_at","tracking_url"]', 'active'),
  ('delivery.dispatched',       'whatsapp','ar', NULL, 'السائق {{driver_name}} في طريقه لتسليم طلبكم رقم {{order_code}}. رقم السيارة: {{vehicle_plate}}.', '["order_code","driver_name","vehicle_plate"]', 'active'),
  ('delivery.out_for_delivery', 'whatsapp','ar', NULL, 'طلبكم رقم {{order_code}} خرج للتسليم. متوقع الوصول خلال {{eta_window}}.', '["order_code","eta_window"]', 'active'),
  ('delivery.delivered',        'whatsapp','ar', NULL, 'تم تسليم طلبكم رقم {{order_code}} بنجاح. شكراً لثقتكم بـ Scale. {{pod_url}}', '["order_code","pod_url"]', 'active'),
  ('delivery.failed',           'whatsapp','ar', NULL, 'عذراً، لم يتم التسليم اليوم للطلب رقم {{order_code}}. سيتواصل معكم فريقنا لإعادة الجدولة.', '["order_code"]', 'active'),
  ('order.cancelled',           'whatsapp','ar', NULL, 'تم إلغاء طلبكم رقم {{order_code}}. السبب: {{cancellation_reason}}.', '["order_code","cancellation_reason"]', 'active'),
  ('order.completed',           'whatsapp','ar', NULL, 'اكتمل طلبكم رقم {{order_code}} بالكامل. شكراً لتعاملكم مع Scale.', '["order_code"]', 'active'),
  -- Arabic Email
  ('order.confirmed',           'email','ar', 'تأكيد طلب Scale — {{order_code}}', 'مرحباً {{customer_name}}،\n\nتم تأكيد طلبكم رقم {{order_code}} بقيمة {{order_total_incl_vat}} {{currency}}.\n\nرابط تتبع الطلب: {{tracking_url}}\n\nمع التقدير،\nفريق Scale', '["customer_name","order_code","order_total_incl_vat","currency","tracking_url"]', 'active'),
  ('delivery.delivered',        'email','ar', 'تم التسليم — {{order_code}}', 'مرحباً {{customer_name}}،\n\nتم تسليم طلبكم رقم {{order_code}} بنجاح.\n\nيمكنكم مراجعة إيصال التسليم هنا: {{pod_url}}\n\nمع التقدير،\nفريق Scale', '["customer_name","order_code","pod_url"]', 'active'),
  ('order.cancelled',           'email','ar', 'إلغاء الطلب — {{order_code}}', 'مرحباً {{customer_name}}،\n\nنأسف لإعلامكم بأنه تم إلغاء طلبكم رقم {{order_code}}.\nالسبب: {{cancellation_reason}}\n\nمع التقدير،\nفريق Scale', '["customer_name","order_code","cancellation_reason"]', 'active'),
  ('order.completed',           'email','ar', 'اكتمال الطلب — {{order_code}}', 'مرحباً {{customer_name}}،\n\nاكتمل طلبكم رقم {{order_code}} بالكامل. نشكركم على ثقتكم.\n\nمع التقدير،\nفريق Scale', '["customer_name","order_code"]', 'active')
ON CONFLICT (event_key, channel, language) DO NOTHING;
