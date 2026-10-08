CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, username, email, avatar_url)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)), NEW.email,
          NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  INSERT INTO public.user_subscriptions (user_id, subscription) VALUES (NEW.id, 'free');
  RETURN NEW;
END;
$function$;