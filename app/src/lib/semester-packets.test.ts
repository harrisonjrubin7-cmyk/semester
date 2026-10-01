import { describe, expect, it } from 'vitest';
import { newMeeting } from './advisor-meeting';
import { NEVER_SENT } from './help-routes';
import {
  DEFAULT_EXPIRY_DAYS,
  NEVER_IN_A_PACKET,
  PACKET_KINDS,
  PACKET_KINDS_INFO,
  approve,
  candidate,
  fromAgendaItems,
  fromMeeting,
  gather,
  preview,
  previewText,
  release,
  revoke,
  stateOf,
  studentConfirms,
  type Candidate,
  type Packet,
} from './semester-packets';

const NOW = Date.UTC(2026, 9, 1, 12);
const DAY = 86_400_000;

const pool = (): Candidate[] => [
  { ...candidate('a', 'Questions', 'Does ECON 201 count toward my minor?'), approved: true },
  { ...candidate('b', 'Questions', 'Can I overload in spring?') },
  { ...candidate('c', 'Agenda', '  Plan for next term  '), approved: true },
  { ...candidate('n', 'Notes', 'I am nervous about this advisor'), approved: true, private: true },
];
const packet = (over: Partial<Parameters<typeof gather>[0]> = {}): Packet =>
  gather({ id: 'p1', kind: 'advisor', candidates: pool(), now: NOW, ...over });

describe('what a packet gathers', () => {
  it('holds only what the student approved', () => {
    expect(packet().items.map((i) => i.id)).toEqual(['a', 'c']);
  });

  it('starts every candidate unapproved, so nothing is in by default', () => {
    expect(candidate('x', 's', 't').approved).toBe(false);
    expect(gather({ id: 'p', kind: 'tutor', candidates: [candidate('x', 's', 't')], now: NOW }).items).toEqual([]);
  });

  it('drops a private note even when it is approved, so the packet never holds one', () => {
    const p = packet();
    expect(JSON.stringify(p)).not.toContain('nervous');
    expect(JSON.stringify(preview(p))).not.toContain('nervous');
  });

  it('trims text, drops blanks and duplicate ids', () => {
    const p = gather({
      id: 'p',
      kind: 'tutor',
      now: NOW,
      candidates: approve([candidate('a', 'S', '  hi '), candidate('a', 'S', 'again'), candidate('b', 'S', '   ')], ['a', 'b']),
    });
    expect(p.items.map((i) => i.text)).toEqual(['hi']);
  });

  it('works for every kind, each with an official-source sentence', () => {
    expect(PACKET_KINDS).toHaveLength(8);
    for (const kind of PACKET_KINDS) {
      const p = gather({ id: kind, kind, candidates: pool(), now: NOW });
      expect(p.title).toBe(PACKET_KINDS_INFO[kind].label);
      expect(preview(p).at(-1)).toMatchObject({ key: 'official' });
      expect(PACKET_KINDS_INFO[kind].official.length).toBeGreaterThan(20);
    }
  });

  it('always sets an expiry, a week by default and never beyond ninety days', () => {
    expect(packet().expiresAt).toBe(NOW + DEFAULT_EXPIRY_DAYS * DAY);
    expect(packet({ expiresInDays: 9999 }).expiresAt).toBe(NOW + 90 * DAY);
    expect(packet({ expiresInDays: 0 }).expiresAt).toBe(NOW + DAY);
    expect(packet().revokedAt).toBeNull();
  });
});

describe('preview', () => {
  it('shows who it is for, when it ends, and each approved item under its section', () => {
    const lines = preview(packet({ audience: 'Dr. Rao' }));
    expect(lines.find((l) => l.key === 'audience')?.value).toBe('Dr. Rao');
    expect(lines.find((l) => l.key === 'expires')?.value).toMatch(/2026/);
    expect(lines.filter((l) => l.key === 'item').map((l) => [l.label, l.value])).toEqual([
      ['Questions', 'Does ECON 201 count toward my minor?'],
      ['Agenda', 'Plan for next term'],
    ]);
  });

  it('is what release sends: the payload lines are the preview items, nothing more', () => {
    const p = packet();
    const out = release(p, studentConfirms(p, NOW), NOW);
    if (!out.ok) throw new Error('expected a payload');
    const fromPreview = preview(p)
      .filter((l) => l.key === 'item' || l.key === 'official')
      .map((l) => ({ label: l.label, value: l.value }));
    expect(out.payload.lines).toEqual(fromPreview);
    expect(out.payload.sources).toEqual(['student_entered']);
  });

  it('reuses the never-sent list from the help route', () => {
    expect(NEVER_IN_A_PACKET).toBe(NEVER_SENT);
  });
});

describe('release', () => {
  const p = packet();

  it('returns nothing without a confirmation', () => {
    for (const nothing of [undefined, null, {}, 'yes', true, { by: 'app', packetId: 'p1', previewDigest: 'x' }]) {
      const out = release(p, nothing, NOW);
      expect(out.ok).toBe(false);
      if (!out.ok) expect(out.refusal).toBe('no_confirmation');
    }
  });

  it('refuses a confirmation for another packet', () => {
    const other = studentConfirms(packet({ id: 'p2' }), NOW);
    expect(release(p, other, NOW)).toMatchObject({ ok: false, refusal: 'wrong_packet' });
  });

  it('refuses when the packet changed after the student confirmed', () => {
    const confirmed = studentConfirms(p, NOW);
    const edited: Packet = { ...p, items: [...p.items, { id: 'z', section: 'Questions', text: 'Something new', source: 'student_entered' }] };
    expect(previewText(edited)).not.toBe(previewText(p));
    expect(release(edited, confirmed, NOW)).toMatchObject({ ok: false, refusal: 'changed_since_confirmed' });
  });

  it('releases for an explicit confirmation of this packet', () => {
    const out = release(p, studentConfirms(p, NOW), NOW);
    expect(out.ok).toBe(true);
  });

  it('refuses once revoked, and once expired, with the reason', () => {
    const confirmed = studentConfirms(p, NOW);
    expect(release(revoke(p, NOW + 1), confirmed, NOW + 2)).toMatchObject({ ok: false, refusal: 'revoked' });
    expect(release(p, confirmed, p.expiresAt)).toMatchObject({ ok: false, refusal: 'expired' });
    expect(release(p, confirmed, p.expiresAt - 1).ok).toBe(true);
  });

  it('says revoked rather than expired when both are true', () => {
    expect(stateOf(revoke(p, NOW), p.expiresAt + DAY)).toBe('revoked');
    expect(revoke(revoke(p, 5), 9).revokedAt).toBe(5);
  });

  it('refuses an empty packet', () => {
    const empty = gather({ id: 'e', kind: 'advisor', candidates: [], now: NOW });
    expect(release(empty, studentConfirms(empty, NOW), NOW)).toMatchObject({ ok: false, refusal: 'empty' });
  });

  it('never carries a private note, even when every candidate is approved', () => {
    const all = pool().map((c) => ({ ...c, approved: true }));
    const everything = gather({ id: 'all', kind: 'advisor', candidates: all, now: NOW });
    const out = release(everything, studentConfirms(everything, NOW), NOW);
    expect(JSON.stringify(out)).not.toContain('nervous');
  });
});

describe('from what the app already keeps', () => {
  it('turns a meeting into candidates, none approved, notes private', () => {
    const m = { ...newMeeting(1), notes: 'my private worry', agenda: [{ id: '1', text: 'Agenda one' }], questions: [{ id: '2', text: 'Q one', answer: 'secret answer' }], followUps: [] };
    const cs = fromMeeting(m);
    expect(cs.every((c) => !c.approved)).toBe(true);
    expect(cs.find((c) => c.section === 'Private notes')?.private).toBe(true);
    const p = gather({ id: 'm', kind: 'advisor', candidates: cs.map((c) => ({ ...c, approved: true })), now: NOW });
    expect(p.items.map((i) => i.text)).toEqual(['Agenda one', 'Q one']);
    expect(JSON.stringify(p)).not.toMatch(/private worry|secret answer/);
  });

  it('turns office-hours agenda items into candidates', () => {
    const cs = fromAgendaItems([{ id: 'q:1', kind: 'question', title: 'Eigenvalues', detail: 'why real?' }, { id: 'r:x', kind: 'review', title: 'Limits', detail: '' }]);
    expect(cs.map((c) => [c.section, c.text])).toEqual([['Questions', 'Eigenvalues — why real?'], ['What I am still working on', 'Limits']]);
    expect(cs.every((c) => !c.approved)).toBe(true);
  });

  it('approve ticks exactly the listed ids', () => {
    expect(approve(pool(), ['b']).filter((c) => c.approved).map((c) => c.id)).toEqual(['b']);
  });
});
