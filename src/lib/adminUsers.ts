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
