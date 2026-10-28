/** Free-trial rules: one trial per account, ever. The database enforces this too. */
export type TrialState = {
  subscription: string | null | undefined;
  subscription_expiry_date: string | null | undefined;
  trial_used_at: string | null | undefined;
};

export const TRIAL_PLAN_ID = "3_day_trial";

/** True while a premium or trial subscription has not yet expired. */
export function hasActivePremium(s: Pick<TrialState, "subscription" | "subscription_expiry_date"> | null | undefined, now = new Date()): boolean {
  if (!s) return false;
  if (s.subscription !== "premium" && s.subscription !== "trial") return false;
  return !s.subscription_expiry_date || new Date(s.subscription_expiry_date) > now;
}

/** A trial can start only if the account has never used one and isn't already premium. */
export function canStartTrial(s: TrialState | null | undefined, now = new Date()): boolean {
  if (s?.trial_used_at) return false;
  if (s?.subscription === "trial") return false;
  return !hasActivePremium(s, now);
}

/** Plans the listener may pick: the trial disappears once it has been used or while premium. */
export function availablePlans<T extends { id: string }>(plans: T[], s: TrialState | null | undefined, now = new Date()): T[] {
  return canStartTrial(s, now) ? plans : plans.filter((p) => p.id !== TRIAL_PLAN_ID);
}
