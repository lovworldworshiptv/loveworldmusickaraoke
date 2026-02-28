
-- Convert 'free' roles to 'user' and delete 'premium' roles
UPDATE public.user_roles SET role = 'user'::app_role WHERE role = 'free'::app_role;
DELETE FROM public.user_roles WHERE role = 'premium'::app_role;

-- Update handle_new_user to assign 'user' role + 'free' subscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  INSERT INTO public.user_subscriptions (user_id, subscription) VALUES (NEW.id, 'free');
  RETURN NEW;
END;
$$;
