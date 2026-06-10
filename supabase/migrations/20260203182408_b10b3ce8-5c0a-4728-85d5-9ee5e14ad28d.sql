-- Update trigger function to use 'poc' instead of 'site_contact_id'
CREATE OR REPLACE FUNCTION public.enforce_project_site_contact_same_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
declare c_account uuid;
begin
  if new.poc is null then
    return new;
  end if;

  select account_id into c_account
  from public.contacts
  where id = new.poc;

  if c_account is null then
    raise exception 'POC contact not found';
  end if;

  if c_account <> new.customer_account_id then
    raise exception 'Project POC must belong to the same customer account';
  end if;

  return new;
end;
$$;