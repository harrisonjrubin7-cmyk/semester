import { useMemo, useState } from 'react';
import { useNow, useStore } from '../state/store';
import { Page } from '../components/Page';
import { SectionLabel, TabList } from '../components/ui';
import { Card, GoTo, Never } from '../components/JourneyKit';
import { useDeviceLibrary } from '../lib/device-library';
import { datedItems } from '../lib/select';
import { hasMode } from '../lib/accessmode';
import { schoolRecordsView } from '../lib/integration/school-records';
import { useSchoolRecords } from '../lib/school-records-hook';
import { officialMessages } from '../lib/official-notices';
import { SourceBadge } from '../components/SourceBadge';
import { clock, dateToIso } from '../lib/date';
import { EMPTY_LAUNCHPAD, openSteps, readLaunchpad, stepsFor } from '../lib/launchpad';
import { EMPTY_OPPORTUNITIES, deadlines, readOpportunities } from '../lib/opportunities';
import {
  CHANNELS,
  EMPTY_PREFS,
  PRIORITY_LABEL,
  admit,
  digestGroups,
  readHubPrefs,
  toggle,
  visible,
  type Digest,
  type HubPrefs,
  type Message,
} from '../lib/comms';

/**
 * One list of what the term is telling you, each message labelled with who
 * sent it. The rules — source on everything, required only from official
 * channels, nothing sponsored, no escalation — are in `lib/comms.ts`.
 *
 * The official channel is empty until a school connects one, and the screen
 * says so rather than filling it with examples: a sample registrar notice
 * that looks real is the one kind of placeholder this screen cannot have.
 */

const TABS = [
  { id: 'inbox' as const, label: 'Inbox' },
  { id: 'saved' as const, label: 'Saved' },
  { id: 'follow' as const, label: 'Follow up' },
  { id: 'prefs' as const, label: 'Preferences' },
];

type Tab = (typeof TABS)[number]['id'];

export function Hub() {
  const { account } = useStore();
  const who = account?.id || 'device';
  return <Workspace key={who} who={who} />;
}

function Workspace({ who }: { who: string }) {
  const { catalog, state } = useStore();
  const now = useNow();
  const predictable = hasMode(state.access, 'predictable');
  const prefsLib = useDeviceLibrary(`semester.hub.v1:${who}`, readHubPrefs, EMPTY_PREFS);
  const launch = useDeviceLibrary(`semester.launchpad.v1:${who}`, readLaunchpad, EMPTY_LAUNCHPAD);
  const opps = useDeviceLibrary(`semester.opportunities.v1:${who}`, readOpportunities, EMPTY_OPPORTUNITIES);
  const [tab, setTab] = useState<Tab>('inbox');
  const prefs = prefsLib.value;
  const setPrefs = (patch: Partial<HubPrefs>) => prefsLib.update((old) => ({ ...old, ...patch }));

  const school = useSchoolRecords();

  const messages = useMemo(() => {
    const out: Message[] = school.status === 'ready' ? officialMessages(schoolRecordsView(school.rows, school.userId, now), now) : [];
    for (const i of datedItems(catalog, now)) {
      if (i.isPast || i.daysAway > 7) continue;
      out.push({
        id: `course:${i.id}`,
        channel: 'course',
        source: catalog.byId[i.c]?.code || 'Course',
        title: `${i.title} — ${i.dueShort}`,
        body: i.kind,
        at: i.date.toISOString(),
        priority: i.daysAway <= 1 ? 'high' : 'normal',
        screen: 'work',
      });
    }
    const next = openSteps(stepsFor(launch.value.types), launch.value.stage, launch.value.done)[0];
    if (next) {
      out.push({ id: `launchpad:${next.id}`, channel: 'semester', source: 'Launchpad', title: next.title, body: next.detail, at: now.toISOString(), priority: 'low', screen: 'launchpad' });
    }
    // The student's calendar day, not UTC's — a deadline is a local date.
    const today = dateToIso(now);
    for (const o of deadlines(opps.value.items, today).slice(0, 5)) {
      out.push({ id: `opportunity:${o.id}`, channel: 'semester', source: 'Opportunities', title: `${o.title || 'An opportunity'} — due ${o.deadline}`, at: `${o.deadline}T09:00:00`, priority: 'normal', screen: 'opportunities' });
    }
    const shown = admit(out).shown;
    // "Predictable layout": the list stays in time order rather than moving
    // the most urgent to the top. Nothing is hidden either way.
    return predictable ? [...shown].sort((a, b) => a.at.localeCompare(b.at)) : shown;
  }, [catalog, now, launch.value, opps.value, predictable, school]);
  const officialCount = messages.filter((m) => m.channel === 'official').length;

  const minute = now.getHours() * 60 + now.getMinutes();
  const { now: shown, held } = visible(messages, prefs, minute);
  const list =
    tab === 'saved' ? messages.filter((m) => prefs.saved.includes(m.id)) : tab === 'follow' ? messages.filter((m) => prefs.followUp.includes(m.id)) : shown;
  const unread = shown.filter((m) => !prefs.read.includes(m.id)).length;

  return (
    <Page blurb="What your courses, your school and Semester are telling you, in one list — every message labelled with who sent it.">
      <TabList label="Notices" className="portal-tabs" value={tab} onChange={setTab} tabs={TABS} />
      {tab === 'prefs' ? (
        <Prefs prefs={prefs} set={setPrefs} />
      ) : (
        <>
          {tab === 'inbox' ? (
            <p className="jx-lead">
              {unread} unread{held ? ` · ${held} held until quiet hours end at ${clock(prefs.quietTo)}` : ''}
            </p>
          ) : null}
          {digestGroups(list, tab === 'inbox' ? prefs.digest : 'instant').map((g) => (
            <div key={g.key}>
              {prefs.digest !== 'instant' && tab === 'inbox' ? <SectionLabel>{g.key}</SectionLabel> : null}
              {g.items.map((m) => (
                <MessageRow key={m.id} m={m} prefs={prefs} set={setPrefs} />
              ))}
            </div>
          ))}
          {!list.length ? <p className="jx-muted">Nothing here.</p> : null}
          {tab === 'inbox' && school.status === 'ready' && !officialCount ? (
            <p className="jx-muted">Nothing from your school right now. Semester is not an emergency channel — follow your school’s own alerts for anything urgent.</p>
          ) : null}
          {tab === 'inbox' && school.status === 'error' ? (
            <Card kicker="Official" title="Could not reach your school’s channel">
              <p role="alert">
                Semester could not load what your school shared, so holds and alerts may be missing from this list. This is a failed request, not a sign your school has no channel.
              </p>
              <button type="button" className="jx-go" onClick={school.retry}>Try again</button>
            </Card>
          ) : null}
          {tab === 'inbox' && school.status === 'off' ? (
            <Card kicker="Official" title="No school channel connected">
              <p>
                Registrar, financial aid, campus safety and department notices appear here, labelled Official, once your school connects them. Until then they reach you the way they do now — check your school email.
              </p>
              <GoTo screen="university">See what your school shares</GoTo>
            </Card>
          ) : null}
        </>
      )}
      <Never
        items={[
          'No sponsored content — ever — and nothing mixed in with official notices.',
          'Only official channels can mark a message Required. Semester reminders never are.',
          'Semester never emails or texts you from here. It shows; it does not escalate.',
        ]}
      />
    </Page>
  );
}

function MessageRow({ m, prefs, set }: { m: Message; prefs: HubPrefs; set: (p: Partial<HubPrefs>) => void }) {
  const { dispatch } = useStore();
  const read = prefs.read.includes(m.id);
  const channel = CHANNELS.find((c) => c.id === m.channel)!;
  return (
    <div className={`jx-entry${read ? ' jx-entry-read' : ''}`}>
      <div className="jx-entry-head">
        <span className={CHANNEL_TAG[m.channel]}>{channel.label}</span>
        <span className="jx-tag">{m.source}</span>
        <span className={PRIORITY_TAG[m.priority]}>{PRIORITY_LABEL[m.priority]}</span>
      </div>
      <button
        type="button"
        className="jx-entry-title jx-bare"
        onClick={() => {
          if (!read) set({ read: [...prefs.read, m.id] });
          if (m.screen) dispatch({ type: 'go', screen: m.screen });
        }}
      >
        {m.title}
      </button>
      {m.body ? <div className="jx-entry-what">{m.body}</div> : null}
      {m.sourceLabel ? <SourceBadge label={m.sourceLabel} /> : null}
      {m.url ? (
        <a className="jx-door-link" href={m.url} target="_blank" rel="noopener noreferrer">
          {m.urlLabel ?? 'Open the official page'} ↗
        </a>
      ) : null}
      <div className="jx-actions">
        <button type="button" className="jx-go" aria-pressed={read} onClick={() => set({ read: toggle(prefs.read, m.id) })}>
          {read ? 'Mark unread' : 'Mark read'}
        </button>
        <button type="button" className="jx-go" aria-pressed={prefs.saved.includes(m.id)} onClick={() => set({ saved: toggle(prefs.saved, m.id) })}>
          {prefs.saved.includes(m.id) ? 'Saved' : 'Save'}
        </button>
        <button type="button" className="jx-go" aria-pressed={prefs.followUp.includes(m.id)} onClick={() => set({ followUp: toggle(prefs.followUp, m.id) })}>
          {prefs.followUp.includes(m.id) ? 'Following up' : 'Follow up'}
        </button>
      </div>
    </div>
  );
}

/** Written out, not built, so the dead-CSS check can see every class in use. */
const CHANNEL_TAG: Record<Message['channel'], string> = {
  official: 'jx-tag jx-tag-official',
  course: 'jx-tag',
  semester: 'jx-tag jx-tag-semester',
};

const PRIORITY_TAG: Record<Message['priority'], string> = {
  required: 'jx-tag jx-pri-required',
  high: 'jx-tag jx-pri-high',
  normal: 'jx-tag',
  low: 'jx-tag',
};

const DIGESTS: { id: Digest; label: string }[] = [
  { id: 'instant', label: 'As they come' },
  { id: 'daily', label: 'Daily digest' },
  { id: 'weekly', label: 'Weekly digest' },
];

function Prefs({ prefs, set }: { prefs: HubPrefs; set: (p: Partial<HubPrefs>) => void }) {
  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const minutes = (v: string) => {
    const [h, m] = v.split(':').map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0;
  };
  return (
    <>
      <SectionLabel>Channels</SectionLabel>
      {CHANNELS.map((c) => (
        <label key={c.id} className="jx-check">
          <input type="checkbox" checked={!prefs.muted.includes(c.id)} onChange={() => set({ muted: toggle(prefs.muted, c.id) as HubPrefs['muted'] })} aria-label={`Show ${c.label}`} />
          <span className="jx-check-body">
            <span className="jx-check-title">{c.label}</span>
            <span className="jx-check-detail">{c.says}{c.id === 'official' ? ' Required notices still show when muted.' : ''}</span>
          </span>
        </label>
      ))}
      <SectionLabel>Quiet hours</SectionLabel>
      <div className="jx-inline">
        <label className="jx-field">
          <span>From</span>
          <input className="input" type="time" value={hhmm(prefs.quietFrom)} onChange={(e) => set({ quietFrom: minutes(e.target.value) })} aria-label="Quiet hours start" />
        </label>
        <label className="jx-field">
          <span>Until</span>
          <input className="input" type="time" value={hhmm(prefs.quietTo)} onChange={(e) => set({ quietTo: minutes(e.target.value) })} aria-label="Quiet hours end" />
        </label>
      </div>
      <p className="jx-muted">Optional messages wait until quiet hours end. Required official notices are never held.</p>
      <SectionLabel>Digest</SectionLabel>
      <div className="jx-chips" role="radiogroup" aria-label="Digest">
        {DIGESTS.map((d) => (
          <button key={d.id} type="button" role="radio" aria-checked={prefs.digest === d.id} className={`jx-chip${prefs.digest === d.id ? ' jx-chip-on' : ''}`} onClick={() => set({ digest: d.id })}>
            {d.label}
          </button>
        ))}
      </div>
      <GoTo screen="notifs">Phone notification settings</GoTo>
    </>
  );
}
