type CalendarTemporalSource = {
  start_at?: string | null;
  end_at?: string | null;
  event_date?: string | null;
  all_day?: boolean;
  time_unspecified: boolean;
};

type CalendarDraftTemporal = {
  date: string;
  time: string;
};

export type CalendarTemporalFields = {
  start_at: string | null;
  end_at: string | null;
  event_date: string | null;
  all_day: boolean;
  time_unspecified: boolean;
};

export class InvalidLocalCalendarTime extends Error {
  constructor() {
    super("This time does not exist in the device time zone because of a daylight-saving change.");
    this.name = "InvalidLocalCalendarTime";
  }
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function localParts(value: Date): CalendarDraftTemporal {
  return {
    date: `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`,
    time: `${pad2(value.getHours())}:${pad2(value.getMinutes())}`,
  };
}

function parseLocal(date: string, time: string): Date {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) throw new InvalidLocalCalendarTime();
  const [, year, month, day] = dateMatch.map(Number);
  const [, hour, minute] = timeMatch.map(Number);
  const instant = new Date(year, month - 1, day, hour, minute, 0, 0);
  const roundTrip = localParts(instant);
  if (roundTrip.date !== date || roundTrip.time !== time) {
    throw new InvalidLocalCalendarTime();
  }
  return instant;
}

export function calendarDraftTemporal(event: CalendarTemporalSource): CalendarDraftTemporal {
  if (event.event_date) return { date: event.event_date, time: "" };
  if (!event.start_at) return { date: "", time: "" };
  const start = new Date(event.start_at);
  if (Number.isNaN(start.getTime())) return { date: "", time: "" };
  return event.time_unspecified ? { ...localParts(start), time: "" } : localParts(start);
}

export function calendarTemporalFields(
  draft: CalendarDraftTemporal,
  original: CalendarTemporalSource,
): CalendarTemporalFields {
  const before = calendarDraftTemporal(original);
  const temporalChanged = before.date !== draft.date || before.time !== draft.time;
  if (!temporalChanged) {
    return {
      start_at: original.start_at ?? null,
      end_at: original.end_at ?? null,
      event_date: original.event_date ?? null,
      all_day: original.all_day ?? Boolean(original.event_date),
      time_unspecified: original.time_unspecified,
    };
  }

  const hasTime = Boolean(draft.date && draft.time);
  if (!hasTime) {
    return {
      start_at: null,
      end_at: null,
      event_date: draft.date || null,
      all_day: Boolean(draft.date),
      time_unspecified: Boolean(draft.date),
    };
  }

  const newStart = parseLocal(draft.date, draft.time);
  const originalDuration = original.start_at && original.end_at
    ? Date.parse(original.end_at) - Date.parse(original.start_at)
    : null;
  return {
    start_at: newStart.toISOString(),
    end_at: originalDuration === null
      ? null
      : new Date(newStart.getTime() + originalDuration).toISOString(),
    event_date: null,
    all_day: false,
    time_unspecified: false,
  };
}
