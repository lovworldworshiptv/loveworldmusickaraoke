import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TiltedGamePhoto } from "./GameHubCard";

afterEach(cleanup);

describe("tilted game artwork loading", () => {
  it("loads immediately with stable dimensions and asynchronous decoding", () => {
    render(<TiltedGamePhoto imageUrl="/custom.jpg" fallbackImageUrl="/fallback.webp" title="Music" />);
    expect(screen.getByRole("img")).toHaveAttribute("loading", "eager");
    expect(screen.getByRole("img")).toHaveAttribute("decoding", "async");
    expect(screen.getByRole("img")).toHaveAttribute("width", "384");
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveClass("is-leaning");
  });
  it("falls back without retry loops and accepts a new CMS photo", () => {
    const { rerender } = render(<TiltedGamePhoto imageUrl="/broken.jpg" fallbackImageUrl="/fallback.webp" title="Articles" />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByRole("img")).toHaveAttribute("src", "/fallback.webp");
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByRole("img")).toHaveAttribute("src", "/fallback.webp");
    rerender(<TiltedGamePhoto imageUrl="/new.jpg" fallbackImageUrl="/fallback.webp" title="Articles" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "/new.jpg");
  });
  it("uses the fallback for blank photos", () => {
    render(<TiltedGamePhoto imageUrl=" " fallbackImageUrl="/fallback.webp" title="Challenge" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "/fallback.webp");
  });
});