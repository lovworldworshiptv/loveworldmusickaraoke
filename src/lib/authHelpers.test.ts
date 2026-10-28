import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("@/lib/acquisitionAnalytics", () => ({ captureShareSource: vi.fn(), logReferralSignup: vi.fn() }));

import { buildInviteUrl, inviteCodeFromSearch } from "./platformReferral";
import { applyRememberMe, getRememberedEmail, shouldForgetSession } from "./rememberMe";

describe("invite links", () => {
  it("always use the production domain and carry the exact account reference", () => {
    expect(buildInviteUrl("Grace A", "abc-123")).toBe("https://loveworldmusickaraoke.com/auth?invite=Grace+A&ref=abc-123");
  });
  it("prefer the account reference over the name", () => {
    expect(inviteCodeFromSearch("?invite=Grace&ref=abc-123")).toBe("abc-123");
    expect(inviteCodeFromSearch("?invite=Grace")).toBe("Grace");
    expect(inviteCodeFromSearch("?x=1")).toBeNull();
  });
});

describe("remember me", () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
  it("drops the sign-in after the browser is closed when off", () => {
    applyRememberMe(false, "a@b.com");
    expect(shouldForgetSession()).toBe(false); // same browser session
    sessionStorage.clear(); // browser closed
    expect(shouldForgetSession()).toBe(true);
    expect(getRememberedEmail()).toBe("");
  });
  it("keeps the sign-in and the email when on", () => {
    applyRememberMe(true, "a@b.com");
    sessionStorage.clear();
    expect(shouldForgetSession()).toBe(false);
    expect(getRememberedEmail()).toBe("a@b.com");
  });
});
