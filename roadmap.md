# Roadmap

- [ ] "Resounding Praise" stem test still processing on Replicate (~17 min, unusually slow — likely their queue). Worker cron keeps polling; it will finish on its own.
- [x] Admin notifications for stem jobs: started / completed / needs retry (admin_notifications table + worker hooks)
- [x] Stem Studio: live list of individual songs being processed + recent results
- [x] Phase 5: Videos hub — /videos page (grid of songs with active videos, search, type badges), sidebar "Videos" entry, playVideo() opens the player straight into Video mode
