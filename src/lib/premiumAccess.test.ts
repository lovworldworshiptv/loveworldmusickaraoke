import { describe, it, expect } from "vitest";
import { planFromSubscriptionRow, seesPremiumUpsell, matchesPromoSegment } from "./premiumAccess";

const NOW = new Date("2026-11-05T13:36:00Z");
const plan = (row: Parameters<typeof planFromSubscriptionRow>[0]) => planFromSubscriptionRow(row, NOW);

describe("premium upsells are for free listeners only", () => {
  it("a paid 1-year Premium listener is never shown the upgrade stripe or card", () => {
    const p = plan({ subscription: "premium", subscription_expiry_date: "2027-11-03T15:39:50.185+00:00", trial_used_at: "2026-01-04T00:00:00Z" });
    expect(p.isPremium).toBe(true);
    expect(seesPremiumUpsell({ ...p, resolved: true })).toBe(false);
  });

  it("a trial listener is not shown the upgrade stripe or card either", () => {
    const p = plan({ subscription: "trial", subscription_expiry_date: "2026-11-08T11:58:33.425+00:00", trial_used_at: "2026-11-05T05:38:30Z" });
    expect(p.isTrial).toBe(true);
    expect(seesPremiumUpsell({ ...p, resolved: true })).toBe(false);
  });

  it("a free listener is shown them", () => {
    const p = plan({ subscription: "free", subscription_expiry_date: "2026-11-04T23:18:19.752+00:00", trial_used_at: null });
    expect(p.isPremium).toBe(false);
    expect(seesPremiumUpsell({ ...p, resolved: true })).toBe(true);
  });

  it("an account with no subscription row at all counts as free", () => {
    const p = plan(null);
    expect(seesPremiumUpsell({ ...p, resolved: true })).toBe(true);
  });

  it("an expired Premium plan is free again and sees the upgrade prompts", () => {
    const p = plan({ subscription: "premium", subscription_expiry_date: "2026-03-06T07:23:24.329+00:00", trial_used_at: "2026-01-04T00:00:00Z" });
    expect(p.isPremium).toBe(false);
    expect(seesPremiumUpsell({ ...p, resolved: true })).toBe(true);
  });

  it("nothing is shown while the plan is still unknown", () => {
    expect(seesPremiumUpsell({ isPremium: false, isTrial: false, resolved: false })).toBe(false);
    expect(matchesPromoSegment("free", { isPremium: false, isTrial: false, resolved: false })).toBe(false);
  });

  it("promo cards aimed at free listeners skip Premium and trial accounts", () => {
    const premium = plan({ subscription: "premium", subscription_expiry_date: "2027-11-03T15:39:50.185+00:00", trial_used_at: null });
    const trial = plan({ subscription: "trial", subscription_expiry_date: "2026-11-08T11:58:33.425+00:00", trial_used_at: "2026-11-05T05:38:30Z" });
    const free = plan({ subscription: "free", subscription_expiry_date: null, trial_used_at: null });
    expect(matchesPromoSegment("free", { ...premium, resolved: true })).toBe(false);
    expect(matchesPromoSegment("free", { ...trial, resolved: true })).toBe(false);
    expect(matchesPromoSegment("free", { ...free, resolved: true })).toBe(true);
    expect(matchesPromoSegment("premium", { ...premium, resolved: true })).toBe(true);
    expect(matchesPromoSegment("premium", { ...trial, resolved: true })).toBe(false);
  });
});
