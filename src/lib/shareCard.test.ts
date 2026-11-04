import { describe, it, expect } from "vitest";
import { slugify, truncateTitle, cardLink, isLoveworldLink, cardFilename } from "./shareCard";

describe("shareCard", () => {
  it("builds safe slugs up to 60 characters", () => {
    expect(slugify("Forever Is Your Throne!")).toBe("forever-is-your-throne");
    expect(slugify("x".repeat(100)).length).toBe(60);
  });

  it("truncates long titles to 80 characters with an ellipsis", () => {
    const t = truncateTitle("word ".repeat(40));
    expect(t.length).toBeLessThanOrEqual(80);
    expect(t.endsWith("…")).toBe(true);
    expect(truncateTitle("Divinity")).toBe("Divinity");
  });

  it("builds a qr_card link per content type", () => {
    expect(cardLink({ kind: "song", id: "abc", title: "The Spirit Song" }))
      .toBe("https://loveworldmusickaraoke.com/library?song=abc&title=the-spirit-song&src=qr_card");
    expect(cardLink({ kind: "album", id: "a1", title: "x" })).toBe("https://loveworldmusickaraoke.com/albums?id=a1&src=qr_card");
    expect(cardLink({ kind: "playlist", id: "p1", title: "x" })).toBe("https://loveworldmusickaraoke.com/playlists?id=p1&src=qr_card");
  });

  it("accepts only https Loveworld hosts and content paths", () => {
    expect(isLoveworldLink("https://loveworldmusickaraoke.com/library?song=1")).toBe(true);
    expect(isLoveworldLink("https://www.loveworldmusickaraoke.com/albums?id=1")).toBe(true);
    expect(isLoveworldLink("https://loveworldmusickaraoke.com.attacker.com/library")).toBe(false);
    expect(isLoveworldLink("https://evil-loveworldmusickaraoke.com/library")).toBe(false);
    expect(isLoveworldLink("http://loveworldmusickaraoke.com/library")).toBe(false);
    expect(isLoveworldLink("https://loveworldmusickaraoke.com/admin")).toBe(false);
  });

  it("makes safe download filenames", () => {
    expect(cardFilename("../../Etc/Passwd?")).toBe("loveworld-music-etc-passwd.png");
    expect(cardFilename("")).toBe("loveworld-music-share.png");
  });
});
