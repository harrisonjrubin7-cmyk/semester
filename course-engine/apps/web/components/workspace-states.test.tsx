import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmptyState, ErrorState, LoadingState } from "./workspace-states";

describe("workspace operational states", () => {
  it("announces loading without spinner theater", () => {
    render(<LoadingState />);
    expect(screen.getByLabelText("Loading course workspace")).toHaveAttribute("aria-busy", "true");
  });

  it("explains an empty state", () => {
    render(<EmptyState detail="Add a source to continue." title="No materials" />);
    expect(screen.getByRole("heading", { name: "No materials" })).toBeInTheDocument();
    expect(screen.getByText("Add a source to continue.")).toBeInTheDocument();
  });

  it("offers a working retry after an error", () => {
    const retry = vi.fn();
    render(<ErrorState error="Network unavailable" retry={retry} />);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
