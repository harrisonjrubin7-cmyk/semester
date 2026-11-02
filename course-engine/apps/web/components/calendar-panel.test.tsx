import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { CalendarPanel } from "./calendar-panel";
import type { Event } from "./workspace-types";

vi.mock("@/lib/api", () => ({ api: vi.fn() }));

const mockedApi = vi.mocked(api);
const event = {
  id: "event-1",
  title: "Midterm",
  event_type: "exam",
  event_date: "2026-10-20",
  status: "confirmed",
  time_unspecified: true,
};

function renderPanel(calendarEvent: Event = event) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><CalendarPanel courseId="course-1" events={[calendarEvent]} /></QueryClientProvider>);
}

describe("calendar editing", () => {
  beforeEach(() => mockedApi.mockReset());

  it("previews a change before saving and can undo it", async () => {
    mockedApi.mockResolvedValue(event);
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Final exam" } });
    fireEvent.click(screen.getByRole("button", { name: "Review changes" }));
    expect(screen.getByText("Consequence preview")).toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveTextContent("Final exam");
    fireEvent.click(screen.getByRole("button", { name: "Apply calendar change" }));
    await waitFor(() => expect(mockedApi).toHaveBeenNthCalledWith(1, "/calendar-events/event-1", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ title: "Final exam", event_type: "exam", start_at: null, end_at: null, event_date: "2026-10-20", all_day: true, time_unspecified: true, status: "confirmed" }),
    })));
    fireEvent.click(await screen.findByRole("button", { name: "Undo last change" }));
    await waitFor(() => expect(mockedApi).toHaveBeenNthCalledWith(2, "/calendar-events/event-1", expect.objectContaining({
      body: JSON.stringify({ title: "Midterm", event_type: "exam", start_at: null, end_at: null, event_date: "2026-10-20", all_day: true, time_unspecified: true, status: "confirmed" }),
    })));
  });

  it("keeps a blank time explicitly unspecified in the preview", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-10-21" } });
    fireEvent.click(screen.getByRole("button", { name: "Review changes" }));
    expect(screen.getByText(/blank time remains explicitly unspecified/i)).toBeInTheDocument();
  });

  it("restores the exact prior time range when undoing a timed event", async () => {
    const timedEvent = {
      ...event,
      event_date: undefined,
      start_at: "2026-10-20T14:00:00-05:00",
      end_at: "2026-10-20T15:30:00-05:00",
      all_day: false,
      time_unspecified: false,
    };
    mockedApi.mockResolvedValue(timedEvent);
    renderPanel(timedEvent);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Updated midterm" } });
    fireEvent.click(screen.getByRole("button", { name: "Review changes" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply calendar change" }));
    fireEvent.click(await screen.findByRole("button", { name: "Undo last change" }));
    await waitFor(() => expect(mockedApi).toHaveBeenNthCalledWith(2, "/calendar-events/event-1", expect.objectContaining({
      body: JSON.stringify({
        title: "Midterm",
        event_type: "exam",
        start_at: "2026-10-20T14:00:00-05:00",
        end_at: "2026-10-20T15:30:00-05:00",
        event_date: null,
        all_day: false,
        time_unspecified: false,
        status: "confirmed",
      }),
    })));
  });
});
