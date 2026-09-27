/**
 * Catching personal information before it is posted.
 *
 * On a small campus a phone number, a room number or "every Tuesday at 3 in
 * the library basement" is enough to find somebody. The check runs before a
 * post is published and says what it found, so the author can edit — most
 * personal information in a post is the author's own, shared without thinking,
 * and a prompt is the right response to that. The same detectors run as a
 * moderation signal after publishing, where a high-confidence hit on somebody
 * else's details is a temporary hold and a professional review.
 *
 * These are pattern detectors, deliberately. They are explainable, versioned,
 * and cheap; they will miss things and flag things, which is why nothing here
 * removes content or restricts anyone — see moderation.ts.
 */

export const PII_DETECTOR_VERSION = 'pii-rules-2026.09.1';

export type PiiKind =
  | 'phone'
  | 'email'
  | 'student_id'
  | 'street_address'
  | 'room_or_residence'
  | 'coordinates'
  | 'exact_schedule';

export interface PiiFinding {
  kind: PiiKind;
  start: number;
  end: number;
  confidence: 'high' | 'medium';
}

export interface PiiOptions {
  /** The tenant's student-id shape, when it has one. */
  studentId?: RegExp;
}

interface Rule {
  kind: PiiKind;
  confidence: 'high' | 'medium';
  pattern: RegExp;
}

const DAY = '(?:mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat(?:ur)?|sun)(?:day)?s?';
const TIME = '\\d{1,2}(?::\\d{2})?\\s*(?:am|pm|a\\.m\\.|p\\.m\\.)';

const RULES: Rule[] = [
  {
    kind: 'email',
    confidence: 'high',
    pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  },
  {
    kind: 'phone',
    confidence: 'high',
    pattern: /(?<![\d-])(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?![\d-])/g,
  },
  {
    kind: 'coordinates',
    confidence: 'high',
    pattern: /-?\d{1,2}\.\d{4,},\s*-?\d{1,3}\.\d{4,}/g,
  },
  {
    kind: 'street_address',
    confidence: 'high',
    pattern:
      /\b\d{1,5}\s+(?:[A-Z][a-z]+\s){1,3}(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Ct|Court|Pl|Place|Way|Pike)\b\.?/g,
  },
  {
    kind: 'room_or_residence',
    confidence: 'medium',
    pattern: /\b(?:room|rm|dorm|apt|apartment|suite)\s*#?\s*\d{1,4}[A-Za-z]?\b/gi,
  },
  {
    kind: 'room_or_residence',
    confidence: 'medium',
    pattern: /\b(?:lives?|living|stays?)\s+(?:in|at)\s+[A-Z][\w'-]+(?:\s[A-Z][\w'-]+)?\s+(?:Hall|House|Tower|Apartments?)\b/g,
  },
  {
    kind: 'exact_schedule',
    confidence: 'medium',
    pattern: new RegExp(`\\b(?:every\\s+)?${DAY}\\s+(?:at|@)\\s*${TIME}`, 'gi'),
  },
];

export function detectPii(text: string, options: PiiOptions = {}): PiiFinding[] {
  const rules = [...RULES];
  if (options.studentId) {
    const flags = options.studentId.flags.includes('g') ? options.studentId.flags : `${options.studentId.flags}g`;
    rules.push({ kind: 'student_id', confidence: 'high', pattern: new RegExp(options.studentId.source, flags) });
  }
  const found: PiiFinding[] = [];
  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    for (const m of text.matchAll(rule.pattern)) {
      const start = m.index ?? 0;
      found.push({ kind: rule.kind, start, end: start + m[0].length, confidence: rule.confidence });
    }
  }
  // Overlaps keep the higher-confidence, earlier finding.
  found.sort((a, b) => a.start - b.start || (a.confidence === 'high' ? -1 : 1));
  const out: PiiFinding[] = [];
  for (const f of found) {
    const last = out[out.length - 1];
    if (last && f.start < last.end) continue;
    out.push(f);
  }
  return out;
}

export type PrePostDecision =
  /** Nothing found. */
  | { action: 'allow'; findings: [] }
  /** Medium-confidence finding: show a warning, the author may post as is. */
  | { action: 'warn'; findings: PiiFinding[]; message: string }
  /** High-confidence finding: the author edits or explicitly confirms it is their own. */
  | { action: 'edit_required'; findings: PiiFinding[]; message: string };

const LABEL: Record<PiiKind, string> = {
  phone: 'a phone number',
  email: 'an email address',
  student_id: 'a student ID',
  street_address: 'a street address',
  room_or_residence: 'a room or residence',
  coordinates: 'map coordinates',
  exact_schedule: 'an exact time and day someone will be somewhere',
};

export function prePostCheck(text: string, options: PiiOptions = {}): PrePostDecision {
  const findings = detectPii(text, options);
  if (findings.length === 0) return { action: 'allow', findings: [] };
  const kinds = [...new Set(findings.map((f) => LABEL[f.kind]))];
  const listed = kinds.join(', ');
  if (findings.some((f) => f.confidence === 'high')) {
    return {
      action: 'edit_required',
      findings,
      message: `This post looks like it includes ${listed}. Remove it, or confirm it is yours to share. Posts sharing other people's details are held for review.`,
    };
  }
  return {
    action: 'warn',
    findings,
    message: `This post may include ${listed}. Check that it doesn't help someone find a person.`,
  };
}

/** Replace each finding with a neutral marker, for the "remove it for me" button. */
export function redact(text: string, findings: PiiFinding[]): string {
  let out = '';
  let at = 0;
  for (const f of [...findings].sort((a, b) => a.start - b.start)) {
    out += text.slice(at, f.start) + '[removed]';
    at = f.end;
  }
  return out + text.slice(at);
}
