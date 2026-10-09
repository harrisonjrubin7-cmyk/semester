import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { ReviewPanel } from "./review-panel";

vi.mock("@/lib/api", () => ({ api: vi.fn() }));

const mockedApi = vi.mocked(api);
const review = {
  id: "review-1",
  title: "Confirm assignment date",
  item_type: "date_conflict",
  status: "needs_review",
  payload: { due_date: "2026-10-20" },
};

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><ReviewPanel courseId="course-1" reviews={[review]} /></QueryClientProvider>);
}

describe("review resolution", () => {
  beforeEach(() => mockedApi.mockReset());

  it("submits corrected structured details with a confirmation decision", async () => {
    mockedApi.mockResolvedValue({ ...review, status: "confirmed" });
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Correct details" }));
    fireEvent.change(screen.getByLabelText("Corrected details"), { target: { value: '{"due_date":"2026-10-22"}' } });
    fireEvent.change(screen.getByLabelText(/Decision note/), { target: { value: "Checked against page 4" } });
    fireEvent.click(screen.getByRole("button", { name: "Save correction and confirm" }));
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith("/review-items/review-1", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ status: "confirmed", resolution_note: "Checked against page 4", corrected_payload: { due_date: "2026-10-22" } }),
    })));
  });

  it("blocks malformed correction payloads before the API call", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Correct details" }));
    fireEvent.change(screen.getByLabelText("Corrected details"), { target: { value: "not-json" } });
    fireEvent.click(screen.getByRole("button", { name: "Save correction and confirm" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/JSON/);
    expect(mockedApi).not.toHaveBeenCalled();
  });
});
