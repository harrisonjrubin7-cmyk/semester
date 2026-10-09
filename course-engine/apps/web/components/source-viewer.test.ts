import { describe, expect, it } from "vitest";
import { formatSourceLocation } from "./source-viewer";
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
});
