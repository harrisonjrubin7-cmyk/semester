import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { UploadPanel } from "./upload-panel";
import type { BackgroundJob, SourceFile } from "./workspace-types";

vi.mock("@/lib/api", () => ({
  API: "http://localhost:8000/api/v1",
  api: vi.fn(),
  token: vi.fn(() => "token"),
}));

const mockedApi = vi.mocked(api);
const file: SourceFile = {
  id: "file-1",
  filename: "syllabus.pdf",
  classification: "syllabus",
  status: "processing",
  size_bytes: 2048,
};

function job(overrides: Partial<BackgroundJob> = {}): BackgroundJob {
  return {
    id: "job-1",
    course_id: "course-1",
    document_id: file.id,
    job_type: "extract",
    status: "running",
    progress: 42,
    error: null,
    revoked_at: null,
    ...overrides,
  };
}

function renderPanel(jobs: BackgroundJob[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <UploadPanel courseId="course-1" files={[file]} jobs={jobs} offline={false} />
    </QueryClientProvider>,
  );
}

describe("upload job controls", () => {
  beforeEach(() => mockedApi.mockReset());

  it("shows live progress and lets the student cancel active extraction", async () => {
    mockedApi.mockResolvedValue(job({ status: "failed", error: "Cancelled by user" }));
    renderPanel([job()]);
    expect(screen.getByText("Extracting · 42%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel extraction for syllabus.pdf" }));
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith("/jobs/job-1/cancel", { method: "POST" }));
  });

  it("offers a retry for failed extraction and starts the replacement job", async () => {
    mockedApi.mockResolvedValue(job({ id: "job-2", status: "queued", progress: 0 }));
    renderPanel([job({ status: "failed", error: "Extractor unavailable" })]);
    expect(screen.getByText("Extractor unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry extraction for syllabus.pdf" }));
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith("/files/file-1/retry-extraction", { method: "POST" }));
  });
});
