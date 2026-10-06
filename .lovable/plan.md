# Divinity Stage Mode upgrade

## Build path
1. Generate a calm five-second, widescreen ocean-and-mountains loop and add it as Divinity's Stage Mode background.
2. Extend Stage Mode so its presentation can be overridden for an individual song while retaining the admin-managed global fallback.
3. Add explicit **Sync** and **Manual** modes. Switching to Manual disables lyric sync and lets the presenter click any lyric line to select and center it; switching to Sync clears manual selection and resumes time-based highlighting and scrolling.
4. Keep audio on/off independent from lyric navigation, and preserve the existing Stage Mode controls and appearance.
5. Verify Divinity's background, mode switching, line selection, playback controls, and mobile/desktop layout in the live preview.

## Technical details
- Store Divinity's generated video as a project media asset and map it through the existing Stage Mode settings layer rather than embedding playback logic in the page.
- Use one navigation-mode state (`sync` or `manual`) to prevent contradictory toggle states.
- In manual mode, clicked lines become the active line and scroll smoothly to the presentation focus area; playback time no longer changes the selected line.
