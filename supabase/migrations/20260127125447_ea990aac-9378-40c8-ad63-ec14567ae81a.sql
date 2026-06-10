-- Drop the existing check constraint
ALTER TABLE public.communications DROP CONSTRAINT IF EXISTS communications_channel_check;

-- Add new check constraint with site_visit included
ALTER TABLE public.communications ADD CONSTRAINT communications_channel_check 
CHECK (channel IN ('whatsapp', 'call', 'meeting', 'email', 'sms', 'in_person', 'site_visit', 'other'));