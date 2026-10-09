import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "./app-shell";

describe("AppShell", () => {
  it("marks the current destination and exposes labeled mobile navigation", () => {
    render(<AppShell courseId="course-1" courseTitle="Methods" mode="overview" offline={false} term="Fall 2026"><h1>Workspace</h1></AppShell>);
    expect(screen.getByRole("navigation", { name: "Course navigation" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Mobile navigation" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Today/ })[0]).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("main")).toHaveTextContent("Workspace");
  });

  it("opens by keyboard, focuses search, and closes with Escape", async () => {
    render(<AppShell courseId="course-1" courseTitle="Methods" mode="overview" offline={false}><p>Body</p></AppShell>);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    const dialog = screen.getByRole("dialog", { name: "Navigate Semester" });
    expect(dialog).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Search destinations" })).toHaveFocus());
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("announces offline behavior", () => {
    render(<AppShell courseId="course-1" courseTitle="Methods" mode="uploads" offline><p>Body</p></AppShell>);
    expect(screen.getByRole("status")).toHaveTextContent("Offline");
    expect(screen.getByText("Changes pending")).toBeInTheDocument();
  });
});
