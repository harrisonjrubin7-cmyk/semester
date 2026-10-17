import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.resolve(process.cwd(), "app/tokens.css"), "utf8");
const typefaces = readFileSync(path.resolve(process.cwd(), "app/typefaces.css"), "utf8");

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

describe("Semester local typefaces", () => {
  it("serves every declared Latin and Latin Extended face with its license", () => {
    const files = [
      "Barlow-400",
      "Barlow-500",
      "Barlow-700",
      "BarlowCondensed-400",
      "BarlowCondensed-600",
      "Cinzel",
    ];

    for (const file of files) {
      for (const subset of ["latin", "latin-ext"]) {
        const filename = `${file}-${subset}.woff2`;
        expect(typefaces).toContain(`/fonts/${filename}`);
        expect(() => readFileSync(path.resolve(process.cwd(), "public/fonts", filename))).not.toThrow();
      }
    }
    expect(readFileSync(path.resolve(process.cwd(), "public/fonts/OFL.txt"), "utf8")).toContain(
      "SIL OPEN FONT LICENSE Version 1.1",
    );
  });
});
