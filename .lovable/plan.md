# Phase 4 — Stem Automation

Goal: every song automatically gets a karaoke instrumental (and a vocals-only track) without admins clicking one song at a time.

## What listeners get
- Karaoke mode becomes available on more songs as instrumentals are produced automatically.
- No change to how the player looks; the karaoke track simply appears when ready.

## What admins get
- **Stem Studio** panel on the admin songs page:
  - Counts: songs ready, processing, failed, missing.
  - "Process all missing" button that queues every song with audio but no instrumental.
  - Per-song status chip (Pending / Processing / Ready / Failed) with Retry.
- New songs uploaded with audio are queued automatically.
- Manually uploaded instrumentals are never overwritten.

## How it works
1. Each song gets two stem records (instrumental, vocals) tracking status: pending → processing → ready / failed.
2. A background worker runs every minute: starts up to 3 separations at a time, checks running ones, saves finished files to storage, and marks them ready.
3. When the instrumental is ready, the song's karaoke track is filled in (only if it was empty).
4. Failures keep the error message and can be retried; after 3 failed tries a song stops auto-retrying.

## Cost note
Separation runs on the existing Replicate connection, which charges per song (roughly a few cents each). "Process all missing" shows the number of songs before starting.

## Technical details
- Migration: add `prediction_id`, `attempts`, `source` (auto/manual) to `song_audio_versions`; unique (song_id, language_code, kind); trigger on `songs` insert/update of `audio_url` to enqueue pending rows when `instrumental_url` is null.
- Edge function `stem-worker` (service role, cron every minute via pg_cron + pg_net): claims pending rows, starts Demucs (htdemucs, mp3 320) via connector gateway, polls `processing` rows, uploads `no_vocals` to `song-instrumentals` and `vocals` to `song-audio/stems/`, sets `songs.instrumental_url` when null.
- Edge function `stem-admin` (admin-only): `enqueue_missing`, `retry`, `status_summary`.
- Existing `generate-instrumental` stays for the per-song button; it will also write its result into `song_audio_versions`.
- Admin UI: `StemStudio` component in AdminSongs.
