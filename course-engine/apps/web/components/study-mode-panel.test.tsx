import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, download } from "@/lib/api";
import { StudyModePanel } from "./study-mode-panel";
import type { Asset } from "./workspace-types";

vi.mock("@/lib/api", () => ({ api: vi.fn(), download: vi.fn() }));

const mockedApi = vi.mocked(api);
const mockedDownload = vi.mocked(download);
const citationId = "00000000-0000-0000-0000-000000000010";
const baseAsset: Asset = {
  id: "00000000-0000-0000-0000-000000000020",
  asset_type: "comprehensive_guide",
  title: "Evidence guide",
  status: "confirmed",
  generation_version: 2,
  updated_at: "2026-10-11T12:00:00Z",
  content: {
    sections: [{ heading: "Coordination", explanation: "Roles shape the decision path.", key_points: ["Name an owner."], examples: [], citation_ids: [citationId] }],
    citations: { [citationId]: { label: "syllabus.pdf, p. 4", quote: "Roles shape the decision path." } },
  },
};

function renderPanel(mode: string, asset: Asset) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><StudyModePanel assets={[asset]} courseId="course-1" mode={mode} /></QueryClientProvider>);
}

describe("stored study asset interactions", () => {
  beforeEach(() => { mockedApi.mockReset(); mockedDownload.mockReset(); });

  it("reveals a cited card and records the student's recall", async () => {
    mockedApi.mockResolvedValue({ id: "progress-1" });
    renderPanel("cards", { ...baseAsset, asset_type: "flashcards", content: {
      cards: [{ id: "00000000-0000-0000-0000-000000000030", front: "Who owns the decision?", back: "The named role.", difficulty: 3, citation_ids: [citationId] }],
      citations: baseAsset.content.citations,
    } });
    fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
    expect(screen.getByText("The named role.")).toBeInTheDocument();
    expect(screen.getByText("syllabus.pdf, p. 4")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "I recalled it" }));
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith(
      "/flashcards/00000000-0000-0000-0000-000000000030/review",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ course_id: "course-1", asset_id: baseAsset.id, concept_id: null, correct: true, confidence: 3 }) }),
    ));
  });

  it("renders stored guide sections and source labels instead of raw JSON", () => {
    renderPanel("read", baseAsset);
    expect(screen.getByRole("heading", { name: "Coordination" })).toBeInTheDocument();
    expect(screen.getByText("Roles shape the decision path.")).toBeInTheDocument();
    expect(screen.getByText("Name an owner.")).toBeInTheDocument();
    expect(screen.queryByText(/citation_ids/)).not.toBeInTheDocument();
  });

  it("renders a citation-bound field guide as connected concepts instead of raw JSON", () => {
    renderPanel("field-guide", { ...baseAsset, asset_type: "concept_map", content: {
      sections: [{
        heading: "Role clarity",
        explanation: "Defined ownership reduces coordination ambiguity.",
        key_points: ["Role clarity supports accountability.", "Accountability clarifies escalation."],
        examples: ["A decision owner resolves final tradeoffs."],
        citation_ids: [citationId],
      }],
      citations: baseAsset.content.citations,
    } });

    expect(screen.getByText((_content, element) => element?.tagName === "P" && element.textContent === "1 cited concept")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Role clarity" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Connections" })).toBeInTheDocument();
    expect(screen.getByText("Role clarity supports accountability.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "In context" })).toBeInTheDocument();
    expect(screen.getByText("A decision owner resolves final tradeoffs.")).toBeInTheDocument();
    expect(screen.getByText("syllabus.pdf, p. 4")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open material" })).not.toBeInTheDocument();
    expect(screen.queryByText(/citation_ids/)).not.toBeInTheDocument();
  });

  it("fails closed when a field-guide concept has no resolvable citation", () => {
    renderPanel("field-guide", { ...baseAsset, asset_type: "glossary", content: {
      sections: [{ heading: "Uncited term", explanation: "This must not render.", citation_ids: ["missing-citation"] }],
      citations: {},
    } });

    expect(screen.getByRole("status")).toHaveTextContent("no valid cited concepts");
    expect(screen.queryByRole("heading", { name: "Uncited term" })).not.toBeInTheDocument();
  });

  it("renders a citation-bound lecture outline as reviewable slides", () => {
    renderPanel("slides", { ...baseAsset, asset_type: "lecture_outline", title: "Coordination lecture", content: {
      sections: [{
        heading: "Decision ownership",
        explanation: "A named owner keeps the decision path legible.",
        key_points: ["Separate input from final authority.", "Publish the escalation path."],
        examples: ["A product lead owns the launch decision."],
        citation_ids: [citationId],
      }],
      citations: baseAsset.content.citations,
    } });

    expect(screen.getByText((_content, element) => element?.tagName === "P" && element.textContent === "1 cited slide")).toBeInTheDocument();
    expect(screen.getByText("Slide 1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Decision ownership" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Key points" })).toBeInTheDocument();
    expect(screen.getByText("Separate input from final authority.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Examples" })).toBeInTheDocument();
    expect(screen.getByText("A product lead owns the launch decision.")).toBeInTheDocument();
    expect(screen.getByText("syllabus.pdf, p. 4")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open material" })).not.toBeInTheDocument();
  });

  it("fails closed when a lecture-outline slide has no resolvable citation", () => {
    renderPanel("slides", { ...baseAsset, asset_type: "lecture_outline", content: {
      sections: [{ heading: "Uncited slide", explanation: "This must not render.", citation_ids: [] }],
      citations: baseAsset.content.citations,
    } });

    expect(screen.getByRole("status")).toHaveTextContent("no valid cited slides");
    expect(screen.queryByRole("heading", { name: "Uncited slide" })).not.toBeInTheDocument();
  });

  it("rejects malformed optional guide lists instead of crashing the panel", () => {
    renderPanel("read", { ...baseAsset, content: {
      ...baseAsset.content,
      sections: [{
        heading: "Malformed",
        explanation: "This should not render.",
        key_points: { unexpected: true },
        citation_ids: [citationId],
      }],
    } });

    expect(screen.getByRole("status")).toHaveTextContent("no valid cited sections");
    expect(screen.queryByRole("heading", { name: "Malformed" })).not.toBeInTheDocument();
  });

  it("downloads a confirmed document through the authenticated export helper", async () => {
    mockedDownload.mockResolvedValue();
    renderPanel("doc", baseAsset);
    fireEvent.click(screen.getByRole("button", { name: "Download DOCX" }));
    await waitFor(() => expect(mockedDownload).toHaveBeenCalledWith(`/study-assets/${baseAsset.id}/exports/docx`));
  });

  it("records a quiz only after every cited prompt is self-graded", async () => {
    mockedApi.mockResolvedValue({ id: "session-1", recorded: true, answer_count: 1 });
    renderPanel("quiz", { ...baseAsset, asset_type: "practice_quiz" });
    const finish = screen.getByRole("button", { name: "Finish quiz" });
    expect(finish).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Reveal cited answer" }));
    fireEvent.click(screen.getByRole("button", { name: "I got it" }));
    expect(finish).toBeEnabled();
    fireEvent.click(finish);
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith(`/quizzes/${baseAsset.id}/attempts`, expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ course_id: "course-1", answers: [{ question_index: 0, correct: true }] }),
    })));
    expect(await screen.findByText("Your self-graded attempt was recorded.")).toBeInTheDocument();
  });

  it("does not offer rejected assets for interactive study", () => {
    renderPanel("quiz", { ...baseAsset, asset_type: "practice_quiz", status: "rejected" });
    expect(screen.getByRole("heading", { name: "No quiz asset yet" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reveal cited answer" })).not.toBeInTheDocument();
  });
});
