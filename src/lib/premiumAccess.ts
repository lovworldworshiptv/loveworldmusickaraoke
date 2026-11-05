import { canStartTrial } from "@/lib/trial";

/** One account's paid-access state, as read from the backend. */
export type Plan = {
  isPremium: boolean;
  isTrial: boolean;
  expiry: string | null;
  trialAvailable: boolean;
};

export const FREE_PLAN: Plan = { isPremium: false, isTrial: false, expiry: null, trialAvailable: false };

/** The account's subscription row: absent means the listener has never paid for anything. */
export type SubscriptionRow =
  | {
      subscription?: string | null;
      subscription_expiry_date?: string | null;
      trial_used_at?: string | null;
    }
  | null
  | undefined;

/** Turn the account's subscription row into a plan. No row, or an ended plan, is Free. */
export function planFromSubscriptionRow(row: SubscriptionRow, now = new Date()): Plan {
  const sub = row?.subscription;
  const expiry = row?.subscription_expiry_date ?? null;
  const expired = !!expiry && new Date(expiry) < now;
  const active = !expired && (sub === "premium" || sub === "trial");
  return {
    isPremium: active,
    isTrial: !expired && sub === "trial",
    expiry,
    trialAvailable: canStartTrial(row ?? null, now),
  };
}

/** A plan that has been read and trusted, or `null` while it is still unknown. */
export type PlanView = { isPremium: boolean; isTrial: boolean; resolved: boolean };

/**
 * Premium upsells — the gold "Upgrade to Premium" stripe and the full "Get
 * Premium" card — are for free listeners only: never Premium, never a trial,
 * and never while the account's plan is still unknown.
 */
export function seesPremiumUpsell(plan: PlanView): boolean {
  return plan.resolved && !plan.isPremium && !plan.isTrial;
}

/** Does this account belong to the audience the admin picked for a promo card? */
export function matchesPromoSegment(segment: string, plan: PlanView): boolean {
  if (!plan.resolved) return false;
  if (segment === "free") return seesPremiumUpsell(plan);
  if (segment === "trial") return plan.isTrial;
  if (segment === "premium") return plan.isPremium && !plan.isTrial;
  return true;
}
