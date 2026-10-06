# Phase 9 — Admin v2

## Goal
Turn the existing admin area into a clearer command centre for understanding platform activity, spotting content gaps, and managing many songs efficiently.

## What will be built

### 1. Admin overview
- Upgrade Analytics into a responsive Admin v2 dashboard with Overview, Content, Audience, and Operations views.
- Keep the existing date controls and connect every metric to live platform data.
- Show key totals, play trends, new-user trends, subscription mix, and practical alerts at a glance.

### 2. Content performance
- Rank songs using plays, karaoke sessions, favourites, and downloads.
- Show per-song performance in a sortable table rather than isolated totals.
- Add catalogue health indicators for missing artwork, audio, lyrics, instrumentals, videos, and categories.
- Keep article and game performance available in the dashboard.

### 3. Audience insights
- Show active listeners, new registrations, subscription distribution, and subscription expiries.
- Summarise audience locations from completed profiles using region and zone data.
- Surface the most engaged listeners without exposing private contact details in analytics.

### 4. Operations
- Show stem-processing status and unread admin alerts.
- Surface content requiring attention, such as incomplete media and failed stem jobs.
- Link each alert to the relevant management page.

### 5. Bulk song management
- Add search, filtering, selection, select-all-visible, and selection counts to Manage Songs.
- Add safe bulk actions for Featured, Top, Free Download, and Category.
- Require confirmation before applying changes, refresh the list afterward, and show success or failure clearly.
- Keep destructive deletion as an individual confirmed action.

## Technical details
- Reuse the current admin-only access checks and existing live tables; no mock data.
- Use `play_events` for mode-aware listening analytics and existing song counters for catalogue totals.
- Use semantic theme tokens and the existing chart and control components.
- Break the dashboard into focused admin components so the analytics page remains maintainable.
- Preserve Editor restrictions: bulk catalogue changes remain Admin-only; lyric syncing remains available to Editors.

## Validation
- Confirm non-admin users cannot access the dashboard or bulk controls.
- Verify all dashboard views with live data and useful empty states.
- Verify bulk changes affect only selected songs and persist after refresh.
- Check mobile, tablet, and desktop layouts, then confirm a clean build and no new runtime errors.