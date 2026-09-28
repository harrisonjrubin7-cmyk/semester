/**
 * The Community detectors, as the device sees them.
 *
 * The authoritative copy runs in the database: `community_detector_rules`, in
 * supabase/migrations/20260928032000_community.sql, applied to every post and
 * every edit by `private.community_run_detectors` so no client can skip it.
 * This is the same list, so the composer can say something *before* a post is
 * sent — and `detectors.test.ts` fails if the two differ by a rule, a number
 * or a character. The only translation allowed is `\y` there for `\b` here.
 *
 * What the device does with a hit is deliberately narrow:
 *   - academic integrity: a warning that names the course policy, because the
 *     student may simply not know it;
 *   - crisis language: the support notice, shown and never blocking — the
 *     post goes through, and a professional sees it;
 *   - everything else: nothing on the device. Telling somebody which words
 *     tripped a threat or hate rule is teaching them the rule. The server
 *     still records it.
 *
 * Detectors triage. Nothing here removes, hides or restricts anything.
 */

import type { DetectorKind, ReportCategory, Severity } from './moderation';

export type { DetectorKind } from './moderation';

export const DETECTOR_VERSION = 'community-detectors-2026.09.1';

export interface DetectorRule {
  id: string;
  detector: DetectorKind;
  category: ReportCategory;
  severity: Severity;
  confidence: number;
  /** Matched case-insensitively. */
  pattern: string;
}

// Keep in step with the seed in 20260928032000_community.sql.
export const DETECTOR_RULES: readonly DetectorRule[] = [
  { id: 'pii.third-party-contact', detector: 'pii_doxxing', category: 'private_information_or_doxxing', severity: 'P0', confidence: 0.95, pattern: String.raw`\b(her|his|their) (home address|address|phone number|number|dorm room|room number|room) is\b` },
  { id: 'pii.lives-at', detector: 'pii_doxxing', category: 'private_information_or_doxxing', severity: 'P0', confidence: 0.95, pattern: String.raw`\b(she|he) lives (at|in|on) [a-z0-9 ]{0,30}(hall|house|apartments?|street|avenue|road|dorm|room)\b` },
  { id: 'pii.third-party-schedule', detector: 'pii_doxxing', category: 'private_information_or_doxxing', severity: 'P0', confidence: 0.9, pattern: String.raw`\b(her|his) (class )?schedule is\b` },
  { id: 'threat.harm', detector: 'threat_crisis_language', category: 'threat_or_safety_concern', severity: 'P1', confidence: 0.8, pattern: String.raw`\b(i|we)( will|['’]ll| am going to|['’]m going to|['’]m gonna| are going to| gonna) (kill|shoot|stab|hurt|beat up) (you|him|her|them|us|someone|somebody|everyone|everybody|people)\b` },
  { id: 'threat.weapon-campus', detector: 'threat_crisis_language', category: 'threat_or_safety_concern', severity: 'P0', confidence: 0.9, pattern: String.raw`\b(bring|bringing|brought) (a )?(gun|knife|weapon|bomb)s? (to|into) (class|school|campus|the library|the lecture|the dorm)\b` },
  { id: 'threat.wish-death', detector: 'threat_crisis_language', category: 'threat_or_safety_concern', severity: 'P1', confidence: 0.8, pattern: String.raw`\byou (should|deserve to) die\b` },
  { id: 'crisis.self-harm', detector: 'threat_crisis_language', category: 'other', severity: 'P1', confidence: 0.7, pattern: String.raw`\b(kill myself|end my life|want to die|suicidal|suicide|hurt myself)\b` },
  { id: 'hate.dehumanizing', detector: 'hate_slur_risk', category: 'hate_or_discrimination', severity: 'P1', confidence: 0.8, pattern: String.raw`\b(they|those people|you people) are (subhuman|vermin|animals|parasites|cockroaches)\b` },
  { id: 'hate.go-back', detector: 'hate_slur_risk', category: 'hate_or_discrimination', severity: 'P1', confidence: 0.8, pattern: String.raw`\bgo back to (your|their) (own )?country\b` },
  { id: 'scam.shortened-link', detector: 'scam_phishing_link', category: 'spam_scam_or_phishing', severity: 'P3', confidence: 0.5, pattern: String.raw`\b(bit\.ly|tinyurl\.com|goo\.gl|is\.gd|cutt\.ly|rb\.gy)/` },
  { id: 'scam.payment', detector: 'scam_phishing_link', category: 'spam_scam_or_phishing', severity: 'P2', confidence: 0.6, pattern: String.raw`\b(gift cards?|wire (the )?money|pay upfront|payment upfront|double your (crypto|bitcoin|money))\b` },
  { id: 'scam.credentials', detector: 'scam_phishing_link', category: 'spam_scam_or_phishing', severity: 'P2', confidence: 0.7, pattern: String.raw`\b(verify|confirm|update) your (account|password|login|student portal|student id)\b` },
  { id: 'integrity.answers', detector: 'academic_integrity', category: 'academic_integrity', severity: 'P2', confidence: 0.6, pattern: String.raw`\b(answer key|answers (to|for) (the )?(quiz|exam|midterm|final|test|homework|hw|problem set|pset)|(quiz|exam|midterm|test) answers)\b` },
  { id: 'integrity.do-it-for-me', detector: 'academic_integrity', category: 'academic_integrity', severity: 'P2', confidence: 0.7, pattern: String.raw`\b((take|do|write) my (exam|quiz|test|essay|homework|assignment) for (me|money)|pay (someone|you) to (take|do|write))\b` },
  { id: 'impersonation.official', detector: 'impersonation', category: 'impersonation', severity: 'P2', confidence: 0.6, pattern: String.raw`\b(this is|message from|on behalf of) the (registrar|financial aid office|dean|office of the provost|campus police|it help desk)\b` },
];

const COMPILED = DETECTOR_RULES.map((r) => ({ rule: r, re: new RegExp(r.pattern, 'i') }));

export interface DetectorHit {
  rule: DetectorRule;
  version: string;
}

/** Every rule that matches, as the server would find them. */
export function detect(text: string, opts: { verified?: boolean } = {}): DetectorHit[] {
  return COMPILED.filter(({ rule, re }) => {
    // Impersonation is only a question for a post nobody verified.
    if (rule.detector === 'impersonation' && opts.verified) return false;
    return re.test(text);
  }).map(({ rule }) => ({ rule, version: DETECTOR_VERSION }));
}

export type ComposerPrompt =
  | { kind: 'integrity'; message: string }
  | { kind: 'support'; message: string };

export const SUPPORT_MESSAGE =
  'If you’re thinking about hurting yourself, you don’t have to handle it alone. You can call or text 988 (the Suicide & Crisis Lifeline, in the US) any time, or contact your campus counseling center. If you’re in immediate danger, call emergency services. Your post has gone up as usual.';

/**
 * What the composer says before a post is sent, if anything. Only two kinds of
 * hit produce a prompt; see the header for why the others stay silent.
 */
export function composerPrompts(text: string, integrityPolicy = ''): ComposerPrompt[] {
  const hits = detect(text);
  const out: ComposerPrompt[] = [];
  if (hits.some((h) => h.rule.detector === 'academic_integrity')) {
    out.push({
      kind: 'integrity',
      message: integrityPolicy
        ? `This looks like it may involve sharing or getting assessment answers. This course’s policy: ${integrityPolicy}`
        : 'This looks like it may involve sharing or getting assessment answers. Check your course’s policy before posting — asking how to approach a problem is almost always fine.',
    });
  }
  if (hits.some((h) => h.rule.id === 'crisis.self-harm')) {
    out.push({ kind: 'support', message: SUPPORT_MESSAGE });
  }
  return out;
}
