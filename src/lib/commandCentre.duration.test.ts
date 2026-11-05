import { describe, it, expect } from "vitest";
import { formatDuration } from "./commandCentre";
describe("formatDuration", () => {
  it("formats seconds, minutes, hours, days", () => {
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(720)).toBe("12m");
    expect(formatDuration(3 * 3600 + 5 * 60)).toBe("3h 05m");
    expect(formatDuration(2 * 86400 + 4 * 3600)).toBe("2d 4h");
  });
});
