# Roadmap
- [x] Bright Music Quiz and Articles cards with tilted photos and admin presentation controls; settings tests and isolated hover/tap checks pass.
- [ ] Signed-in game-card CMS save verification — blocked until the user signs in in the preview.

- [x] Admin-only community management and community-scoped moderator appointments; signed-in permission regressions pass and admin search dialog verified.

- [x] Community directory/detail pages, admin-editable profile images, white text, and neutral grey page background.

- [x] Reference-matched community card colours with admin colour picker, live preview, and saved per-community settings.

- [x] Neon-green Daily Discover (CMS colour control) and 18 centralized admin feature switches across routes, menus, home sections, and player modes; six regression tests pass and disabled direct links verified

- [ ] "Resounding Praise" stem test still processing on Replicate (~17 min, unusually slow — likely their queue). Worker cron keeps polling; it will finish on its own.
- [x] Admin notifications for stem jobs: started / completed / needs retry (admin_notifications table + worker hooks)
- [x] Stem Studio: live list of individual songs being processed + recent results
- [x] Phase 5: Videos hub — /videos page (grid of songs with active videos, search, type badges), sidebar "Videos" entry, playVideo() opens the player straight into Video mode
- [x] Phase 6: My Studio (/studio) — offline songs with days-left, on-device karaoke recordings (save, keep shared ones, rename, export, delete)
- [x] Phase 7: Moments feed (/moments) — vertical snap-scrolling video feed, auto play/pause on scroll, right-rail Like / Sing This / Share, YouTube moments open the player in Video mode
- [x] Phase 8: Stage mode (/stage) — full-screen big lyrics for live performance, synced gold highlight, auto-scroll, auto-hiding controls, font size steps, screen wake lock, prev/play/next
- [x] Phase 9: Admin v2 — unified dashboard, content performance, audience insights, operational alerts, and bulk song management
- [x] Phase 10: renewal reminders (7/3/1/0-day in-app + push, deduped), multilingual lyrics & audio versions management (AdminSongs "Lyrics & Languages"), preferred-language playback, social community (/community with join, posts, song attachments, likes, comments)

- [x] Home card colours updated; earlier fuchsia/bright-gradient request superseded by global playlist colour and neon-green Daily Discover

- [x] Graceful hover effects: top icons, mood capsules, bottom nav (hover-only, no other changes)
- [x] Stage Mode CMS: colour/image/video backgrounds, audio toggle, manual scroll, and player-options shortcut
- [x] Divinity Stage Mode: five-second ocean-and-mountains video, exclusive Sync/Manual modes, and click-to-select lyric lines
- [x] Desktop mini player docked to the screen bottom, collapsible sidebar, and matching volume progress styling
- [x] Global playlist card background → RGB(228,46,10) (#e42e0a default) — done, build OK
- [x] Play icon inside every circle on every home playlist card → white (verified rgb(255,255,255) on home)
