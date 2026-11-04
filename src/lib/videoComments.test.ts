import { describe, it, expect } from "vitest";
import { linkifyComment, relativeTime } from "./videoComments";

describe("video comments", () => {
  it("links only loveworldmusickaraoke.com", () => {
    const p = linkifyComment("see https://loveworldmusickaraoke.com/library and https://evil.com/x");
    expect(p.filter((x) => x.href).map((x) => x.href)).toEqual(["https://loveworldmusickaraoke.com/library"]);
  });
  it("keeps html as plain text", () => {
    expect(linkifyComment("<b>hi</b>")).toEqual([{ text: "<b>hi</b>" }]);
  });
  it("formats relative time", () => {
    const now = Date.parse("2026-01-01T12:00:00Z");
    expect(relativeTime("2026-01-01T11:55:00Z", now)).toBe("5m ago");
    expect(relativeTime("2026-01-01T11:59:50Z", now)).toBe("just now");
  });
});
