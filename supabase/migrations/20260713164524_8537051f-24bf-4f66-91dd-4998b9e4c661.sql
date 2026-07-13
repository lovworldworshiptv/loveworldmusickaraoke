CREATE TABLE IF NOT EXISTS public.kingschat_auth_sessions (
  nonce TEXT PRIMARY KEY,
  session_data JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes')
);
GRANT ALL ON public.kingschat_auth_sessions TO service_role;
ALTER TABLE public.kingschat_auth_sessions ENABLE ROW LEVEL SECURITY;