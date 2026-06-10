INSERT INTO public.user_roles (user_id, role)
VALUES ('b67d288b-9d35-4dda-bd1b-801cf7429f05', 'management')
ON CONFLICT (user_id, role) DO NOTHING;