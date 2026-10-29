import { supabase } from "@/integrations/supabase/client";

/**
 * Records, once per day per signed-in person, which country they're using the app from.
 * The country comes from the website's own network edge (/cdn-cgi/trace, same site — no IP is stored),
 * falling back to the device's time zone when that isn't available (e.g. preview links).
 */

export type CountrySource = "network" | "timezone";

const INVALID = new Set(["XX", "T1", "ZZ"]);
const DAY_KEY = "lw_activity_day";

export const todayUtc = (now = new Date()) => now.toISOString().slice(0, 10);

export function parseTraceCountry(trace: string): string | null {
  const match = trace.match(/^loc=([A-Za-z]{2})\s*$/m);
  const code = match?.[1].toUpperCase() ?? null;
  return code && !INVALID.has(code) ? code : null;
}

export async function countryFromTimezone(timeZone?: string): Promise<string | null> {
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!zone) return null;
  const { TIMEZONE_COUNTRIES } = await import("./timezoneCountries");
  return TIMEZONE_COUNTRIES[zone] ?? null;
}

export async function detectCountry(): Promise<{ code: string | null; source: CountrySource | "unknown" }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch("/cdn-cgi/trace", { cache: "no-store", signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const code = parseTraceCountry(await res.text());
      if (code) return { code, source: "network" };
    }
  } catch { /* fall back to the time zone */ }
  try {
    const code = await countryFromTimezone();
    if (code) return { code, source: "timezone" };
  } catch { /* unknown */ }
  return { code: null, source: "unknown" };
}

let inFlight = false;
let currentUser: string | null = null;

export async function logActivityDay(userId: string) {
  currentUser = userId;
  const key = `${DAY_KEY}:${userId}`;
  const today = todayUtc();
  try { if (localStorage.getItem(key) === today) return; } catch { /* storage blocked */ }
  if (inFlight) return;
  inFlight = true;
  try {
    const { code, source } = await detectCountry();
    const { error } = await supabase.rpc("log_activity_day", { p_country: code ?? "", p_source: source });
    if (!error) { try { localStorage.setItem(key, today); } catch { /* ignore */ } }
  } finally {
    inFlight = false;
  }
}

export function stopActivityTracking() {
  currentUser = null;
}

// A new day while the app stays open counts when the person comes back to it.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && currentUser) logActivityDay(currentUser);
  });
}

const regionNames = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
export const countryName = (code: string) => {
  try { return regionNames?.of(code) ?? code; } catch { return code; }
};
export const countryFlag = (code: string) =>
  /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : "";
