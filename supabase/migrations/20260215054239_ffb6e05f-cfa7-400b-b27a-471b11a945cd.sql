
-- Fix: WhatsApp API tokens exposed to all authenticated users
-- Replace the broad SELECT policy with admin-only access to the full table
-- Create a safe view without access_token for regular users

-- Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view waba_accounts" ON public.waba_accounts;

-- Admin-only access to the full table (including access_token)
CREATE POLICY "Admins can view full waba_accounts"
  ON public.waba_accounts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'management'));

-- Create a secure view without the access_token for regular users
CREATE OR REPLACE VIEW public.waba_accounts_safe AS
  SELECT id, waba_id, business_id, phone_number_id,
         display_phone_number, verified_name, quality_rating,
         status, onboarded_at, onboarded_by, token_expires_at,
         created_at, updated_at
  FROM public.waba_accounts;

-- Grant access to the view for authenticated users
GRANT SELECT ON public.waba_accounts_safe TO authenticated;
