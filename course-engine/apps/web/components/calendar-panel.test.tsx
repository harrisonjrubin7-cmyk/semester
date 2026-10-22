import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { CalendarPanel } from "./calendar-panel";
import type { Event } from "./workspace-types";

vi.mock("@/lib/api", () => ({ api: vi.fn() }));

const mockedApi = vi.mocked(api);
const originalTimezone = process.env.TZ;
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
  beforeEach(() => {
    mockedApi.mockReset();
    process.env.TZ = "America/Los_Angeles";
  });

  afterEach(() => {
    process.env.TZ = originalTimezone;
  });

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

  it("shows a timed event in device time and preserves its instant for a title-only edit", async () => {
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
    expect(screen.getByLabelText(/^Time/)).toHaveValue("12:00");
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Updated midterm" } });
    fireEvent.click(screen.getByRole("button", { name: "Review changes" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply calendar change" }));
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith(
      "/calendar-events/event-1",
      expect.objectContaining({ body: expect.stringContaining('"start_at":"2026-10-20T14:00:00-05:00"') }),
    ));
  });

  it("shows a timed event on its device-local calendar day near midnight", () => {
    renderPanel({
      ...event,
      event_date: undefined,
      start_at: "2026-01-01T00:30:00+14:00",
      end_at: "2026-01-01T01:30:00+14:00",
      all_day: false,
      time_unspecified: false,
    });
    expect(screen.getByText("2025-12-31")).toBeInTheDocument();
  });

  it("hydrates across server and device timezones before showing the local day", async () => {
    const timedEvent = {
      ...event,
      event_date: undefined,
      start_at: "2026-01-01T01:00:00Z",
      end_at: "2026-01-01T02:00:00Z",
      all_day: false,
      time_unspecified: false,
    };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    process.env.TZ = "UTC";
    const html = renderToString(
      <QueryClientProvider client={client}><CalendarPanel courseId="course-1" events={[timedEvent]} /></QueryClientProvider>,
    );
    expect(html).toContain("Local date loading");

    process.env.TZ = "America/Los_Angeles";
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const root = hydrateRoot(
      container,
      <QueryClientProvider client={client}><CalendarPanel courseId="course-1" events={[timedEvent]} /></QueryClientProvider>,
    );
    await waitFor(() => expect(container).toHaveTextContent("2025-12-31"));
    expect(consoleError.mock.calls.flat().join(" ")).not.toMatch(/hydration|did not match/i);
    root.unmount();
    consoleError.mockRestore();
    container.remove();
  });

  it("blocks a nonexistent device-local DST time before any write", async () => {
    const timedEvent = {
      ...event,
      event_date: undefined,
      start_at: "2026-03-07T10:00:00-08:00",
      end_at: "2026-03-07T11:00:00-08:00",
      all_day: false,
      time_unspecified: false,
    };
    renderPanel(timedEvent);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-03-08" } });
    fireEvent.change(screen.getByLabelText(/^Time/), { target: { value: "02:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Review changes" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply calendar change" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/does not exist in the device time zone/i);
    expect(mockedApi).not.toHaveBeenCalled();
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
