/** Strongest role first — a person with several roles is shown by the most powerful one. */
const ROLE_RANK = ["admin", "editor", "premium", "free", "user"];

export function buildRoleMap(rows: { user_id: string; role: string }[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of rows) {
    const current = map.get(r.user_id);
    const rank = (role: string) => { const i = ROLE_RANK.indexOf(role); return i === -1 ? ROLE_RANK.length : i; };
    if (!current || rank(r.role) < rank(current)) map.set(r.user_id, r.role);
  }
  return map;
}

/** Premium or trial whose expiry date has passed counts as free. */
export function effectiveSubscription(subscription: string, expiry: string | null, now = Date.now()): string {
  const expired = !!expiry && new Date(expiry).getTime() < now;
  return (subscription === "premium" || subscription === "trial") && expired ? "free" : subscription;
}

export type UserFilterKey = "all" | "admin" | "editor" | "free" | "trial" | "premium_1_month" | "premium_6_months" | "premium_1_year";

export const USER_FILTERS: { key: UserFilterKey; label: string }[] = [
  { key: "all", label: "All users" },
  { key: "admin", label: "Admins" },
  { key: "editor", label: "Editors" },
  { key: "free", label: "Free" },
  { key: "trial", label: "Free trial" },
  { key: "premium_1_month", label: "Premium · 1 month" },
  { key: "premium_6_months", label: "Premium · 6 months" },
  { key: "premium_1_year", label: "Premium · 1 year" },
];

type Countable = { role: string; subscription: string; subscription_plan: string | null };

/** `subscription` must already be the effective one (expired plans count as free). */
export function matchesUserFilter(u: Countable, key: UserFilterKey): boolean {
  switch (key) {
    case "all": return true;
    case "admin": return u.role === "admin";
    case "editor": return u.role === "editor";
    case "free": return u.subscription === "free";
    case "trial": return u.subscription === "trial";
    case "premium_1_month": return u.subscription === "premium" && u.subscription_plan === "1_month";
    case "premium_6_months": return u.subscription === "premium" && u.subscription_plan === "6_months";
    case "premium_1_year": return u.subscription === "premium" && u.subscription_plan === "1_year";
  }
}

export function countUserFilters(users: Countable[]): Record<UserFilterKey, number> {
  const counts = Object.fromEntries(USER_FILTERS.map((f) => [f.key, 0])) as Record<UserFilterKey, number>;
  for (const u of users) for (const f of USER_FILTERS) if (matchesUserFilter(u, f.key)) counts[f.key]++;
  return counts;
}

/** Subscription tiers for the Manage Subscriptions page (roles are not part of it). */
export type TierFilterKey =
  | "all" | "free" | "trial" | "premium"
  | "premium_1_month" | "premium_3_months" | "premium_6_months" | "premium_1_year";

/** Premium plan stored in subscription_plan for each per-plan tier. */
const TIER_PLAN: Partial<Record<TierFilterKey, string>> = {
  premium_1_month: "1_month",
  premium_3_months: "3_months",
  premium_6_months: "6_months",
  premium_1_year: "1_year",
};

export const TIER_FILTERS: { key: TierFilterKey; label: string }[] = [
  { key: "all", label: "All users" },
  { key: "free", label: "Free" },
  { key: "trial", label: "Free trial" },
  { key: "premium", label: "All Premium" },
  { key: "premium_1_month", label: "Premium · 1 month" },
  { key: "premium_3_months", label: "Premium · 3 months" },
  { key: "premium_6_months", label: "Premium · 6 months" },
  { key: "premium_1_year", label: "Premium · 1 year" },
];

type TierCountable = { subscription: string; subscription_plan: string | null };

/** `subscription` must already be the effective one (expired plans count as free). */
export function matchesTierFilter(u: TierCountable, key: TierFilterKey): boolean {
  if (key === "all") return true;
  if (key === "free" || key === "trial" || key === "premium") return u.subscription === key;
  return u.subscription === "premium" && u.subscription_plan === TIER_PLAN[key];
}

export function countTierFilters(users: TierCountable[]): Record<TierFilterKey, number> {
  const counts = Object.fromEntries(TIER_FILTERS.map((f) => [f.key, 0])) as Record<TierFilterKey, number>;
  for (const u of users) for (const f of TIER_FILTERS) if (matchesTierFilter(u, f.key)) counts[f.key]++;
  return counts;
}
