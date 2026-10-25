import { describe, it, expect } from "vitest";
import {
  extractDevotionalJson, normalizeDevotional, rhapsodyAudioUrl, stripLeadingScripture, sanitizeDevotionalHtml, formatDevotionalDate,
} from "./rhapsodyDaily";

const sample = {
  date: "2026-10-25",
  article: {
    id: "F96805918806",
    title: "YOU DON'T GROW IN RIGHTEOUSNESS",
    upload_date: "2026-10-25",
    opening_scripture: "For if by one man's offence  death reigned by one (Romans 5:17).",
    content_body: "<p><strong>For if by one man's offence death reigned by one (</strong><a href=\"https://bibleapi.rhapsodyofrealities.org/x\">Romans 5:17</a>).</p><p>In Christianity, we grow spiritually. Tricky };</p><script>alert(1)</script>",
    option: "prayer",
    confession_or_prayer: "Dear Father...",
    further_study: "2 Corinthians 5:21",
    one_yearbb: "2 Timothy 1:1-18",
    two_yearbb: "Hebrews 12:14-29",
    photo_link: "https://example.com/a.jpg",
  },
};
const page = `<html><script>window.dailyDevotional = ${JSON.stringify(sample)};\nwindow.other = {};</script></html>`;

describe("Rhapsody Daily", () => {
  it("extracts the full devotional object even when the text contains '};'", () => {
    expect(extractDevotionalJson(page)?.article?.id).toBe("F96805918806");
  });

  it("returns null when the page has no devotional", () => {
    expect(extractDevotionalJson("<html></html>")).toBeNull();
  });

  it("builds the daily audio link from the article date", () => {
    expect(rhapsodyAudioUrl("2026-10-25")).toBe("https://roraudio.b-cdn.net/2026/october/25.mp3");
    expect(rhapsodyAudioUrl("2026-01-05")).toBe("https://roraudio.b-cdn.net/2026/january/5.mp3");
  });

  it("drops the repeated opening scripture from the body", () => {
    const body = stripLeadingScripture(sample.article.content_body, sample.article.opening_scripture);
    expect(body.startsWith("<p>In Christianity")).toBe(true);
  });

  it("removes scripts and opens links outside the app", () => {
    const html = sanitizeDevotionalHtml(sample.article.content_body);
    expect(html).not.toContain("<script");
    expect(html).toContain('target="_blank"');
  });

  it("normalises the article with date, prayer label and audio", () => {
    const d = normalizeDevotional(extractDevotionalJson(page))!;
    expect(d.date).toBe("2026-10-25");
    expect(d.prayerLabel).toBe("Prayer");
    expect(d.audioUrl).toBe("https://roraudio.b-cdn.net/2026/october/25.mp3");
    expect(formatDevotionalDate(d.date)).toBe("Sunday, October 25, 2026");
  });
});
