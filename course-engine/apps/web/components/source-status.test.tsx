import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SourceStatusBadge, sourceStatus } from "./source-status";

describe("source status vocabulary", () => {
  it("uses words and a glyph for review state", () => {
    render(<SourceStatusBadge status="needs_review" />);
    const badge = screen.getByText("Needs review").closest("span.status-chip");
    expect(badge).toHaveAttribute("data-tone", "warning");
    expect(badge?.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("turns unknown machine values into readable neutral labels", () => {
    expect(sourceStatus("awaiting_ocr")).toMatchObject({ label: "awaiting ocr", tone: "neutral" });
  });
});
