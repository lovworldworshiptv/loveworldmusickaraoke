import { describe, expect, it } from "vitest";
import QRCode from "qrcode";
import { isBadgeCell, isFinderCell, waveBars, type QrMatrix } from "@/lib/waveQr";

const grid = (rows: string[]): QrMatrix => ({ size: rows.length, get: (r, c) => rows[r][c] === "#" });

describe("waveBars", () => {
  it("merges dark modules in a column into one vertical bar", () => {
    const m = grid(Array.from({ length: 21 }, (_, r) => (r >= 9 && r <= 11 ? "#".padEnd(21, ".") : ".".repeat(21))));
    expect(waveBars(m, 0)).toEqual([{ col: 0, row: 9, length: 3 }]);
  });

  it("leaves the three corner finder patterns out of the bars", () => {
    const m = grid(Array.from({ length: 21 }, () => "#".repeat(21)));
    for (const b of waveBars(m, 0)) {
      for (let r = b.row; r < b.row + b.length; r++) expect(isFinderCell(21, r, b.col)).toBe(false);
    }
  });

  it("clears the centre emblem area", () => {
    const m = grid(Array.from({ length: 25 }, () => "#".repeat(25)));
    expect(waveBars(m).some((b) => b.col === 12 && b.row <= 12 && b.row + b.length > 12)).toBe(false);
    expect(isBadgeCell(25, 12, 12, 0.11)).toBe(true);
  });

  it("keeps every other dark module of a real code", () => {
    const qr = QRCode.create("https://loveworldmusickaraoke.com/library?song=abc", { errorCorrectionLevel: "H" });
    const n = qr.modules.size;
    const m: QrMatrix = { size: n, get: (r, c) => !!qr.modules.get(r, c) };
    const covered = new Set<string>();
    for (const b of waveBars(m)) for (let r = b.row; r < b.row + b.length; r++) covered.add(`${r},${b.col}`);
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        const expected = m.get(r, c) && !isFinderCell(n, r, c) && !isBadgeCell(n, r, c, 0.11);
        expect(covered.has(`${r},${c}`)).toBe(expected);
      }
  });
});
