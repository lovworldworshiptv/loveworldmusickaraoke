# Song Match Challenge

A limited-time competitive event on the Games page. Users pay 1 Espee (free for Premium) to join, play any SongMatch mode (Lyrics, Melody, Category) during the active window, and compete on a live leaderboard for an Espee prize pool. Admin creates challenges, approves entry payments, and the system auto-awards bonuses and distributes prizes at end.

## Scope

### 1. Database (new tables)
- `challenges` — name, description, entry_fee, start_date, end_date, prize_pool, prize_distribution (jsonb: {1:70,2:20,3:10}), status (draft/active/completed/cancelled), max_daily_scoring_games (nullable), max_referrals_per_user (nullable), qualification_min_games (default 10), created_by
- `challenge_entries` — challenge_id, user_id, status (pending/approved/rejected), payment_proof_url, paid_amount, espees_paid (bool), referred_by_user_id, joined_at, approved_at, approved_by — unique(challenge_id, user_id)
- `challenge_scores` — challenge_id, user_id, total_score, games_played, lyrics_points, melody_points, category_points, qualified (bool), last_updated — unique(challenge_id, user_id)
- `challenge_game_logs` — challenge_id, user_id, mode (lyrics/melody/category), difficulty, score, completed_at, counted_toward_score (bool — false if past daily cap)
- `challenge_bonuses_awarded` — challenge_id, user_id, bonus_key (daily_login_YYYYMMDD, activity_5_YYYYMMDD, activity_10_YYYYMMDD, multi_mode_YYYYMMDD, difficulty_master_YYYYMMDD, mixed_difficulty_YYYYMMDD, lyrics_master, melody_master, category_master, songmatch_master), points, awarded_at — unique(challenge_id, user_id, bonus_key)
- `challenge_referrals` — challenge_id, referrer_user_id, referred_user_id, awarded (bool) — unique(challenge_id, referred_user_id); self-ref blocked at insert

All tables get GRANTs + RLS:
- `challenges`: public SELECT for active/completed; admin full
- `challenge_entries`: user can SELECT/INSERT own; admin full
- `challenge_scores`: public SELECT (leaderboard); only service_role/admin writes
- `challenge_game_logs`, `challenge_bonuses_awarded`, `challenge_referrals`: user SELECT own; service_role writes

### 2. Edge functions
- `submit-challenge-entry` — validates active challenge, deducts entry, uploads proof to `payment-proofs` bucket, creates pending entry; auto-approves & enrolls Premium users with 0 fee
- `approve-challenge-entry` (admin) — flips entry to approved, creates `challenge_scores` row, awards referral bonus to referrer if `referred_by_user_id` set and not self
- `record-challenge-game` — called by SongMatch game pages on completion; inserts log, enforces daily cap, recalculates total_score, evaluates daily/multi-mode/difficulty/mastery bonuses, sets qualified=true at threshold
- `finalize-challenge` — cron + manual trigger; when end_date reached, locks leaderboard, picks top N qualified users, credits prize Espees (via existing Espee balance mechanism / admin notification), sets status=completed

### 3. Frontend pages/components
- `src/components/games/ChallengeBanner.tsx` — hero banner at top of Games page: name, prize pool breakdown, entry fee, participant count, live countdown, CTA "Enter Challenge" / "You're Participating" / "Qualified"
- `src/pages/Challenge.tsx` (`/games/challenge`) — full challenge detail, personal progress, live leaderboard with logged-in user highlighted, referral link with copy
- `src/pages/ChallengeEntry.tsx` (`/games/challenge/enter`) — payment proof upload (mirrors subscription flow); Premium users skip payment
- `src/pages/AdminChallenges.tsx` (`/admin/challenges`) — list/create/edit challenges, approve pending entries, view leaderboard, manual finalize
- Wire `?ref=USER123` capture on `/games` and `/smchallenge` route → store in localStorage → pass to entry submission
- Hook `useActiveChallenge()` + `useChallengeEntry()` + realtime subscription on `challenge_scores`
- Patch SongMatch pages (`SongMatchLyrics`, `SongMatchMelody`, `SongMatchCategory`) to call `record-challenge-game` at completion when the user is an approved participant — purely additive, no behavior change to base game

### 4. Admin nav + routes
- Add "Challenges" entry in admin drawer
- Add routes in `App.tsx`

## Technical notes
- Scoring stays separate from `useGameStats` totals (different tables). Existing game flow untouched.
- Countdown uses client tick + server `end_date` source of truth.
- Daily cap enforced in `record-challenge-game` by counting today's logs before flagging `counted_toward_score`.
- All sharing links use `loveworldmusickaraoke.com` per project rule.
- Espee payout: prize Espees credited by writing to existing user Espee field (will inspect `profiles` / `user_subscriptions` for the existing field; if none exists I will add `espees_balance` to `profiles` in the same migration).

## Out of scope (confirm before adding)
- Push notifications for challenge events
- Multi-challenge concurrent support (we'll allow only one active challenge at a time; admin enforced)
- Historical challenge archive page

## Deliverables
1 migration, 4 edge functions, ~7 new frontend files, edits to 4 existing files (Games.tsx, 3 SongMatch pages), admin route + nav entry.

Shall I proceed?