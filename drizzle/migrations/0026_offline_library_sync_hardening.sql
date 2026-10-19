ALTER TABLE public.downloads
  ADD COLUMN IF NOT EXISTS quality text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'song',
  ADD COLUMN IF NOT EXISTS size_bytes bigint,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.downloads ADD CONSTRAINT downloads_quality_check CHECK (quality IN ('standard','high'));
ALTER TABLE public.downloads ADD CONSTRAINT downloads_media_type_check CHECK (media_type IN ('song','video','lyrics'));
CREATE UNIQUE INDEX IF NOT EXISTS downloads_user_song_quality_uidx ON public.downloads (user_id, song_id, quality);
COMMENT ON COLUMN public.downloads.deleted_at IS 'Soft delete: set when removed so the removal syncs to every device.';

GRANT UPDATE ON public.downloads TO authenticated;
CREATE POLICY "Users can update own downloads" ON public.downloads
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'downloads') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.downloads;
  END IF;
END $$;

-- One row per playback-permission request, for the per-user hourly limit. Backend-only.
CREATE TABLE public.offline_licence_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX offline_licence_requests_user_idx ON public.offline_licence_requests (user_id, created_at DESC);
GRANT ALL ON public.offline_licence_requests TO service_role;
ALTER TABLE public.offline_licence_requests ENABLE ROW LEVEL SECURITY;

-- Master-key version used to wrap each content key (supports key rotation).
ALTER TABLE public.offline_package_keys ADD COLUMN IF NOT EXISTS key_version integer NOT NULL DEFAULT 1;