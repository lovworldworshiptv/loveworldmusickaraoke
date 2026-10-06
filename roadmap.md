# Roadmap

- [ ] "Resounding Praise" stem test still processing on Replicate (~17 min, unusually slow — likely their queue). Worker cron keeps polling; it will finish on its own.
- [x] Admin notifications for stem jobs: started / completed / needs retry (admin_notifications table + worker hooks)
- [x] Stem Studio: live list of individual songs being processed + recent results
- [x] Phase 5: Videos hub — /videos page (grid of songs with active videos, search, type badges), sidebar "Videos" entry, playVideo() opens the player straight into Video mode
- [x] Phase 6: My Studio (/studio) — offline songs with days-left, on-device karaoke recordings (save, keep shared ones, rename, export, delete)
- [x] Phase 7: Moments feed (/moments) — vertical snap-scrolling video feed, auto play/pause on scroll, right-rail Like / Sing This / Share, YouTube moments open the player in Video mode
- [x] Phase 8: Stage mode (/stage) — full-screen big lyrics for live performance, synced gold highlight, auto-scroll, auto-hiding controls, font size steps, screen wake lock, prev/play/next
- [x] Phase 9: Admin v2 — unified dashboard, content performance, audience insights, operational alerts, and bulk song management
- [ ] Phase 10: renewal reminders, multilingual lyrics management, and social community
- [ ] Home UX polish: fuchsia-pink card for "Pastor Chris Live Unending Praise", bright gradient background for Daily Discover card

- [x] Graceful hover effects: top icons, mood capsules, bottom nav (hover-only, no other changes)
- [x] Stage Mode CMS: colour/image/video backgrounds, audio toggle, manual scroll, and player-options shortcut
- [x] Divinity Stage Mode: five-second ocean-and-mountains video, exclusive Sync/Manual modes, and click-to-select lyric lines
