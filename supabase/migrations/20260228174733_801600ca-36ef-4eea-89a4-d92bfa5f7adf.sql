
-- Add subscription date fields to user_subscriptions
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS subscription_start_date timestamp with time zone,
  ADD COLUMN IF NOT EXISTS subscription_expiry_date timestamp with time zone,
  ADD COLUMN IF NOT EXISTS subscription_plan text DEFAULT 'none';

-- Create subscription_requests table for manual payment approvals
CREATE TABLE public.subscription_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  full_name text NOT NULL,
  kingschat_username text,
  plan text NOT NULL, -- '1_month', '6_months', '1_year', '3_day_trial'
  amount numeric NOT NULL DEFAULT 0,
  proof_url text,
  status text NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can submit subscription requests"
  ON public.subscription_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own requests"
  ON public.subscription_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage subscription requests"
  ON public.subscription_requests FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create gift_subscriptions table
CREATE TABLE public.gift_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  sender_full_name text NOT NULL,
  sender_kc_username text,
  plan text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  gift_message text,
  proof_url text,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.gift_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can submit gift subscriptions"
  ON public.gift_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can view own gift submissions"
  ON public.gift_subscriptions FOR SELECT
  USING (auth.uid() = sender_id);

CREATE POLICY "Admins can manage gift subscriptions"
  ON public.gift_subscriptions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Gift subscription recipients junction table
CREATE TABLE public.gift_subscription_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_id uuid NOT NULL REFERENCES public.gift_subscriptions(id) ON DELETE CASCADE,
  recipient_username text,
  recipient_email text,
  recipient_kc_handle text,
  recipient_user_id uuid
);

ALTER TABLE public.gift_subscription_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert gift recipients"
  ON public.gift_subscription_recipients FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.gift_subscriptions gs
    WHERE gs.id = gift_subscription_recipients.gift_id AND gs.sender_id = auth.uid()
  ));

CREATE POLICY "Users can view own gift recipients"
  ON public.gift_subscription_recipients FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.gift_subscriptions gs
    WHERE gs.id = gift_subscription_recipients.gift_id AND gs.sender_id = auth.uid()
  ));

CREATE POLICY "Admins can manage gift recipients"
  ON public.gift_subscription_recipients FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Storage bucket for payment proofs
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload payment proofs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own payment proofs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all payment proofs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'payment-proofs' AND has_role(auth.uid(), 'admin'::app_role));

-- Storage bucket for avatar uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Avatars are public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
