import { describe, expect, it } from "vitest";
import { parseResetLink } from "./resetLink";

describe("parseResetLink", () => {
  it("reads access and refresh tokens from the hash", () => {
    expect(parseResetLink("", "#access_token=abc&refresh_token=def&type=recovery")).toEqual({
      kind: "tokens", accessToken: "abc", refreshToken: "def",
    });
  });

  it("reads ?code=", () => {
    expect(parseResetLink("?code=xyz", "")).toEqual({ kind: "code", code: "xyz" });
  });

  it("reads ?token_hash=&type=recovery", () => {
    expect(parseResetLink("?token_hash=th1&type=recovery", "")).toEqual({ kind: "token_hash", tokenHash: "th1" });
  });

  it("ignores token_hash for other link types", () => {
    expect(parseResetLink("?token_hash=th1&type=signup", "")).toEqual({ kind: "none" });
  });

  it("treats error parameters in the hash or query as expired", () => {
    expect(parseResetLink("", "#error=access_denied&error_code=otp_expired")).toEqual({ kind: "error" });
    expect(parseResetLink("?error_description=Link+expired", "")).toEqual({ kind: "error" });
    expect(parseResetLink("?code=xyz&error_code=bad", "")).toEqual({ kind: "error" });
  });

  it("returns none for an empty address", () => {
    expect(parseResetLink("", "")).toEqual({ kind: "none" });
  });
});
