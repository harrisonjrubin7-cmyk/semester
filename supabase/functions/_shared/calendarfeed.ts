export interface CalendarFeedRow {
  body?: unknown;
  name?: unknown;
  updated_at?: unknown;
}

export interface CalendarFeedDeps {
  readFeed(token: string, family: string): Promise<{
    data: CalendarFeedRow | readonly CalendarFeedRow[] | null;
    error: unknown;
  }>;
}

/** 24 random bytes as hex — the same shape `app/src/lib/subscribe.ts` generates. */
const TOKEN = /^[0-9a-f]{48}$/;

const FAMILY: readonly (readonly [RegExp, string])[] = [
  [/CalendarAgent|dataaccessd|ICSAgent|CoreDAV|accountsd/i, 'apple'],
  [/Google-Calendar|Googlebot|Google Calendar/i, 'google'],
  [/Outlook|Microsoft|MSOffice|Office\//i, 'outlook'],
  [/Gecko|WebKit|Chrome|Safari|Firefox|Edg\//i, 'browser'],
];

function familyOf(userAgent: string | null): string {
  const ua = (userAgent ?? '').trim();
  if (!ua) return 'unknown';
  for (const [pattern, family] of FAMILY) if (pattern.test(ua)) return family;
  return 'other';
}

const HEADERS: Record<string, string> = {
  'Content-Type': 'text/calendar; charset=utf-8',
  'Cache-Control': 'private, max-age=3600',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

function empty(name = 'Semester'): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Semester//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${name}`,
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

function attachment(name: string): string {
  const clean = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `inline; filename="${clean || 'semester'}.ics"`;
}

const unavailable = () => new Response(empty(), { status: 404, headers: HEADERS });

export async function handleCalendarFeed(req: Request, deps: CalendarFeedDeps | null): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  if (!deps) return new Response(empty(), { status: 503, headers: HEADERS });

  const token = new URL(req.url).pathname.split('/').filter(Boolean).pop() ?? '';
  if (!TOKEN.test(token)) return unavailable();

  try {
    const { data: rows, error } = await deps.readFeed(token, familyOf(req.headers.get('user-agent')));
    const data = Array.isArray(rows) ? rows[0] : rows;
    if (error || !data || typeof data.body !== 'string' || data.body === '') return unavailable();

    const name = typeof data.name === 'string' && data.name ? data.name : 'Semester';
    const updated = typeof data.updated_at === 'string' || typeof data.updated_at === 'number'
      ? new Date(data.updated_at)
      : null;
    const headers = {
      ...HEADERS,
      'Content-Disposition': attachment(name),
      ...(updated && !Number.isNaN(updated.valueOf()) ? { 'Last-Modified': updated.toUTCString() } : {}),
    };
    return new Response(req.method === 'HEAD' ? null : data.body, { status: 200, headers });
  } catch {
    // A database failure and a missing token remain indistinguishable to the link holder.
    return unavailable();
  }
}
