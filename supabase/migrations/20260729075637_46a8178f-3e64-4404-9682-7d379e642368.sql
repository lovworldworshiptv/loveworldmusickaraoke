ALTER TABLE public.kingschat_auth_sessions
  ADD COLUMN IF NOT EXISTS redirect_path text NOT NULL DEFAULT '/',
  ADD COLUMN IF NOT EXISTS consumed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.kingschat_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  kingschat_user_id text,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.kingschat_oauth_tokens TO service_role;

ALTER TABLE public.kingschat_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages kingschat tokens"
  ON public.kingschat_oauth_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_kingschat_oauth_tokens_updated_at
  BEFORE UPDATE ON public.kingschat_oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();