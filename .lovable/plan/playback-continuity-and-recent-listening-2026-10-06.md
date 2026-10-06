# Playback continuity and recent listening

## Build
- Keep the song cover visible as the poster until motion artwork can play, and fall back to it if the clip fails.
- Save the active song, queue, playback position, mode, volume, shuffle, and repeat settings locally as listening changes.
- Restore the player after page navigation or reopening the app at the saved position, paused and ready for one-tap continuation.
- Keep the existing Recently Played home section, make it refresh immediately after a play, remove duplicates before limiting results, and allow horizontal swiping.

## Technical details
- Playback restoration stays client-side and does not count as a new play until the listener starts a track normally.
- Signed-in listening history continues using the existing protected history table and `record_play` flow.
- Invalid, expired, or completed saved sessions are discarded safely.

## Validation
- Verify artwork remains visible during motion loading and after a motion error.
- Verify navigation keeps audio playing, browser refresh restores the exact song and approximate position, and Recently Played updates.
