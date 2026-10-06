# Stage Mode Background & Player Access

## Goal
Give admins control over the Stage Mode lyrics background and let listeners open Stage Mode directly from the player’s three-dot options.

## Build path
1. **Stage background controls in Appearance & Home**
   - Add a dedicated **Stage Mode** panel.
   - Let admins choose a background colour.
   - Let admins add either an image or a looping video by uploading a file or pasting a link.
   - Show a preview, save changes, and provide clear remove/reset actions.

2. **Apply the background in Stage Mode**
   - Load the saved Stage Mode setting for every listener.
   - Render a muted, looping, inline video when configured; otherwise use the image; otherwise use the chosen colour.
   - Keep a dark readability layer behind lyrics and controls so white and gold text remains legible.
   - Preserve the current lyric timing, auto-scroll, screen wake lock, font sizing, and playback controls.

3. **Add Stage Mode to player options**
   - Add a **Stage Mode** action to the player’s three-dot menu.
   - Close the menu and open `/stage` while preserving the currently playing song and position.

4. **Verify**
   - Confirm linked and uploaded image/video backgrounds render correctly.
   - Confirm reset/fallback behaviour and readable lyrics.
   - Confirm the player option opens Stage Mode without interrupting playback.
   - Check phone, tablet, and desktop layouts and the final build status.

## Technical details
- Store the Stage presentation configuration in the existing admin-managed `app_settings` system.
- Upload Stage media to managed app storage and save only its public URL in settings.
- Use the existing admin role protection for editing; listeners only read the published setting.
- Video backgrounds will be muted, autoplaying, looping, and cover the screen; failed media falls back safely to the configured colour.
