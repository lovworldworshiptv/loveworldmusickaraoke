import { describe, expect, it } from "vitest";
import { socialShareUrl } from "./socialShare";

const link = "https://loveworldmusickaraoke.com/library?song=abc&src=whatsapp";
const text = "Listen to \"Grace\" on Loveworld Music+";

describe("socialShareUrl", () => {
  it("KingsChat uses the /share composer with the link in the text", () => {
    const u = new URL(socialShareUrl("kingschat", link, text));
    expect(u.origin + u.pathname).toBe("https://kingschat.online/share");
    expect(u.searchParams.get("text")).toBe(`${text}\n${link}`);
  });

  it("X uses x.com/intent/post with the link inside text", () => {
    const u = new URL(socialShareUrl("x", link, text));
    expect(u.origin + u.pathname).toBe("https://x.com/intent/post");
    expect(u.searchParams.get("text")).toBe(`${text}\n${link}`);
    expect(u.searchParams.has("url")).toBe(false);
  });

  it("WhatsApp keeps the song link intact", () => {
    const u = new URL(socialShareUrl("whatsapp", link, text));
    expect(u.host).toBe("wa.me");
    expect(u.searchParams.get("text")).toBe(`${text}\n${link}`);
  });

  it("Facebook and Telegram receive the exact link", () => {
    expect(new URL(socialShareUrl("facebook", link, text)).searchParams.get("u")).toBe(link);
    const t = new URL(socialShareUrl("telegram", link, text));
    expect(t.origin + t.pathname).toBe("https://t.me/share/url");
    expect(t.searchParams.get("url")).toBe(link);
  });
});
