
-- Add church, zone, region columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS church text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS zone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS region text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_completed boolean NOT NULL DEFAULT false;
