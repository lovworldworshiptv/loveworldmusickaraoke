
-- 1. Create subscription_type enum
CREATE TYPE public.subscription_type AS ENUM ('free', 'premium');

-- 2. Create user_subscriptions table
CREATE TABLE public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  subscription subscription_type NOT NULL DEFAULT 'free',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON public.user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage subscriptions"
  ON public.user_subscriptions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Migrate premium roles -> premium subscriptions
INSERT INTO public.user_subscriptions (user_id, subscription)
SELECT user_id, 'premium'::subscription_type
FROM public.user_roles WHERE role = 'premium'::app_role
ON CONFLICT (user_id) DO UPDATE SET subscription = 'premium'::subscription_type;

-- All other users get free subscription
INSERT INTO public.user_subscriptions (user_id, subscription)
SELECT user_id, 'free'::subscription_type
FROM public.user_roles WHERE role != 'premium'::app_role
  AND user_id NOT IN (SELECT user_id FROM public.user_subscriptions)
ON CONFLICT (user_id) DO NOTHING;

-- 4. Add 'user' to app_role enum (will be used in next migration)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'user';
