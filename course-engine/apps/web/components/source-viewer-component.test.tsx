import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { SourceViewer } from "./source-viewer";

vi.mock("@/lib/api", () => ({ api: vi.fn(), API: "http://api.test", token: () => "token" }));

const mockedApi = vi.mocked(api);

describe("source correction", () => {
  beforeEach(() => mockedApi.mockReset());

  it("requires an explicit note and submits a confirmed reviewed correction", async () => {
    mockedApi.mockImplementation(async (path) => {
      if (path === "/files/file-1/source-view") return {
        document: { id: "file-1", filename: "notes.txt", classification: "reading", status: "needs_review", size_bytes: 100 },
        chunks: [{ id: "chunk-1", chunk_index: 0, content: "Original text", content_type: "paragraph", confidence: 0.9, review_item_id: "review-1" }],
        total: 1,
        offset: 0,
        limit: 50,
        has_more: false,
      } as never;
      return { status: "confirmed" } as never;
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(<QueryClientProvider client={client}><SourceViewer fileId="file-1" filename="notes.txt" onClose={vi.fn()} /></QueryClientProvider>);

    fireEvent.click(await screen.findByRole("button", { name: "Correct extraction" }));
    fireEvent.change(screen.getByLabelText("Corrected extraction"), { target: { value: "Corrected text" } });
    const submit = screen.getByRole("button", { name: "Confirm correction" });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Decision note/), { target: { value: "Checked against the original" } });
    fireEvent.click(submit);

    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith("/review-items/review-1", {
      method: "PATCH",
      body: JSON.stringify({
        status: "confirmed",
        resolution_note: "Checked against the original",
        corrected_payload: { content: "Corrected text" },
      }),
    }));
  });
});
