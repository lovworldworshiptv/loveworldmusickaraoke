import { describe, expect, it } from "vitest";
import { hasAuthCallback, parseConfirmLink, resendWaitSeconds } from "./emailLink";

describe("parseConfirmLink", () => {
  it("reads ?token_hash=&type=signup from our confirm email", () => {
    expect(parseConfirmLink("?token_hash=th1&type=signup", "")).toEqual({ kind: "token_hash", tokenHash: "th1", type: "signup" });
  });

  it("does not treat a recovery token as a sign-up confirmation", () => {
    expect(parseConfirmLink("?token_hash=th1&type=recovery", "")).toEqual({ kind: "none" });
  });

  it("reads session tokens from older links", () => {
    expect(parseConfirmLink("", "#access_token=a&refresh_token=r&type=signup")).toEqual({ kind: "tokens", accessToken: "a", refreshToken: "r" });
  });

  it("treats an expired-link error as expired", () => {
    expect(parseConfirmLink("", "#error=access_denied&error_code=otp_expired")).toEqual({ kind: "error" });
  });
});

describe("hasAuthCallback", () => {
  it("spots an expired verify link landing on the home page", () => {
    expect(hasAuthCallback("", "#error=access_denied&error_code=otp_expired")).toBe(true);
  });
  it("ignores a normal home page visit", () => {
    expect(hasAuthCallback("?invite=bob", "")).toBe(false);
  });
});

describe("resendWaitSeconds", () => {
  it("uses the wait time from the rate-limit message", () => {
    expect(resendWaitSeconds("For security purposes, you can only request this after 26 seconds.")).toBe(26);
  });
  it("defaults to 60 seconds", () => {
    expect(resendWaitSeconds(undefined)).toBe(60);
  });
});
