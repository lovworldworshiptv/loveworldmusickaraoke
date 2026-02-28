-- Allow users to update their own subscription (for trial activation)
CREATE POLICY "Users can update own subscription"
ON public.user_subscriptions
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);