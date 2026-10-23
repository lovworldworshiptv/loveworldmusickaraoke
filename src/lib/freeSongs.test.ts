import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { canUseSong, isFreeSong } from "./freeSongs";

const free = new Set(["free-1"]);

describe("free songs are open to free listeners", () => {
  it("a free listener can use a song the admin marked free, even when the list didn't pass the flag", () => {
    expect(canUseSong(false, { id: "free-1" }, free)).toBe(true);
  });

  it("a free listener can use a song carrying its own free flag", () => {
    expect(canUseSong(false, { id: "other", isFreeDownload: true }, new Set())).toBe(true);
  });

  it("a free listener cannot use a non-free song", () => {
    expect(canUseSong(false, { id: "paid-1", isFreeDownload: false }, free)).toBe(false);
  });

  it("a Premium listener can use any song", () => {
    expect(canUseSong(true, { id: "paid-1" }, free)).toBe(true);
  });

  it("no song means not free", () => {
    expect(isFreeSong(null, free)).toBe(false);
  });
});
