import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.resolve(process.cwd(), "app/tokens.css"), "utf8");

describe("Semester semantic tokens", () => {
  it("keeps the canonical Ink, Parchment, and motion values", () => {
    expect(css).toContain("--ink-950: #090a0e");
    expect(css).toContain("--parchment-200: #f4f1ea");
    expect(css).toContain("--motion-hover: 130ms");
    expect(css).toContain("--motion-sheet: 280ms");
  });

  it("includes reduced-motion and forced-color contracts", () => {
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain("forced-colors: active");
  });
});
