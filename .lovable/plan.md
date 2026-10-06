# Phase 10: Renewal, Languages, and Community

## Goal
Deliver one coordinated Phase 10 release that helps premium listeners renew on time, lets the team manage multilingual lyrics and audio, and turns existing public profiles and karaoke stories into a connected worship community.

## Build path

### 1. Renewal reminders
- Extend the existing subscription lifecycle with one-time reminders at 10 days, 3 days, and on expiry.
- Deliver reminders through the existing in-app notification inbox and available push channel, with a direct **Renew now** action.
- Add reminder history so the same expiry period cannot generate duplicate messages.
- Add a renewal-status panel to the subscription page showing plan, expiry date, days remaining, and renewal action.
- Preserve the existing manual payment-proof and administrator approval process.

### 2. Lyrics and languages workspace
- Add an administrator workspace for enabling, ordering, and managing supported languages.
- Upgrade song lyric editing to manage each song’s language versions in the existing multilingual lyric records.
- Keep the current lyric synchronizer, but save synchronized and plain lyrics to the selected language.
- Add language-specific full, instrumental, vocals, and guide audio management without replacing legacy song media.
- Keep the listener language picker and make its selected language prefer that user’s language preference when available.
- Preserve Editor access strictly for lyric editing and synchronization; audio and language configuration remain Admin-only.

### 3. Social community
- Add secure follow/unfollow relationships with follower and following counts.
- Add worshiper search and lightweight community discovery using public profile fields only.
- Add a **Following** view to Moments that includes active karaoke stories from followed worshipers alongside existing official videos.
- Add notifications for new followers and comments on a listener’s karaoke recording.
- Add profile bio and community counts while preserving the existing Now Playing, recently played, and 24-hour karaoke visibility rules.
- Keep all share links on `loveworldmusickaraoke.com`, with KingsChat first.

## Technical details
- Use existing `languages`, `song_lyrics`, `song_audio_versions`, `notifications`, and `user_notifications` structures.
- Add only the missing relationship, reminder-ledger, and public profile fields with authenticated grants, row-level policies, and server-validated ownership.
- Do not expose email, church, zone, region, subscription details, or other private profile data in community search or feeds.
- Derive expiry state from stored dates; the existing lifecycle worker sends reminders and expiry transitions without adding a second permanent polling job.
- Keep multilingual media in child tables keyed by song and language; legacy song columns remain fallbacks.

## Verification
- Confirm each reminder interval sends once and opens the renewal page.
- Confirm Admin and Editor permissions differ correctly in the language workspace.
- Test lyric/audio switching across at least two languages and verify playback continuity.
- Test follow, unfollow, search, Following feed, comment notifications, and all privacy policies with two users.
- Verify mobile, tablet, and desktop layouts and ensure the preview remains error-free.
