# Roadmap
- [x] Praise Night Discover card: nine matching albums, edition 28 cover, album open/back flow and loaded artwork verified; three selection tests pass.
- [x] Praise Night 29: 17 missing songs ingested from loveworldlyrics.com (lyrics, audio in app storage, album cover, durations); album now 26 songs, playback and search verified; 16 karaoke tracks queued.
- [x] My Referrals: every stat box opens its breakdown
- [x] Admin on/off switch for the whole referral feature
- [x] Onboarding refresh reflecting new features, fully CMS-managed (badge, order, preview)
- [x] Tilted photos load eagerly with bundled per-game fallbacks, including CMS previews; eight tests pass and all Games/Challenge artwork loads at 320, 394, 768 and 1280px.
- [x] Match challenge heading to CMS-managed tilted-image card; arcade-glass referral notices and Leave Challenge verified signed-in, with artwork taps, countdown, copy, cancelled leave confirmation, mobile fit and reduced motion; five tests pass.
- [x] Apply selected Arcade Neon Glass leaderboard and current-position styling; signed-in checks verify 12 real ranks, desktop lift, press feedback, mobile fit and reduced motion; five tests pass and build is clean.
- [x] Apply Interactive Arcade Glass hover/press/focus effects to Games cards and CTAs; desktop hover, touch artwork, keyboard focus, disabled CTA, reduced motion and leaderboard navigation verified.
- [x] Bright challenge labels and figures with CMS label/colour controls and shared live preview; five tests and signed-in save/reload checks pass.
- [x] Match Challenges to Games colours, add tilted artwork and CMS presentation controls; signed-in CMS save, artwork taps and leaderboard navigation pass; challenge rules preserved.
- [x] Apply Vibrant Gamified Hub achievement cards and animated Play & Grow icons; signed-in desktop/phone rendering, reduced motion and card settings tests pass.
- [x] Bright Music Quiz and Articles cards with tilted photos and admin presentation controls; settings tests and isolated hover/tap checks pass.
- [x] Signed-in game-card CMS save verification — saved existing values successfully and reloaded the editor.

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
- [x] Onboarding analytics (screen views, completion, skip/leave points) in admin
- [x] Verify referral invite link + its share link
- [x] (prompt + app link done; icon clicks not browser-verified) Check all share icons; prompt web visitors to download the app (LW App Store link)
- [x] Full player top icons (share, like, minimize, 3 dots) white
- [x] Sharing analytics: share taps per channel, visits from shared links, referral sign-ups by channel, app download taps — Admin → Analytics → Sharing
- [x] Stem worker: correct vocal-isolation settings (retry "Resounding Praise" from Stem Studio)
- [x] YouTube-style offline fallback: no internet → open Downloads so saved songs play; offer return when back online
- [x] Native feel on mobile/tablet: no bounce, tap flashes, long-press callouts or text selection; offline-first caching
- [x] Offline downloads follow the account: song + karaoke track + video saved together, restored on any device, offline plays synced on reconnect, My Stats on Profile

- [x] Offline fallback to Downloads with automatic return and refresh on reconnect
- [x] Faster repeat loading through saved app files and artwork
- [x] Mini player hide/reveal on phones: down-chevron or swipe down to tuck away, centered handle to bring back, choice remembered across pages and reloads
- [x] Enable editors to edit song details in Manage Songs; existing editor update policy verified, three permission tests pass; live editor-session save awaits signed-in verification.
- [x] Enable editors to add songs and upload song/instrumental audio; server-side editor policies verified and four permission tests pass; live editor-account creation awaits signed-in verification.
- [x] Encrypted offline downloads v3: device-bound licences (5 devices, 30 days capped by subscription), resumable 1 MB chunk queue, safe full-history restore (newest first, Wi-Fi/space checks), streaming playback with seeking, device manager, sign-out cleanup, legacy migration; byte-identical decryption and offline play verified, 8 rule tests pass.

## Secure Offline Downloads — QA & hardening (Oct 19)
- [x] Account library: soft delete, quality/media type/size columns, unique (user, song, quality), owner update policy, live updates
- [x] Backend: 60 requests/hour limit, 403 when not entitled / not owned / revoked, AES-KW device wrapping, master-key version; testable handler + 12 backend tests
- [x] Device: OPFS chunk storage with IndexedDB fallback (verified in a production build)
- [x] Playback route /__offline/<song> (keeps /offline-stream alias)
- [x] Streaming playback without the offline helper (MediaSource, with seeking); in-memory copy only where neither exists
- [x] Sync: live updates, reconcile (re-save wins over older removal), batched renewals, wait-and-continue at the hourly limit
- [x] UI: shared download button states, album-card saves, Download all (albums/playlists/collections), Downloads tabs/sort, Settings → Downloads, sign-out confirmation, contrast + reduced motion
- [x] Unit tests 1–8, backend tests 9–11, browser tests 12–14 (tests/e2e/offline_downloads_e2e.py)
- [x] Admin self-test page /dev/offline-selftest with copy report + expire/renew tools
- [x] QA report + manual device checklist
- [ ] Real-device checks (Android, iPhone, desktop) from the QA report checklist — needs physical phones

- [x] Praise Night albums from LMM LIVE TV (loveworldmusic.org): 15 albums + 248 songs added, audio linked to outside hosts, no karaoke; 79 without working audio, 23 unopenable pages, 1 full-concert recording skipped.
- [x] songs_library_v2.csv import: 67 missing songs added (10 HSLHS compilation albums + Loveworld Best Songs Vol 3 created, covers in app assets), no karaoke; skipped 67 without audio, 21 dead/page links, 19 already present under a variant title, repeats already in other albums, 1 full concert. Playback verified.
