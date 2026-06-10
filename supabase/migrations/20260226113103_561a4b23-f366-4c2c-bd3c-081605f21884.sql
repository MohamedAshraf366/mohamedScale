CREATE UNIQUE INDEX idx_contacts_phone_unique 
  ON public.contacts (phone) 
  WHERE phone IS NOT NULL AND phone != '';