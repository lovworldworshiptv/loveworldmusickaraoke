"""Visual regression test: Discover page footer spacing.

Verifies the last Discover category cards sit flush above the bottom
navigation (mini player off) or the mini player (mini player on), at
mobile, tablet, and desktop viewports.

Run from the project root with the dev server on localhost:8080:

    python3 tests/discover-footer-spacing.py

Exits non-zero if any scenario's gap exceeds the allowed threshold.
Screenshots are written to /tmp/browser/discover-spacing/.
"""

import asyncio
import json
import os
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
OUT = Path("/tmp/browser/discover-spacing")
OUT.mkdir(parents=True, exist_ok=True)

# Max allowed px between the last card's bottom edge and the top edge of
# the element below it (mini player when playing, bottom nav otherwise).
MAX_GAP_PX = 8

VIEWPORTS = {
    "mobile": {"width": 394, "height": 731},
    "tablet": {"width": 768, "height": 1024},
    "desktop": {"width": 1280, "height": 900},
}

MEASURE_JS = """() => {
  const tiles = Array.from(document.querySelectorAll('a[href^="/discover/tag/"], a[href="/videos"], a[href="/playlists"], a[href="/articles"], a[href="/games"], a[href="/community"]'))
    .filter(el => el.closest('main') || el.closest('[class*="overflow"]'));
  if (!tiles.length) return { error: "no category tiles found" };
  const last = tiles[tiles.length - 1].getBoundingClientRect();
  // The element directly below the cards is the topmost fixed bar in the
  // lower half of the screen: the mini player when playing, else the
  // bottom navigation.
  const bars = Array.from(document.querySelectorAll('body *')).filter(el => {
    if (['OL', 'UL'].includes(el.tagName)) return false; // toast containers
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.height > 30 && r.width > 200 && r.top > window.innerHeight * 0.5 && r.top < window.innerHeight;
  });
  if (!bars.length) {
    // Desktop with no mini player: content should reach the viewport bottom.
    return {
      lastCardBottom: last.bottom,
      belowTop: window.innerHeight,
      belowKind: "viewport-bottom",
      gap: Math.round((window.innerHeight - last.bottom) * 10) / 10,
      viewportH: window.innerHeight,
    };
  }
  const below = bars.reduce((a, b) =>
    a.getBoundingClientRect().top < b.getBoundingClientRect().top ? a : b);
  const b = below.getBoundingClientRect();
  return {
    lastCardBottom: last.bottom,
    belowTop: b.top,
    belowKind: below.tagName.toLowerCase() === 'nav' ? "bottom-nav" : "mini-player",
    gap: Math.round((b.top - last.bottom) * 10) / 10,
    viewportH: window.innerHeight,
  };
}"""


async def restore_session(page):
    key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    session = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    if not (key and session):
        return False
    await page.goto(BASE, wait_until="domcontentloaded")
    await page.evaluate(
        f"window.localStorage.setItem({json.dumps(key)}, {json.dumps(session)})"
    )
    return True


async def dismiss_onboarding(page):
    skip = page.get_by_role("button", name="Skip")
    if await skip.count():
        await skip.first.click()


async def scenario(pw, name, viewport, with_player):
    browser = await pw.chromium.launch(headless=True)
    ctx = await browser.new_context(viewport=viewport)
    page = await ctx.new_page()
    authed = await restore_session(page)
    await page.goto(f"{BASE}/discover", wait_until="domcontentloaded")
    await dismiss_onboarding(page)
    await page.wait_for_timeout(2500)

    if with_player:
        # Start a song from the home page so the mini player appears.
        await page.goto(BASE, wait_until="domcontentloaded")
        await page.wait_for_timeout(2500)
        play = page.locator('main button:has(svg.lucide-play)').first
        if await play.count():
            await play.click()
            await page.wait_for_timeout(2500)
        # Navigate in-app (no reload) so the mini player persists.
        await page.get_by_role("link", name="Discover").first.click()
        await page.wait_for_timeout(2500)
        mp = await page.evaluate(
            "() => !!document.querySelector('.fixed.left-2.right-2')"
        )
        print(f"  mini player present on discover: {mp}")

    # Scroll the main content container to the very bottom.
    await page.evaluate(
        """() => {
          const main = document.querySelector('main');
          (main || document.scrollingElement).scrollTop = 1e6;
        }"""
    )
    await page.wait_for_timeout(800)

    result = await page.evaluate(MEASURE_JS)
    shot = OUT / f"{name}.png"
    await page.screenshot(path=str(shot))
    await browser.close()
    result["authed"] = authed
    result["screenshot"] = str(shot)
    return result


async def main():
    failures = []
    async with async_playwright() as pw:
        for vp_name, vp in VIEWPORTS.items():
            for player in (False, True):
                tag = f"{vp_name}-{'player' if player else 'noplayer'}"
                r = await scenario(pw, tag, vp, player)
                print(tag, json.dumps(r))
                if "error" in r:
                    failures.append(f"{tag}: {r['error']}")
                elif r["gap"] > MAX_GAP_PX or r["gap"] < -2:
                    failures.append(
                        f"{tag}: gap {r['gap']}px exceeds ±{MAX_GAP_PX}px "
                        f"(card bottom {r['lastCardBottom']}, {r['belowKind']} top {r['belowTop']})"
                    )
    if failures:
        print("\nFAILURES:")
        for f in failures:
            print(" -", f)
        sys.exit(1)
    print("\nAll 6 scenarios passed: cards flush within", MAX_GAP_PX, "px.")


asyncio.run(main())
