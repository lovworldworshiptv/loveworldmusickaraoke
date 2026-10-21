import { describe, expect, it } from "vitest";
import { fetchAllRows } from "./fetchAll";

const table = Array.from({ length: 1039 }, (_, i) => ({ id: i }));
const page = (from: number, to: number) => Promise.resolve({ data: table.slice(from, to + 1), error: null });

describe("fetchAllRows", () => {
  it("returns all 1,039 songs, not just the first 1,000", async () => {
    const rows = await fetchAllRows(page);
    expect(rows).toHaveLength(1039);
    expect(rows[1038]).toEqual({ id: 1038 });
  });

  it("stops after one request when the list is shorter than a page", async () => {
    let calls = 0;
    const rows = await fetchAllRows((f, t) => { calls++; return Promise.resolve({ data: table.slice(0, 12).slice(f, t + 1), error: null }); });
    expect(rows).toHaveLength(12);
    expect(calls).toBe(1);
  });

  it("throws when a page fails", async () => {
    await expect(fetchAllRows(() => Promise.resolve({ data: null, error: new Error("boom") }))).rejects.toThrow("boom");
  });
});
