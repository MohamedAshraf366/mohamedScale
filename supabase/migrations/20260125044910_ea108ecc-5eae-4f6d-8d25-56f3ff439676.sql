-- =============================================
-- WhatsApp BSP Tables for Coexistence Support
-- =============================================

-- Store onboarded WhatsApp Business Accounts (multi-tenant)
CREATE TABLE public.waba_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  waba_id text UNIQUE NOT NULL,
  business_id text NOT NULL,
  phone_number_id text,
  display_phone_number text,
  verified_name text,
  quality_rating text,
  access_token text, -- Consider using Vault for production
  token_expires_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  onboarded_by uuid REFERENCES auth.users(id),
  onboarded_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.waba_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for waba_accounts
CREATE POLICY "Authenticated users can view waba_accounts"
ON public.waba_accounts FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert waba_accounts"
ON public.waba_accounts FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update waba_accounts"
ON public.waba_accounts FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Admins can delete waba_accounts"
ON public.waba_accounts FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER set_waba_accounts_updated_at
  BEFORE UPDATE ON public.waba_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================
-- Message Templates Table
-- =============================================

CREATE TABLE public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  waba_id text NOT NULL REFERENCES public.waba_accounts(waba_id) ON DELETE CASCADE,
  template_id text, -- Meta's template ID after creation
  name text NOT NULL,
  language text NOT NULL,
  category text NOT NULL, -- MARKETING, UTILITY, AUTHENTICATION
  status text NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
  components jsonb NOT NULL DEFAULT '[]',
  rejection_reason text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(waba_id, name, language)
);

-- Enable RLS
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for message_templates
CREATE POLICY "Authenticated users can view message_templates"
ON public.message_templates FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert message_templates"
ON public.message_templates FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update message_templates"
ON public.message_templates FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Admins can delete message_templates"
ON public.message_templates FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER set_message_templates_updated_at
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================
-- Storage bucket for WhatsApp media
-- =============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload whatsapp media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'whatsapp-media');

CREATE POLICY "Authenticated users can view whatsapp media"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'whatsapp-media');

CREATE POLICY "Authenticated users can update whatsapp media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'whatsapp-media');

CREATE POLICY "Admins can delete whatsapp media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'whatsapp-media' AND public.has_role(auth.uid(), 'admin'));