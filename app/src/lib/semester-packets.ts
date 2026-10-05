/**
 * Semester Packets: one generic builder for "here is what I am bringing".
 *
 * A student prepares for an advisor, a registration appointment, office hours,
 * a tutor, a career fair, a study-abroad approval, a research meeting or a
 * scholarship application, and each of those used to grow its own bundle with
 * its own idea of what may leave the device. `advisor-meeting.ts` has the
 * strictest version (a snapshot of ticked items, previewed in full, private
 * notes never in it) and `help-routes.ts` has the vocabulary for saying what is
 * never sent. This generalises the first and reuses the second, so a new kind
 * of packet is a new row in `PACKET_KINDS` and not a new privacy argument.
 *
 * ## What leaves, and what cannot
 *
 * - **Only what the student approved.** `gather` takes candidates and keeps the
 *   ones marked approved. Nothing is approved by default (`candidate` starts
 *   false), the same minimum-necessary rule as `officeagenda.ts`.
 * - **Private notes are not a setting.** An item marked private is dropped by
 *   `gather` even when it is also approved, so the packet object itself never
 *   holds one. A private note cannot be leaked by a later bug in `preview` or
 *   `release` because by then it is not there to leak.
 * - **`preview` is what leaves.** `release` builds its payload from `preview`
 *   rather than beside it (the rule `help-routes.payload` follows), so the
 *   confirm screen and the thing sent cannot say different things.
 * - **Nothing is released without the student.** `release` returns a payload
 *   only for an explicit confirmation object naming this packet and carrying
 *   the digest of the preview the student actually saw. An edit after
 *   confirming changes the digest, and the old confirmation stops working.
 *   There is no default confirmation and no code path that makes one on the
 *   student's behalf: `studentConfirms` is called by the confirm button and nothing else.
 * - **A share ends.** Every packet carries `expiresAt` and `revokedAt`. A
 *   packet past its expiry, or revoked, releases nothing, and a revoked one
 *   says so rather than silently returning less.
 *
 * Dates go through `lib/locale.ts` so the preview reads in the student's chosen
 * format. Nothing here decides who to share with or whether to; it holds what
 * the student chose and refuses everything else.
 */

import { formatDate } from './locale';
import { NEVER_SENT } from './help-routes';
import type { Meeting } from './advisor-meeting';
import type { Item as AgendaItem } from './officeagenda';
import type { SourceLabel } from './source';

export const PACKET_KINDS = [
  'advisor',
  'registration',
  'office_hours',
  'tutor',
  'career_fair',
  'study_abroad',
  'research_meeting',
  'scholarship',
] as const;
export type PacketKind = (typeof PACKET_KINDS)[number];

export interface KindInfo {
  label: string;
  /** Who a packet of this kind is usually brought to; the student still names the audience. */
  audience: string;
  /** What usually belongs, so a blank packet is not a blank page. Suggestions, never pre-approved. */
  sections: readonly string[];
  /** Said on the preview, because it is true of every packet of the kind. */
  official: string;
}

export const PACKET_KINDS_INFO: Record<PacketKind, KindInfo> = {
  advisor: {
    label: 'Advisor meeting',
    audience: 'Your academic advisor',
    sections: ['Agenda', 'Questions', 'Courses being considered', 'Plan scenario'],
    official: 'Your advisor and the registrar give the official answer on requirements.',
  },
  registration: {
    label: 'Registration',
    audience: 'The registrar or your advisor',
    sections: ['Courses in my plan', 'Backups', 'The message I saw', 'Questions'],
    official: 'Registration eligibility and holds are the registrar’s to confirm.',
  },
  office_hours: {
    label: 'Office hours',
    audience: 'Your instructor or TA',
    sections: ['Questions', 'Feedback to talk through', 'What I already tried'],
    official: 'Your instructor decides how the course is graded.',
  },
  tutor: {
    label: 'Tutoring session',
    audience: 'A tutor',
    sections: ['What I am stuck on', 'What I already tried', 'Work to look at'],
    official: 'A tutor can explain material; they do not set grades or policy.',
  },
  career_fair: {
    label: 'Career fair',
    audience: 'Employers and the career center',
    sections: ['About me', 'Skills with evidence', 'Questions for employers'],
    official: 'Each employer’s posting and the career center are the official sources.',
  },
  study_abroad: {
    label: 'Study abroad approval',
    audience: 'The study-abroad office and your advisor',
    sections: ['Program', 'Courses to transfer', 'Dates', 'Questions'],
    official: 'Credit transfer is approved by your school, not estimated by Semester.',
  },
  research_meeting: {
    label: 'Research meeting',
    audience: 'Your research supervisor',
    sections: ['Progress since last time', 'Blockers', 'Questions', 'Next steps I propose'],
    official: 'Your supervisor sets the direction and expectations of the project.',
  },
  scholarship: {
    label: 'Scholarship application',
    audience: 'The scholarship committee',
    sections: ['Activities and evidence', 'Statement draft', 'Deadlines'],
    official: 'The scholarship’s own page lists what the committee requires and decides.',
  },
};

/** One thing the student could put in a packet. Not included until approved. */
export interface Candidate {
  id: string;
  /** The section it sits under on the preview. */
  section: string;
  text: string;
  /** Marked by the student. Starts false everywhere an item is made. */
  approved: boolean;
  /** A private note. Dropped by `gather` whatever else is true of it. */
  private?: boolean;
  source?: SourceLabel;
}

export const candidate = (id: string, section: string, text: string, source: SourceLabel = 'student_entered'): Candidate => ({
  id,
  section,
  text,
  approved: false,
  source,
});

/** The limits, so the screen refuses before the packet is built. */
export const LIMITS = { items: 40, text: 1000, title: 120, audience: 80 } as const;
/** Days a share lives unless the student picks otherwise. */
export const DEFAULT_EXPIRY_DAYS = 7;
export const MAX_EXPIRY_DAYS = 90;

export interface PacketItem {
  id: string;
  section: string;
  text: string;
  source: SourceLabel;
}

export interface Packet {
  id: string;
  kind: PacketKind;
  title: string;
  /** Who the student says this is for. Shown on the preview. */
  audience: string;
  items: PacketItem[];
  createdAt: number;
  /** After this the packet releases nothing. Always set: a share that never ends is not offered. */
  expiresAt: number;
  /** Set when the student revokes. Releases nothing from then on. */
  revokedAt: number | null;
}

const DAY = 86_400_000;

/**
 * The packet holding exactly what was approved. Private items and unapproved
 * items are not in it; empty text is dropped rather than carried as a blank.
 */
export function gather(input: {
  id: string;
  kind: PacketKind;
  title?: string;
  audience?: string;
  candidates: readonly Candidate[];
  now: number;
  expiresInDays?: number;
}): Packet {
  const info = PACKET_KINDS_INFO[input.kind];
  const days = Math.min(MAX_EXPIRY_DAYS, Math.max(1, Math.floor(input.expiresInDays ?? DEFAULT_EXPIRY_DAYS)));
  const seen = new Set<string>();
  const items: PacketItem[] = [];
  for (const c of input.candidates) {
    if (c.approved !== true || c.private === true) continue;
    const text = c.text.trim().slice(0, LIMITS.text);
    if (!text || seen.has(c.id)) continue;
    seen.add(c.id);
    items.push({ id: c.id, section: c.section.trim() || 'Other', text, source: c.source ?? 'student_entered' });
    if (items.length >= LIMITS.items) break;
  }
  return {
    id: input.id,
    kind: input.kind,
    title: input.title?.trim().slice(0, LIMITS.title) || info.label,
    audience: input.audience?.trim().slice(0, LIMITS.audience) || info.audience,
    items,
    createdAt: input.now,
    expiresAt: input.now + days * DAY,
    revokedAt: null,
  };
}

/** The student takes it back. The packet stays as a record and releases nothing. */
export const revoke = (packet: Packet, now: number): Packet => (packet.revokedAt === null ? { ...packet, revokedAt: now } : packet);

export type PacketState = 'live' | 'expired' | 'revoked';

/** Revoked outranks expired: the student's act is the more useful thing to say. */
export function stateOf(packet: Packet, now: number): PacketState {
  if (packet.revokedAt !== null) return 'revoked';
  return now >= packet.expiresAt ? 'expired' : 'live';
}

export interface PreviewLine {
  key: 'title' | 'audience' | 'expires' | 'item' | 'official';
  label: string;
  value: string;
}

/**
 * Exactly what would leave, in reading order: who it is for, when it ends, each
 * approved item under its section, and the sentence about what is official.
 * Nothing about the student that was not approved is in it.
 */
export function preview(packet: Packet): PreviewLine[] {
  const lines: PreviewLine[] = [
    { key: 'title', label: 'Packet', value: packet.title },
    { key: 'audience', label: 'For', value: packet.audience },
    { key: 'expires', label: 'Link ends', value: formatDate(packet.expiresAt, { year: 'numeric', month: 'short', day: 'numeric' }) },
  ];
  const sections = [...new Set(packet.items.map((i) => i.section))];
  for (const section of sections) {
    for (const item of packet.items.filter((i) => i.section === section)) lines.push({ key: 'item', label: section, value: item.text });
  }
  lines.push({ key: 'official', label: 'Official source', value: PACKET_KINDS_INFO[packet.kind].official });
  return lines;
}

/** What the confirm screen says Semester will not send, whatever was approved. */
export const NEVER_IN_A_PACKET = NEVER_SENT;
export const PRIVATE_NOTES_LINE = 'Your private notes are never included.';

/** A short stable fingerprint of text, so a confirmation is for the preview that was seen. Not a security boundary. */
export function digest(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}

/** The preview as one string, which is what the digest covers. */
export const previewText = (packet: Packet): string => preview(packet).map((l) => `${l.key}|${l.label}|${l.value}`).join('\n');

/** The student pressing confirm, for this packet, having seen this preview. */
export interface Confirmation {
  by: 'student';
  packetId: string;
  previewDigest: string;
  confirmedAt: number;
}

/** Called by the confirm button (`studentConfirms`). Nothing else in the app makes one. */
export const studentConfirms = (packet: Packet, now: number): Confirmation => ({
  by: 'student',
  packetId: packet.id,
  previewDigest: digest(previewText(packet)),
  confirmedAt: now,
});

export type Refusal = 'no_confirmation' | 'wrong_packet' | 'changed_since_confirmed' | 'revoked' | 'expired' | 'empty';

export const REFUSAL_TEXT: Record<Refusal, string> = {
  no_confirmation: 'Nothing is sent until you confirm.',
  wrong_packet: 'That confirmation was for a different packet.',
  changed_since_confirmed: 'The packet changed after you confirmed. Review it and confirm again.',
  revoked: 'You revoked this packet, so it cannot be sent.',
  expired: 'This packet’s link has ended, so it cannot be sent.',
  empty: 'You have not approved anything to include yet.',
};

export interface Payload {
  version: 1;
  kind: PacketKind;
  title: string;
  audience: string;
  expiresAt: number;
  lines: { label: string; value: string }[];
  sources: SourceLabel[];
}

export type Release = { ok: true; payload: Payload } | { ok: false; refusal: Refusal; text: string };

const refuse = (refusal: Refusal): Release => ({ ok: false, refusal, text: REFUSAL_TEXT[refusal] });

const isConfirmation = (v: unknown): v is Confirmation =>
  typeof v === 'object' && v !== null && (v as Confirmation).by === 'student' && typeof (v as Confirmation).packetId === 'string' && typeof (v as Confirmation).previewDigest === 'string';

/**
 * The only way out. A payload only when `confirmation` is the student's own,
 * for this packet and this preview, and the packet is live and not empty.
 * Built from `preview`, never beside it.
 */
export function release(packet: Packet, confirmation: unknown, now: number): Release {
  if (!isConfirmation(confirmation)) return refuse('no_confirmation');
  if (confirmation.packetId !== packet.id) return refuse('wrong_packet');
  const state = stateOf(packet, now);
  if (state !== 'live') return refuse(state);
  if (packet.items.length === 0) return refuse('empty');
  const lines = preview(packet);
  if (confirmation.previewDigest !== digest(previewText(packet))) return refuse('changed_since_confirmed');
  return {
    ok: true,
    payload: {
      version: 1,
      kind: packet.kind,
      title: packet.title,
      audience: packet.audience,
      expiresAt: packet.expiresAt,
      lines: lines.filter((l) => l.key === 'item' || l.key === 'official').map((l) => ({ label: l.label, value: l.value })),
      sources: [...new Set(packet.items.map((i) => i.source))],
    },
  };
}

// ── Candidates from what the app already keeps ───────────────────────────

/**
 * An advisor meeting's agenda, questions and follow-ups as candidates. The
 * meeting's private notes come across marked private so that even a caller who
 * approves everything cannot send them; `gather` drops them.
 */
export function fromMeeting(meeting: Meeting): Candidate[] {
  const out: Candidate[] = [];
  for (const a of meeting.agenda) out.push(candidate(`a:${a.id}`, 'Agenda', a.text));
  for (const q of meeting.questions) out.push(candidate(`q:${q.id}`, 'Questions', q.text));
  for (const f of meeting.followUps) out.push(candidate(`f:${f.id}`, 'Follow-up actions', f.text));
  if (meeting.notes.trim()) out.push({ ...candidate(`n:${meeting.id}`, 'Private notes', meeting.notes), private: true });
  return out;
}

/** Office-hours agenda candidates (`officeagenda.candidates`) in packet form. */
export function fromAgendaItems(items: readonly AgendaItem[]): Candidate[] {
  const sectionOf = { question: 'Questions', feedback: 'Feedback to talk through', review: 'What I am still working on' } as const;
  return items.map((i) => candidate(i.id, sectionOf[i.kind], i.detail.trim() ? `${i.title} — ${i.detail.trim()}` : i.title));
}

/** Approves the listed ids and nothing else. The student's ticking, as a function. */
export const approve = (candidates: readonly Candidate[], ids: Iterable<string>): Candidate[] => {
  const on = new Set(ids);
  return candidates.map((c) => ({ ...c, approved: on.has(c.id) }));
};
