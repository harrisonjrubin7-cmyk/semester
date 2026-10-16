import { describe, expect, it } from "vitest";
import { formatExtractionConfidence, formatSourceLocation, normalizedBoundingBoxStyle } from "./source-viewer";
import type { SourceChunk } from "./workspace-types";

const chunk = (overrides: Partial<SourceChunk>): SourceChunk => ({
  id: "chunk-1",
  chunk_index: 0,
  content: "Evidence",
  content_type: "paragraph",
  confidence: 0.9,
  ...overrides,
});

describe("source locations", () => {
  it("preserves document-native page and spreadsheet locations", () => {
    expect(formatSourceLocation(chunk({ page_number: 4 }))).toBe("Page 4");
    expect(formatSourceLocation(chunk({ sheet_name: "Grades", cell_range: "B2:D9" }))).toBe("Grades · B2:D9");
  });

  it("formats media timestamps and provides a stable fallback", () => {
    expect(formatSourceLocation(chunk({ start_seconds: 65, end_seconds: 130 }))).toBe("1:05–2:10");
    expect(formatSourceLocation(chunk({ start_seconds: null, end_seconds: null }))).toBe("Extract 1");
    expect(formatSourceLocation(chunk({ chunk_index: 2 }))).toBe("Extract 3");
  });

  it("labels unmeasured extraction confidence without inventing a percentage", () => {
    expect(formatExtractionConfidence(null)).toBe("Extraction confidence not measured");
  });

  it("converts normalized source bounds to a contained percentage overlay", () => {
    expect(normalizedBoundingBoxStyle({
      coordinate_space: "normalized",
      x: 0.2,
      y: 0.25,
      width: 0.4,
      height: 0.1,
    })).toEqual({ left: "20%", top: "25%", width: "40%", height: "10%" });
    expect(normalizedBoundingBoxStyle({
      coordinate_space: "normalized",
      x: 0.9,
      y: 0.95,
      width: 0.5,
      height: 0.5,
    })).toEqual({ left: "90%", top: "95%", width: "10%", height: "5%" });
  });
});
