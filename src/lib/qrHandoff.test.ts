import { describe, it, expect } from "vitest";
import { qrHandoff } from "./qrHandoff";

const ANDROID = "Mozilla/5.0 (Linux; Android 13; Pixel 7) Chrome/120 Mobile";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari";

describe("qrHandoff", () => {
  it("sends Android scans to the app intent with the full path and query", () => {
    expect(qrHandoff("/library", "?song=abc&src=qr_card", ANDROID, false)).toEqual({
      kind: "intent",
      url: "intent://loveworldmusickaraoke.com/library?song=abc&src=qr_card#Intent;scheme=https;package=com.loveworld.worship;end",
    });
  });
  it("shows the Get the app sheet on other phones", () => {
    expect(qrHandoff("/library", "?song=abc&src=qr_card", IPHONE, false)).toEqual({ kind: "sheet" });
  });
  it("does nothing without src=qr_card or inside the app", () => {
    expect(qrHandoff("/library", "?song=abc&src=whatsapp", ANDROID, false)).toBeNull();
    expect(qrHandoff("/library", "?src=qr_card", ANDROID, true)).toBeNull();
  });
});
