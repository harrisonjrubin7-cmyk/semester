import { FRESHNESS_TEXT } from './integration/freshness';
import type { Fact, SchoolRecordsView } from './integration/school-records';
import type { Message, Priority } from './comms';

/**
 * What the school has shared, as messages in the Notices hub's official channel.
 *
 * The facts come from `schoolRecordsView` — the same rows, freshness and
 * "official" judgment the Today card draws — so the hub cannot disagree with
 * Today about whether something is current. This file only decides how loudly
 * each one speaks, and the rule is narrow on purpose:
 *
 * **Required is for two things, and only while they are current.** A current
 * emergency alert, and a current hold that blocks registration. Everything else
 * an office sends is at most "Soon". A stale emergency is still shown — hiding
 * it would be worse — but it is labelled not current and cannot claim Required,
 * because Required is the one label that ignores quiet hours and mute, and a
 * fact the school may already have cleared has not earned that.
 *
 * Nothing here is invented: enrollment, degree-audit counts, jobs and events
 * are not notices and stay on Today and Opportunities.
 */

function meta(f: Fact): string {
  return `${FRESHNESS_TEXT[f.freshness]} · from ${f.source}${f.official ? '' : ' · Not the official current record'}`;
}

function message(f: Fact, kind: string, priority: Priority, at: string, extra?: string): Message {
  return {
    id: `official:${kind}:${f.id}`,
    channel: 'official',
    source: f.source,
    title: f.text,
    body: [meta(f), f.caveat, extra].filter(Boolean).join(' '),
    at,
    // `official` is the school-records judgment: live or recent, from a connected
    // institutional source. It is what `admit` checks before letting Required stand.
    current: f.official,
    // The app-wide label: confirmed and current is "Institution verified"; a
    // fact past its freshness is "Needs review", which the badge makes noticed.
    sourceLabel: f.official ? 'institution_verified' : 'needs_review',
    priority: f.official ? priority : priority === 'required' ? 'high' : priority,
    url: f.link ?? undefined,
    urlLabel: f.linkLabel,
  };
}

export function officialMessages(view: SchoolRecordsView, now: Date): Message[] {
  const at = now.toISOString();
  const out: Message[] = [];
  for (const a of view.alerts) {
    const level: Priority = a.text.startsWith('Emergency:') ? 'required' : a.text.startsWith('Advisory:') ? 'high' : 'normal';
    out.push(message(a, 'alert', level, at));
  }
  for (const h of view.holds) {
    const blocks = h.text.startsWith('Action required before you can register');
    out.push(message(h, 'hold', blocks ? 'required' : 'high', at));
  }
  for (const b of view.actions) out.push(message(b, 'action', 'high', at));
  for (const r of view.referrals) out.push(message(r, 'referral', 'high', at));
  if (view.window) out.push(message(view.window, 'window', 'normal', at));
  if (view.appointment) out.push(message(view.appointment, 'appointment', 'normal', at));
  return out;
}
