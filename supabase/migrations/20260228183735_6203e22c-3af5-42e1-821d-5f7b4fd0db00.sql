-- Remove the overly permissive user update policy
DROP POLICY IF EXISTS "Users can update own subscription" ON public.user_subscriptions;