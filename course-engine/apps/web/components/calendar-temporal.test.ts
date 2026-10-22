import { afterEach, describe, expect, it } from "vitest";
import {
  calendarDraftTemporal,
  calendarTemporalFields,
  InvalidLocalCalendarTime,
} from "./calendar-temporal";

const originalTimezone = process.env.TZ;

function inTimezone(zone: string, run: () => void) {
  process.env.TZ = zone;
  try {
    run();
  } finally {
    process.env.TZ = originalTimezone;
  }
}

const timedEvent = {
  start_at: "2026-01-15T09:00:00-05:00",
  end_at: "2026-01-15T10:30:00-05:00",
  event_date: undefined,
  all_day: false,
  time_unspecified: false,
};

describe("calendar device-time editing", () => {
  afterEach(() => {
    process.env.TZ = originalTimezone;
  });

  it("shows a stored instant in the device timezone instead of slicing its source offset", () => {
    inTimezone("America/Los_Angeles", () => {
      expect(calendarDraftTemporal(timedEvent)).toEqual({ date: "2026-01-15", time: "06:00" });
    });
    inTimezone("Asia/Kathmandu", () => {
      expect(calendarDraftTemporal(timedEvent)).toEqual({ date: "2026-01-15", time: "19:45" });
    });
  });

  it("preserves the exact stored range when non-temporal fields change", () => {
    inTimezone("America/Los_Angeles", () => {
      expect(calendarTemporalFields({ date: "2026-01-15", time: "06:00" }, timedEvent)).toEqual({
        start_at: "2026-01-15T09:00:00-05:00",
        end_at: "2026-01-15T10:30:00-05:00",
        event_date: null,
        all_day: false,
        time_unspecified: false,
      });
    });
  });

  it("preserves a stored instant whose source marks its time unspecified", () => {
    inTimezone("America/Los_Angeles", () => {
      const unspecified = { ...timedEvent, time_unspecified: true };
      expect(calendarTemporalFields(
        { date: "2026-01-15", time: "" },
        unspecified,
      )).toEqual({
        start_at: "2026-01-15T09:00:00-05:00",
        end_at: "2026-01-15T10:30:00-05:00",
        event_date: null,
        all_day: false,
        time_unspecified: true,
      });
    });
  });

  it("applies a changed wall time in the device timezone and preserves duration", () => {
    inTimezone("America/Los_Angeles", () => {
      expect(calendarTemporalFields({ date: "2026-07-15", time: "06:00" }, timedEvent)).toEqual({
        start_at: "2026-07-15T13:00:00.000Z",
        end_at: "2026-07-15T14:30:00.000Z",
        event_date: null,
        all_day: false,
        time_unspecified: false,
      });
    });
  });

  it("rejects a nonexistent DST-gap wall time instead of silently shifting it", () => {
    inTimezone("America/Los_Angeles", () => {
      expect(() => calendarTemporalFields(
        { date: "2026-03-08", time: "02:30" },
        timedEvent,
      )).toThrow(InvalidLocalCalendarTime);
    });
  });

  it("uses the platform's earlier-offset rule for an ambiguous fall-back time", () => {
    inTimezone("America/Los_Angeles", () => {
      expect(calendarTemporalFields(
        { date: "2026-11-01", time: "01:30" },
        timedEvent,
      ).start_at).toBe("2026-11-01T08:30:00.000Z");
    });
  });

  it("keeps date-only events date-only without inventing an instant", () => {
    inTimezone("Pacific/Auckland", () => {
      const dateOnly = {
        start_at: undefined,
        end_at: undefined,
        event_date: "2026-10-20",
        all_day: true,
        time_unspecified: true,
      };
      expect(calendarDraftTemporal(dateOnly)).toEqual({ date: "2026-10-20", time: "" });
      expect(calendarTemporalFields({ date: "2026-10-21", time: "" }, dateOnly)).toEqual({
        start_at: null,
        end_at: null,
        event_date: "2026-10-21",
        all_day: true,
        time_unspecified: true,
      });
    });
  });
});
