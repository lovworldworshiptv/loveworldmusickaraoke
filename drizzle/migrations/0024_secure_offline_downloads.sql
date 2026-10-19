-- Devices allowed to hold encrypted offline downloads (max 5 active per user, enforced in the backend function).
CREATE TABLE public.offline_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text NOT NULL DEFAULT 'This device',
  user_agent text,
  public_key_jwk jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX offline_devices_user_idx ON public.offline_devices (user_id) WHERE revoked_at IS NULL;
GRANT SELECT ON public.offline_devices TO authenticated;
GRANT ALL ON public.offline_devices TO service_role;
ALTER TABLE public.offline_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view their own offline devices" ON public.offline_devices
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Encrypted media packages, one per exact media version (source) and language.
CREATE TABLE public.offline_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('audio','instrumental','video')),
  language_code text NOT NULL DEFAULT '',
  source_hash text NOT NULL,
  mime_type text,
  chunk_size integer NOT NULL DEFAULT 1048576,
  chunk_count integer,
  byte_length bigint,
  status text NOT NULL DEFAULT 'preparing' CHECK (status IN ('preparing','ready','failed')),
  error text,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (song_id, kind, language_code, source_hash)
);
GRANT SELECT ON public.offline_packages TO authenticated;
GRANT ALL ON public.offline_packages TO service_role;
ALTER TABLE public.offline_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users view package metadata" ON public.offline_packages
  FOR SELECT TO authenticated USING (true);
CREATE TRIGGER offline_packages_updated_at BEFORE UPDATE ON public.offline_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Content keys, wrapped with the server master key. Backend-only: no client grants, no policies.
CREATE TABLE public.offline_package_keys (
  package_id uuid PRIMARY KEY REFERENCES public.offline_packages(id) ON DELETE CASCADE,
  wrapped_key text NOT NULL,
  iv text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.offline_package_keys TO service_role;
ALTER TABLE public.offline_package_keys ENABLE ROW LEVEL SECURITY;

-- Device-bound playback licences (audit + rate limiting + revocation).
CREATE TABLE public.offline_licences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_id uuid NOT NULL REFERENCES public.offline_devices(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.offline_packages(id) ON DELETE CASCADE,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX offline_licences_user_issued_idx ON public.offline_licences (user_id, issued_at DESC);
GRANT SELECT ON public.offline_licences TO authenticated;
GRANT ALL ON public.offline_licences TO service_role;
ALTER TABLE public.offline_licences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view their own offline licences" ON public.offline_licences
  FOR SELECT TO authenticated USING (user_id = auth.uid());