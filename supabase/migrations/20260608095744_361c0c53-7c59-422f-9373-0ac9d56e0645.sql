ALTER TABLE public.challenge_entries
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS kingschat_username TEXT;