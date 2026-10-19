"""
End-to-end checks for secure offline downloads (QA cases 12-14).

Run (needs a signed-in session; see "Session" below):
  BASE_URL=http://localhost:8080 python3 tests/e2e/offline_downloads_e2e.py 13 14
  BASE_URL=http://127.0.0.1:4173 python3 tests/e2e/offline_downloads_e2e.py 12   # production build: `vite build && vite preview --host 127.0.0.1 --port 4173`

Case 12 needs the offline service worker, which only runs in production builds
(it is switched off in development and in the Lovable preview). Use 127.0.0.1, not
"localhost": the offline helper deliberately leaves localhost traffic uncached.

Session: set LMK_STORAGE_KEY and LMK_SESSION_JSON (the Supabase auth storage key and
session JSON of a test account), or LOVABLE_BROWSER_SUPABASE_STORAGE_KEY /
LOVABLE_BROWSER_SUPABASE_SESSION_JSON inside Lovable.

Uses the free song "Divinity" by default (SONG_ID to override). Each case frees its
device slots afterwards. Case 13 restores the account's saved state when it is done.
"""
import asyncio
import os
import sys
from playwright.async_api import async_playwright

BASE = os.environ.get("BASE_URL", "http://localhost:8080")
SONG = os.environ.get("SONG_ID", "8a069f3b-2dbd-4339-870c-f988c42ceecc")
KEY = os.environ.get("LMK_STORAGE_KEY") or os.environ["LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"]
SESSION = os.environ.get("LMK_SESSION_JSON") or os.environ["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"]
DEV = ":8080" in BASE or ":5173" in BASE  # dev server can import source modules directly

SAVE_JS = """async (song) => {
  const dm = await window.__m('/src/lib/downloadManager.ts');
  await dm.saveDownload(song, '', { id: song, title: 'Divinity', artist: 'Loveworld Singers', durationSeconds: 240, downloadedAt: Date.now() });
}"""
# Use the very module instances the app loaded (the dev server may add version suffixes to their URLs).
MOD_JS = """() => { window.__m = (p) => import(performance.getEntriesByType('resource').map((e) => e.name)
  .find((n) => new URL(n).pathname === p) || p); }"""
CLEANUP_JS = "async () => { const e = await window.__m('/src/lib/secureDownloads/engine.ts'); await e.signOutCleanup(); }"


async def device(browser, path="/library"):
    ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
    page = await ctx.new_page()
    await page.goto(BASE)
    await page.evaluate("([k, v]) => window.localStorage.setItem(k, v)", [KEY, SESSION])
    await page.goto(BASE + path, wait_until="domcontentloaded")
    await page.wait_for_timeout(3500)
    await page.evaluate(MOD_JS)
    return ctx, page


def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond:
        raise SystemExit(1)


async def case_12(browser):
    """Download → offline → reload → plays, and seeking to 75% plays from there."""
    ctx, page = await device(browser)
    await page.goto(BASE + "/library", wait_until="networkidle")
    sw = await page.evaluate("async () => { await navigator.serviceWorker?.ready; return !!navigator.serviceWorker?.controller; }")
    if not sw:
        await page.reload(wait_until="networkidle")
    check(await page.evaluate("() => !!navigator.serviceWorker?.controller"), "offline helper controls the page")
    # Divinity is on the account but not on this fresh device: save it from Library → Downloads.
    await page.get_by_role("tab", name="Downloads").click()
    await page.get_by_role("button", name="Download Divinity for offline", exact=True).first.click()
    for _ in range(90):
        ok = await page.evaluate("""async (song) => {
          const r = await fetch(`/__offline/${song}`, { headers: { Range: 'bytes=0-15' } }).catch(() => null);
          return !!r && r.status === 206; }""", SONG)
        if ok:
            break
        await page.wait_for_timeout(1000)
    await ctx.set_offline(True)
    await page.reload(wait_until="domcontentloaded")
    await page.wait_for_timeout(1500)
    check(await page.evaluate("() => document.getElementById('root')?.childElementCount > 0"), "app opens with no connection")
    result = await page.evaluate("""async (song) => {
      const a = new Audio(`/__offline/${song}`);
      a.muted = true;
      await new Promise((res, rej) => { a.onloadedmetadata = res; a.onerror = () => rej(new Error('load failed')); });
      a.currentTime = a.duration * 0.75;
      await a.play();
      await new Promise((r) => setTimeout(r, 2500));
      return { duration: a.duration, at: a.currentTime, error: a.error && a.error.code };
    }""", SONG)
    check(result["error"] is None and result["at"] > result["duration"] * 0.75, f"plays offline from 75%: {result}")
    await ctx.set_offline(False)
    await ctx.close()


async def case_13(browser):
    """Save on device A → appears on B within 5 s; remove on B → disappears on A."""
    ctxA, A = await device(browser)
    ctxB, B = await device(browser)
    before = await A.evaluate("""async (song) => {
      const { supabase } = await window.__m('/src/integrations/supabase/client.ts');
      const { data: { session } } = await supabase.auth.getSession();
      const { data } = await supabase.from('downloads').select('deleted_at').eq('user_id', session.user.id).eq('song_id', song).maybeSingle();
      if (data && !data.deleted_at) await supabase.from('downloads').update({ deleted_at: new Date().toISOString() }).eq('user_id', session.user.id).eq('song_id', song);
      return data; }""", SONG)
    await B.wait_for_timeout(2000)
    await A.evaluate(SAVE_JS, SONG)
    seen = None
    for s in range(10):
        await B.wait_for_timeout(500)
        seen = await B.evaluate("""async (song) => { const e = await window.__m('/src/lib/secureDownloads/engine.ts');
          const st = e.getSnapshot(); return !!(st.restore?.songs || []).find((x) => x.id === song) || !!st.items.find((i) => i.songId === song); }""", SONG)
        if seen:
            check(True, f"saved on A shows on B after {(s + 1) * 0.5:.1f} s")
            break
    check(bool(seen), "saved on A shows on B within 5 s")
    await B.evaluate("async (song) => { const dm = await window.__m('/src/lib/downloadManager.ts'); await dm.removeDownload(song); }", SONG)
    gone = False
    for s in range(10):
        await A.wait_for_timeout(500)
        gone = await A.evaluate("async (song) => { const st = await window.__m('/src/lib/secureDownloads/store.ts'); return !(await st.getItem(song)); }", SONG)
        if gone:
            check(True, f"removed on B disappears from A after {(s + 1) * 0.5:.1f} s")
            break
    check(gone, "removed on B disappears from A within 5 s")
    for pg in (A, B):
        await pg.evaluate(CLEANUP_JS)
    if before and before.get("deleted_at") is None:
        await A.goto(BASE)
        await A.evaluate("([k, v]) => window.localStorage.setItem(k, v)", [KEY, SESSION])
        await A.wait_for_timeout(1500)
        await A.evaluate(MOD_JS)
        await A.evaluate("""async (song) => { const { supabase } = await window.__m('/src/integrations/supabase/client.ts');
          const { data: { session } } = await supabase.auth.getSession();
          await supabase.from('downloads').update({ deleted_at: null }).eq('user_id', session.user.id).eq('song_id', song); }""", SONG)
    await ctxA.close(); await ctxB.close()


async def case_14(browser):
    """Close the page mid-download, reopen, and it continues from where it stopped."""
    ctx, page = await device(browser)
    await page.evaluate("async (song) => { const st = await window.__m('/src/lib/secureDownloads/store.ts'); const it = await st.getItem(song); if (it) await st.deleteItem(it); }", SONG)
    await page.evaluate(f"(song) => {{ ({SAVE_JS})(song).catch(() => undefined); }}", SONG)
    stored = 0
    total = 0
    for _ in range(120):
        await page.wait_for_timeout(250)
        info = await page.evaluate("""async (song) => { const st = await window.__m('/src/lib/secureDownloads/store.ts');
          const it = await st.getItem(song); if (!it || !it.packages.length) return [0, 0];
          let n = 0; for (const p of it.packages) n += (await st.storedChunkIndices(p.packageId)).size;
          return [n, it.packages.reduce((s, p) => s + p.chunkCount, 0)]; }""", SONG)
        stored, total = info
        if stored >= 6:
            break
    check(0 < stored < total, f"interrupted part-way: {stored}/{total} chunks stored")
    await page.close()
    fetched = []
    page = await ctx.new_page()
    page.on("request", lambda r: fetched.append(r.url) if "/storage/v1/object/sign/offline-packages/" in r.url else None)
    await page.goto(BASE + "/library", wait_until="domcontentloaded")
    await page.wait_for_timeout(1500)
    await page.evaluate(MOD_JS)
    ready = False
    for _ in range(120):
        await page.wait_for_timeout(1000)
        ready = await page.evaluate("async (song) => { const st = await window.__m('/src/lib/secureDownloads/store.ts'); return (await st.getItem(song))?.status === 'ready'; }", SONG)
        if ready:
            break
    check(ready, "download finished after reopening")
    check(len(fetched) <= total - stored + 4, f"only missing chunks were fetched again ({len(fetched)} fetched, {total - stored} were missing)")
    await page.evaluate(CLEANUP_JS)
    await ctx.close()


async def main():
    cases = sys.argv[1:] or (["13", "14"] if DEV else ["12"])
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--autoplay-policy=no-user-gesture-required"])
        for c in cases:
            print(f"--- case {c} ---")
            await {"12": case_12, "13": case_13, "14": case_14}[c](browser)
        await browser.close()


asyncio.run(main())
