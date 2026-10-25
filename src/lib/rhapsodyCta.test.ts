import { describe, it, expect } from "vitest";
import { rhapsodyCtaLink } from "./siteSettings";

const cta = { enabled: true, label: "Get Rhapsody App", url: "https://app.rhapsodyofrealities.org/", androidUrl: "https://play.google.com/store/apps/details?id=com.rhapsodyreader", iosUrl: "https://itunes.apple.com/app/id463739646" };

describe("rhapsodyCtaLink", () => {
  it("sends Android phones to Google Play", () => {
    expect(rhapsodyCtaLink(cta, "Mozilla/5.0 (Linux; Android 14)")).toBe(cta.androidUrl);
  });
  it("sends iPhones to the App Store", () => {
    expect(rhapsodyCtaLink(cta, "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe(cta.iosUrl);
  });
  it("sends computers to the main link", () => {
    expect(rhapsodyCtaLink(cta, "Mozilla/5.0 (Windows NT 10.0)")).toBe(cta.url);
  });
  it("hides the button when the admin turns it off", () => {
    expect(rhapsodyCtaLink({ ...cta, enabled: false }, "")).toBeNull();
  });
});
