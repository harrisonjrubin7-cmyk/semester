import axe from "axe-core";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "./app-shell";
import { SourceStatusBadge } from "./source-status";

describe("course shell accessibility", () => {
  it("has no automated axe violations in its ready state", async () => {
    const { container } = render(
      <AppShell courseId="course-1" courseTitle="Research methods" mode="overview" offline={false} term="Fall 2026">
        <header><p className="eyebrow">Today</p><h1>Research methods</h1></header>
        <section aria-labelledby="status-heading"><h2 id="status-heading">Source status</h2><SourceStatusBadge status="needs_review" /></section>
      </AppShell>,
    );
    const result = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(result.violations).toEqual([]);
  }, 15_000);
});
