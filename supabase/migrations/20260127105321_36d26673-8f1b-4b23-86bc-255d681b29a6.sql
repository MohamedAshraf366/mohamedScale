-- Add foreign key constraints for audit columns on opportunities
ALTER TABLE public.opportunities
  ADD CONSTRAINT opportunities_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT opportunities_updated_by_fkey 
    FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT opportunities_assigned_to_fkey 
    FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;