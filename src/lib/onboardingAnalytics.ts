import { supabase } from "@/integrations/supabase/client";

export type OnboardingEvent = "onboarding_view" | "onboarding_skip" | "onboarding_complete" | "onboarding_leave";

const SESSION_KEY = "lw_onboarding_session";

/** One id per onboarding run on this device, so views/skips can be grouped into a funnel. */
export const onboardingSession = (): string => {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(SESSION_KEY, id); }
    return id;
  } catch { return "unknown"; }
};

export const logOnboarding = async (event: OnboardingEvent, data: { index: number; screenId?: string; total: number }) => {
  try {
    const { data: s } = await supabase.auth.getSession();
    await supabase.from("analytics_events").insert({
      event_type: event,
      user_id: s.session?.user.id ?? null,
      event_data: { session: onboardingSession(), screen_index: data.index, screen_id: data.screenId ?? null, total: data.total },
    });
  } catch { /* analytics must never block onboarding */ }
};

export interface OnboardingStats {
  started: number;
  completed: number;
  skipped: number;
  left: number;
  perScreen: { index: number; views: number; skips: number; leaves: number }[];
}

/** Aggregate raw onboarding events into unique-session funnel numbers. */
export const summarizeOnboarding = (rows: { event_type: string; event_data: unknown }[]): OnboardingStats => {
  const sessions = new Map<string, { views: Set<number>; skip?: number; leave?: number; done: boolean }>();
  for (const r of rows) {
    const d = (r.event_data || {}) as { session?: string; screen_index?: number };
    if (!d.session) continue;
    const s = sessions.get(d.session) ?? { views: new Set<number>(), done: false };
    const i = Number(d.screen_index ?? 0);
    if (r.event_type === "onboarding_view") s.views.add(i);
    if (r.event_type === "onboarding_skip") s.skip = i;
    if (r.event_type === "onboarding_leave" && s.leave === undefined) s.leave = i;
    if (r.event_type === "onboarding_complete") s.done = true;
    sessions.set(d.session, s);
  }
  const per = new Map<number, { index: number; views: number; skips: number; leaves: number }>();
  const slot = (i: number) => per.get(i) ?? per.set(i, { index: i, views: 0, skips: 0, leaves: 0 }).get(i)!;
  let completed = 0, skipped = 0, left = 0;
  for (const s of sessions.values()) {
    s.views.forEach((i) => slot(i).views++);
    if (s.done) completed++;
    else if (s.skip !== undefined) { skipped++; slot(s.skip).skips++; }
    else if (s.leave !== undefined) { left++; slot(s.leave).leaves++; }
  }
  return { started: sessions.size, completed, skipped, left, perScreen: [...per.values()].sort((a, b) => a.index - b.index) };
};
