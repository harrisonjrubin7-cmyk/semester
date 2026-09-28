/**
 * The one status vocabulary.
 *
 * Every state the app reports about a thing — where it came from, how fresh
 * it is, whether it needs the student, whether it is saved — is named here,
 * once, with the sentence behind the word. A screen that wants to say one of
 * these says it through `statusOf`, never in its own words, because the same
 * state in two wordings is two states to a reader. It happened: the settings
 * screen said "Sync trouble" and the soft layout's card said "Trouble" for
 * the one `error`, and "Not signed in" beside "None".
 *
 * ## Provenance is `lib/where.ts`, not a second list
 *
 * `where.ts` already orders six origins by how far a row should be trusted
 * and chose its words on purpose ("Yours" rather than "Local", "Made here"
 * rather than "Semester-created"). Those six are read from there, so this
 * file cannot drift from it. The design brief's "Student-entered" is
 * `yours`, and its "Semester-created"/"AI-assisted" split is `made` versus
 * `ai-assisted` below: `made` is a rule-based extraction, `ai-assisted` is a
 * model's draft, and the student should be able to tell them apart.
 *
 * ## Never colour alone
 *
 * Each entry carries a `glyph` — a character that survives forced colours,
 * greyscale and a screen reader's silence about hue — and a `tone` that maps
 * to a `--status-*` token. The chip draws both and the word; the tone is the
 * least of the three.
 */

import type { SyncStatus } from '../state/store';
import { aboutWhere, saysWhere, type Where } from './where';

export type Tone = 'neutral' | 'info' | 'success' | 'attention' | 'danger';

export type StatusKey =
  // provenance — see lib/where.ts
  | Where
  | 'faculty-approved'
  | 'course-provided'
  | 'ai-assisted'
  // freshness and attention
  | 'updated-today'
  | 'needs-confirmation'
  | 'action-required'
  // saving and syncing
  | 'saving'
  | 'saved'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'queued'
  | 'conflict'
  | 'sync-error'
  | 'signed-out'
  | 'device-only';

export interface Status {
  key: StatusKey;
  /** The word on the chip. Sentence case, and the same everywhere. */
  label: string;
  /** For a slot that holds one word — a stat card's value. */
  short: string;
  /** The sentence behind the word, for a tooltip, a drawer or a reader. */
  about: string;
  tone: Tone;
  /** A text glyph so the state is never carried by colour alone. */
  glyph: string;
  /** Whether a screen reader should hear a change to this state at once. */
  urgent: boolean;
}

type Row = Omit<Status, 'key' | 'short'> & { short?: string };

function provenance(w: Where): Row {
  const tone: Tone = w === 'stale' ? 'attention' : w === 'official' ? 'success' : 'neutral';
  const glyph = w === 'official' ? '◆' : w === 'stale' ? '!' : w === 'sample' ? '◌' : '○';
  return { label: saysWhere(w), about: aboutWhere(w), tone, glyph, urgent: false };
}

const TABLE: Record<StatusKey, Row> = {
  official: provenance('official'),
  connected: provenance('connected'),
  made: provenance('made'),
  yours: provenance('yours'),
  sample: provenance('sample'),
  stale: provenance('stale'),
  'faculty-approved': {
    label: 'Faculty-approved',
    about: 'An instructor for this course reviewed and approved it.',
    tone: 'success',
    glyph: '◆',
    urgent: false,
  },
  'course-provided': {
    label: 'Course-provided',
    about: 'Taken directly from material your course published — a syllabus, slides or a reading.',
    tone: 'info',
    glyph: '◇',
    urgent: false,
  },
  'ai-assisted': {
    label: 'AI-assisted, source-linked',
    short: 'AI-assisted',
    about:
      'Drafted with an AI model from the sources listed with it. Check it against those sources; it does not replace them.',
    tone: 'info',
    glyph: '✦',
    urgent: false,
  },
  'updated-today': {
    label: 'Updated today',
    short: 'Today',
    about: 'Checked against its source today.',
    tone: 'neutral',
    glyph: '↻',
    urgent: false,
  },
  'needs-confirmation': {
    label: 'Needs confirmation',
    short: 'Confirm',
    about: 'Not verified against an official record. Confirm it with the office or person responsible before relying on it.',
    tone: 'attention',
    glyph: '?',
    urgent: false,
  },
  'action-required': {
    label: 'Action required',
    short: 'Action',
    about: 'Something here needs you before it can go further.',
    tone: 'attention',
    glyph: '!',
    urgent: false,
  },
  saving: { label: 'Saving…', short: 'Saving', about: 'Your change is being written.', tone: 'neutral', glyph: '…', urgent: false },
  saved: { label: 'Saved', about: 'Your change is stored on this device.', tone: 'success', glyph: '✓', urgent: false },
  syncing: { label: 'Syncing', about: 'Your account copy is being brought up to date.', tone: 'neutral', glyph: '↻', urgent: false },
  synced: { label: 'Synced', about: 'Your account copy matches this device.', tone: 'success', glyph: '✓', urgent: false },
  offline: {
    label: 'Offline',
    about: 'No connection. You can keep working; changes stay on this device and sync when you are back online.',
    tone: 'attention',
    glyph: '⊘',
    urgent: true,
  },
  queued: {
    label: 'Queued',
    about: 'Saved on this device and waiting to sync.',
    tone: 'neutral',
    glyph: '⋯',
    urgent: false,
  },
  conflict: {
    label: 'Conflict needs review',
    short: 'Conflict',
    about: 'This changed in two places. Choose which version to keep — nothing has been thrown away.',
    tone: 'danger',
    glyph: '⇄',
    urgent: true,
  },
  'sync-error': {
    label: 'Sync trouble',
    short: 'Trouble',
    about: 'The last sync did not finish. Your work is safe on this device.',
    tone: 'danger',
    glyph: '!',
    urgent: true,
  },
  'signed-out': {
    label: 'Not signed in',
    short: 'None',
    about: 'There is no account to sync to. Everything stays on this device.',
    tone: 'neutral',
    glyph: '○',
    urgent: false,
  },
  'device-only': {
    label: 'On this device only',
    short: 'Local',
    about: 'Sync is not set up in this build. Everything stays on this device.',
    tone: 'neutral',
    glyph: '○',
    urgent: false,
  },
};

export const STATUS_KEYS = Object.keys(TABLE) as StatusKey[];

export function statusOf(key: StatusKey): Status {
  const row = TABLE[key];
  return { key, short: row.short ?? row.label, ...row };
}

/** The account's sync state, exactly as the store publishes it. */
export type SyncState = SyncStatus;

/**
 * The one mapping from the store's sync state to a status. An offline device
 * outranks whatever the last sync said, because it is what will happen next.
 *
 * The words for the store's own states are `SYNC_WORDS` in
 * `lib/syncstatus.ts`; this maps those states onto the shared vocabulary so a
 * chip or a save line says the same thing (`lib/unity.test.ts` holds the two
 * tables to the same labels). Both conflict states are `conflict` here: the
 * chip says a conflict exists, and Account says which kind.
 */
export function syncStatusKey(sync: SyncState, isOffline = false): StatusKey {
  if (isOffline && sync !== 'off' && sync !== 'signed-out' && sync !== 'queued') return 'offline';
  switch (sync) {
    case 'synced':
      return 'synced';
    case 'syncing':
      return 'syncing';
    case 'error':
      return 'sync-error';
    case 'signed-out':
      return 'signed-out';
    case 'off':
      return 'device-only';
    case 'offline':
      return 'offline';
    case 'queued':
    // Saved on this device and waiting to sync, which is what the key says.
    case 'read-only':
      return 'queued';
    case 'conflict':
    case 'review':
      return 'conflict';
  }
}

/** The CSS custom property a tone paints with. */
export function toneVar(tone: Tone): string {
  switch (tone) {
    case 'attention':
      return 'var(--status-attention)';
    case 'danger':
      return 'var(--status-danger)';
    case 'success':
      return 'var(--status-success)';
    case 'info':
      return 'var(--status-info)';
    case 'neutral':
      return 'var(--status-neutral)';
  }
}
