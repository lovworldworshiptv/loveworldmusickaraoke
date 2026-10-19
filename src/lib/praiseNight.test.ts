import { describe, expect, it } from "vitest";
import { praiseNightAlbums } from "./praiseNight";
describe("Praise Night collection", () => {
  it("includes every edition irrespective of case or spacing", () => {
    const titles = ["Praise Night With Pastor Chris 2", "PRAISE NIGHT  WITH PASTOR CHRIS 28", "Praise Night With Pastor Chris", "Other Praise Night 28"];
    expect(praiseNightAlbums(titles.map(title => ({ title }))).map(a => a.title)).toEqual([titles[1], titles[0], titles[2]]);
  });
  it("uses highest trailing edition cover, not creation date or text order", () => {
    const albums = [
      { title: "Praise Night With Pastor Chris 9", cover_url: "nine", created_at: "2026-10-19" },
      { title: 'Praise Night With Pastor Chris "28"', cover_url: "twenty-eight", created_at: "2025-01-01" },
      { title: "Praise Night With Pastor Chris 10", cover_url: "ten", created_at: "2026-10-18" },
    ];
    expect(praiseNightAlbums(albums)[0]?.cover_url).toBe("twenty-eight");
  });
  it("automatically selects a newly added higher edition", () => {
    expect(praiseNightAlbums([{ title: "Praise Night With Pastor Chris 28", cover_url: "28" }, { title: "Praise Night With Pastor Chris 29", cover_url: "29" }])[0]?.cover_url).toBe("29");
  });
});
