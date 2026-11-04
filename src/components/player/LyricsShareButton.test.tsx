import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import LyricsShareButton, { lyricsMessage } from "./LyricsShareButton";

const song = { id: "s1", title: "Grace", artist: "Loveworld Singers" };

describe("LyricsShareButton", () => {
  it("free listeners get the upgrade offer instead of copy/share", () => {
    const onUpgrade = vi.fn();
    render(<LyricsShareButton song={song} lyrics={"Line one\nLine two"} isPremium={false} onUpgrade={onUpgrade} />);
    fireEvent.click(screen.getByRole("button", { name: /premium/i }));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Copy lyrics")).toBeNull();
  });

  it("Premium listeners can open copy and share options", () => {
    const onUpgrade = vi.fn();
    render(<LyricsShareButton song={song} lyrics={"Line one"} isPremium onUpgrade={onUpgrade} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy or share lyrics" }));
    expect(screen.getByText("Copy lyrics")).toBeTruthy();
    expect(screen.getByText("Share lyrics")).toBeTruthy();
    expect(onUpgrade).not.toHaveBeenCalled();
  });

  it("the shared message carries the title, artist and lyrics", () => {
    expect(lyricsMessage("Grace", "Loveworld Singers", "  Line one\nLine two  ")).toBe('"Grace" — Loveworld Singers\n\nLine one\nLine two');
  });
});
