GRANT ALL ON public.kingschat_auth_sessions TO service_role;
GRANT SELECT ON public.kingschat_auth_sessions TO anon, authenticated;
ALTER TABLE public.kingschat_auth_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role manages kc sessions" ON public.kingschat_auth_sessions;
CREATE POLICY "Service role manages kc sessions" ON public.kingschat_auth_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can read kc session by nonce" ON public.kingschat_auth_sessions;
CREATE POLICY "Anyone can read kc session by nonce" ON public.kingschat_auth_sessions FOR SELECT TO anon, authenticated USING (true);