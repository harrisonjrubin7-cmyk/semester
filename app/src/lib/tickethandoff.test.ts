import { describe, expect, it } from 'vitest';
import { HEADING, LABELS, NEVER_ATTACHED, device, handoff, lines, withHandoff, type HandoffInput } from './tickethandoff';

const NOW = Date.UTC(2026, 8, 28, 12);

const input: HandoffInput = {
  hash: '#/calendar/evt-123',
  action: 'Subscribe to the department calendar',
  lastError: { at: NOW - 3 * 60_000, kind: 'error', message: 'The feed could not be read.', screen: 'calendar' },
  reference: 'SEM-0A1F',
  userAgent: 'Mozilla/5.0 (iPhone) AppleWebKit/605 (KHTML, like Gecko) Version/17 Mobile Safari/604',
  width: 390,
  saved: 'On this device only',
  sources: [{ name: 'Department calendar', state: 'last synced 2 hours ago' }],
  now: NOW,
};

describe('the support handoff', () => {
  it('carries the seven things the brief lists, and no more', () => {
    const h = handoff(input);
    expect(Object.keys(h)).toEqual(['route', 'action', 'reference', 'device', 'error', 'saved', 'sources']);
    expect(h.route).toBe('#/calendar');
    expect(h.reference).toBe('SEM-0A1F');
    expect(h.device).toBe('Safari, phone');
    expect(h.error).toBe('Error on calendar, 3 minutes ago: The feed could not be read.');
    expect(h.sources).toBe('Department calendar: last synced 2 hours ago');
  });

  it('keeps the route to a shape: the event id never travels', () => {
    expect(handoff(input).route).not.toContain('evt-123');
    expect(handoff({ ...input, hash: '' }).route).toBe('unknown');
  });

  it('says so when there is nothing, rather than leaving a blank', () => {
    const h = handoff({ ...input, action: '  ', lastError: null, reference: null, sources: [], saved: '' });
    expect(h.action).toBe('not said');
    expect(h.error).toBe('none logged on this device');
    expect(h.reference).toBe('none shown');
    expect(h.sources).toBe('none connected');
    expect(h.saved).toBe('unknown');
  });

  it('reduces the user agent to a family and a class', () => {
    expect(device('Mozilla/5.0 (X11; Linux) Gecko Firefox/130', 1400)).toBe('Firefox, desktop');
    expect(device('Mozilla/5.0 Chrome/120 Safari/537 Edg/120', 800)).toBe('Edge, tablet');
    expect(device('Mozilla/5.0 Chrome/120 Safari/537', 800)).toBe('Chrome, tablet');
    expect(device('something else', 300)).toBe('Browser, phone');
  });

  it('appends the labelled lines under a heading, after the student’s words', () => {
    const h = handoff(input);
    const text = withHandoff('  It will not subscribe.  ', h);
    expect(text.startsWith('It will not subscribe.\n\n' + HEADING + '\n')).toBe(true);
    for (const l of lines(h)) expect(text).toContain(l);
    expect(lines(h)[0]).toBe(`${LABELS.route}: #/calendar`);
    expect(withHandoff('Just the words.', null)).toBe('Just the words.');
  });

  it('names what is never attached', () => {
    expect(NEVER_ATTACHED).toContain('your grades');
    expect(NEVER_ATTACHED).toContain('your conversations with the assistant');
    const text = JSON.stringify(handoff(input));
    for (const word of ['grade', 'note', 'conversation']) expect(text.toLowerCase()).not.toContain(word);
  });
});
