-- Add 'trial' to subscription_type enum
ALTER TYPE public.subscription_type ADD VALUE IF NOT EXISTS 'trial';