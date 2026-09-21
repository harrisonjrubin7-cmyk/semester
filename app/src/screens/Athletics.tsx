import { useState } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { ActionButton, FilePick, Notice, SectionLabel, Segmented } from '../components/ui';
import { CardGrid, GridCard } from '../components/GridCard';
import { secondLine } from '../lib/dim';
import { useDeviceLibrary } from '../lib/device-library';
import {
  ATHLETIC_KINDS,
  ATHLETICS_LIMITS,
  EMPTY_ATHLETICS,
  absenceDraft,
  athleticsKey,
  eventDays,
  overlaps,
  readAthletics,
  type AthleticEvent,
} from '../lib/athletics';
import { download } from '../lib/deliver';
import { fromMarkdown } from '../lib/document';
import { dateToIso, decorateItem } from '../lib/date';
import { lengthOf, railFor } from '../lib/select';
import { TravelPack } from '../components/TravelPack';

/**
 * A season beside the coursework it collides with.
 *
 * The app already lists the fixtures anybody can go and watch. This is the
 * other side of the same season: the practices, the training, and the travel
 * that takes somebody off campus for four days in the middle of a term.
 *
 * ## Conflicts are the screen
 *
 * Everything else here is bookkeeping. What a student on a team actually
 * needs is the answer to "what does this trip cost me", and that answer is a
 * list: the classes in those days' rails, the deadlines falling inside them,
 * and any other event already planned over the top. `conflicts` below
 * computes it, and the three documents this screen can produce are all built
 * from it — the absence request, the travel study pack, the calendar entries.
 *
 * ## Personal planning, stated plainly
 *
 * A team roster, eligibility, medical clearance and an authorized absence are
 * all things an athletics office owns. None of them is here, and the notice
 * says so. The absence request is a draft to review and send; the calendar
 * entries are this student's own.
 */

const TABS = [
  { id: 'schedule' as const, label: 'Schedule' },
  { id: 'edit' as const, label: 'Add' },
  { id: 'data' as const, label: 'Import' },
];

type Tab = (typeof TABS)[number]['id'];

const fresh = (): AthleticEvent => ({
  id: crypto.randomUUID(),
  title: '',
  team: '',
  kind: 'Practice',
  start: '',
  end: '',
  where: '',
  notes: '',
  steps: [],
});

export function Athletics() {
  const { state, account } = useStore();
  // The key is `lib/athletics.ts`'s, not this screen's: the week-ahead
  // arithmetic reads the same library, and two spellings of one key is a
  // planner that reports an empty season.
  const key = athleticsKey(account?.id, state.term);
  return <Workspace key={key} storageKey={key} />;
}

function Workspace({ storageKey }: { storageKey: string }) {
  const { state, dispatch, catalog } = useStore();
  const lib = useDeviceLibrary(storageKey, readAthletics, EMPTY_ATHLETICS);

  const [tab, setTab] = useState<Tab>('schedule');
  const [draft, setDraft] = useState<AthleticEvent>(fresh);
  const [chosen, setChosen] = useState('');
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');

  const selected = lib.value.events.find((e) => e.id === chosen);
  const events = lib.value.events
    .filter((e) => `${e.title} ${e.team} ${e.kind}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.start.localeCompare(b.start));

  /**
   * Everything in this app that the event runs over the top of.
   *
   * Three sources, walked a day at a time because an event is a range: the
   * day's rail of classes and commitments, the deadlines falling on it, and
   * the other athletics events.
   *
   * Two details worth keeping. The first and last days are clipped to the
   * event's own hours — leaving at four on Thursday does not cost the Thursday
   * morning lecture — while the days between run midnight to midnight. And a
   * class is not reported as a conflict with an appointment this screen itself
   * added for the same event, which it recognises by the marker in its note;
   * without that, adding a trip to the calendar makes the trip conflict with
   * itself.
   */
  const conflicts = (e: AthleticEvent): string[] => {
    const found: string[] = [];
    for (const day of eventDays(e)) {
      const first = day === e.start.slice(0, 10);
      const last = day === e.end.slice(0, 10);
      const from = first ? new Date(e.start).getHours() * 60 + new Date(e.start).getMinutes() : 0;
      const to = last ? new Date(e.end).getHours() * 60 + new Date(e.end).getMinutes() : 1440;

      for (const b of railFor(catalog, new Date(`${day}T12:00`), state.appointments, state.commitments)) {
        const mine =
          b.from?.kind === 'appointment' &&
          state.appointments.find((a) => a.id === b.from?.id)?.note.includes(`athletics:${e.id}:`);
        const runs = b.at < to && b.at + (b.minutes ?? lengthOf(catalog, b)) > from;
        if (!b.canceled && runs && !mine) found.push(`${day} · ${b.title} · ${b.time}`);
      }

      for (const i of catalog.items) {
        if (dateToIso(decorateItem(i, new Date()).date) === day && !state.done[i.id]) {
          found.push(`${day} · Due: ${i.title}`);
        }
      }
    }
    for (const other of lib.value.events) {
      if (other.id !== e.id && overlaps(e, other)) found.push(`Athletics: ${other.title}`);
    }
    return [...new Set(found)];
  };

  const save = () => {
    try {
      const next = { version: 1 as const, events: [...lib.value.events.filter((e) => e.id !== draft.id), draft] };
      readAthletics(next);
      if (lib.update(next)) {
        setChosen(draft.id);
        setTab('schedule');
        setNotice('Saved to your athletics plan. Add it to your calendar once the times are right.');
      }
    } catch (e) {
      setNotice((e as Error).message);
    }
  };

  /**
   * One calendar entry per day the event touches, skipping days already added.
   *
   * The marker in the note is what makes it idempotent and what stops the
   * conflict finder counting these against the event that produced them. The
   * message says the obvious true thing afterwards: a plan that changes later
   * has to be changed in Calendar too, because these are ordinary entries once
   * they exist.
   */
  const addToCalendar = (e: AthleticEvent) => {
    let added = 0;
    for (const day of eventDays(e)) {
      const marker = `athletics:${e.id}:${day}`;
      if (state.appointments.some((a) => a.note.includes(marker))) continue;
      const at = day === e.start.slice(0, 10) ? e.start.slice(11) : '00:00';
      dispatch({
        type: 'addAppointment',
        appointment: {
          title: e.title,
          kind: e.kind === 'Travel' ? 'other' : 'health',
          date: day,
          at: Number(at.slice(0, 2)) * 60 + Number(at.slice(3)),
          time: at,
          where: e.where,
          note: `${marker}\nPersonal athletics plan. Ends ${e.end.replace('T', ' ')}. ${e.notes}`,
        },
      });
      added += 1;
    }
    setNotice(
      added
        ? `${added} calendar entries added. Change them in Calendar if this plan moves.`
        : 'These dates are already on your calendar.',
    );
  };

  const line = { fontSize: 'var(--type-sm)', ...secondLine(), lineHeight: 'var(--leading-normal)' } as const;

  return (
    <Page>
      <p style={{ ...line, marginBlock: 0, textWrap: 'pretty' }}>
        Personal planning. Team rosters, official eligibility, medical records and staff actions all need
        verified school access. Times use this device's timezone.
      </p>

      <Segmented
        options={TABS.map((t) => ({
          id: t.id,
          label: t.id === 'schedule' ? `${t.label} (${lib.value.events.length})` : t.label,
        }))}
        value={tab}
        onChange={setTab}
        style={{ marginBlock: 'var(--sp-5)' }}
      />

      {(notice || lib.error) && (
        <Notice>
          {lib.error || notice}
        </Notice>
      )}

      {tab === 'schedule' && (
        <>
          <input
            className="input"
            aria-label="Search athletics events"
            placeholder="Search team, event or type"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: '100%', marginBottom: 'var(--sp-5)' }}
          />
          {events.length === 0 ? (
            <p style={{ fontSize: 'var(--type-base)', ...secondLine(), lineHeight: 'var(--leading-normal)', textWrap: 'pretty' }}>
              Nothing planned yet. Add your next practice or trip, or import a team schedule, and it appears
              here beside the classes and deadlines it runs over.
            </p>
          ) : (
            <CardGrid min={150}>
              {events.map((e) => {
                const clashes = conflicts(e).length;
                return (
                  <GridCard
                    key={e.id}
                    label={e.title || 'Untitled'}
                    meta={clashes ? `${clashes} to review` : 'No conflicts'}
                    selected={chosen === e.id}
                    title={`${e.kind} · ${e.team || 'Your activity'} · ${e.start.replace('T', ' ')}`}
                    onClick={() => setChosen(e.id)}
                  />
                );
              })}
            </CardGrid>
          )}

          {selected && (
            <>
              <SectionLabel
                aside={`${selected.kind} · ${selected.team || 'Yours'}`}
                style={{ marginBlock: 'var(--sp-7) var(--sp-4)' }}
              >
                {selected.title}
              </SectionLabel>
              <p style={{ fontSize: 'var(--type-base)', lineHeight: 'var(--leading-normal)', marginBlock: 'var(--sp-3)' }}>
                {selected.start.replace('T', ' ')} → {selected.end.replace('T', ' ')}
                {selected.where ? ` · ${selected.where}` : ''}
              </p>
              {selected.notes && (
                <p style={{ fontSize: 'var(--type-base)', lineHeight: 'var(--leading-normal)', whiteSpace: 'pre-wrap' }}>
                  {selected.notes}
                </p>
              )}

              <SectionLabel style={{ marginBlock: 'var(--sp-6) var(--sp-3)' }}>What this runs over</SectionLabel>
              <p style={{ ...line, marginBlock: 0, textWrap: 'pretty' }}>
                Overlapping class and commitment times, and deadlines in these days. Fifty minutes is assumed
                where a class records no length, so confirm travel buffers and anything not in the app.
              </p>
              {conflicts(selected).length === 0 ? (
                <p style={{ fontSize: 'var(--type-base)', ...secondLine(), marginTop: 'var(--sp-4)' }}>
                  Nothing recorded in these days.
                </p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 'var(--sp-7)' }}>
                  {conflicts(selected).map((c, i) => (
                    <li
                      key={i}
                      style={{ fontSize: 'var(--type-base)', lineHeight: 'var(--leading-normal)', paddingBlock: 'var(--sp-2)' }}
                    >
                      {c}
                    </li>
                  ))}
                </ul>
              )}

              {selected.steps.length > 0 && (
                <>
                  <SectionLabel style={{ marginBlock: 'var(--sp-6) var(--sp-3)' }}>Before you go</SectionLabel>
                  {selected.steps.map((s, i) => (
                    <label
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--sp-4)',
                        paddingBlock: 'var(--sp-3)',
                        borderBottom: '1px solid var(--app-line)',
                        fontSize: 'var(--type-base)',
                        lineHeight: 'var(--leading-normal)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={s.done}
                        onChange={(ev) =>
                          lib.update((old) => ({
                            ...old,
                            events: old.events.map((x) =>
                              x.id === selected.id
                                ? {
                                    ...x,
                                    steps: x.steps.map((step, j) =>
                                      j === i ? { ...step, done: ev.target.checked } : step,
                                    ),
                                  }
                                : x,
                            ),
                          }))
                        }
                      />
                      <span>{s.text}</span>
                    </label>
                  ))}
                </>
              )}

              {(selected.kind === 'Travel' || selected.kind === 'Competition') && (
                /*
                 * Offered for the two kinds that take somebody off campus.
                 * A practice is two hours in a gym with the campus wifi in it;
                 * queueing a course's audio for one would fill a phone to
                 * solve a problem nobody has.
                 */
                <TravelPack event={selected} />
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginTop: 'var(--sp-6)' }}>
                <ActionButton
                  onClick={() => {
                    setDraft(structuredClone(selected));
                    setTab('edit');
                  }}
                  style={{ flex: '1 1 auto' }}
                >
                  Edit
                </ActionButton>
                <ActionButton onClick={() => addToCalendar(selected)} style={{ flex: '1 1 auto' }}>
                  Add to calendar
                </ActionButton>
                <ActionButton
                  onClick={() =>
                    dispatch({
                      type: 'makeDocument',
                      open: true,
                      doc: {
                        title: `${selected.title} · Academic absence request`,
                        subtitle: 'Draft for review · Not sent, and not an official authorization',
                        courseId: null,
                        blocks: fromMarkdown(absenceDraft(selected, conflicts(selected))),
                      },
                    })
                  }
                  style={{ flex: '1 1 auto' }}
                >
                  Draft the request
                </ActionButton>
                <ActionButton
                  onClick={() =>
                    dispatch({
                      type: 'makeDocument',
                      open: true,
                      doc: {
                        title: `${selected.title} · Travel study pack`,
                        subtitle: 'Personal planning document',
                        courseId: null,
                        blocks: fromMarkdown(
                          [
                            `# ${selected.title}`,
                            '',
                            '## Work these days run over',
                            conflicts(selected).map((c) => `- ${c}`).join('\n'),
                            '',
                            '## Before departure',
                            '- Download this trip\'s lessons, recordings and files with *Take it offline* on the Athletics screen, while you still have a connection.',
                            '- Finish anything time-sensitive.',
                            '- Confirm assessment arrangements.',
                            '',
                            '## While away',
                            '- One topic per short study block.',
                            '- Use saved cards and notes.',
                            '- Write down questions to pick up on return.',
                          ].join('\n'),
                        ),
                      },
                    })
                  }
                  style={{ flex: '1 1 auto' }}
                >
                  Travel study pack
                </ActionButton>
              </div>
            </>
          )}
        </>
      )}

      {tab === 'edit' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <fieldset disabled={lib.blocked} style={{ border: 0, padding: 0, minWidth: 0 }}>
            {(
              [
                ['Event name', 'title', 'text', true],
                ['Team or group', 'team', 'text', false],
                ['Starts', 'start', 'datetime-local', true],
                ['Ends', 'end', 'datetime-local', true],
                ['Location', 'where', 'text', false],
              ] as const
            ).map(([label, field, kind, required]) => (
              <label key={field} style={{ display: 'block', marginBottom: 'var(--sp-5)' }}>
                <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>{label}</span>
                <input
                  className="input"
                  type={kind}
                  required={required}
                  maxLength={ATHLETICS_LIMITS.where}
                  value={draft[field]}
                  onChange={(e) => setDraft((v) => ({ ...v, [field]: e.target.value }))}
                  style={{ width: '100%', marginTop: 'var(--sp-2)' }}
                />
              </label>
            ))}
            <label style={{ display: 'block', marginBottom: 'var(--sp-5)' }}>
              <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Type</span>
              <select
                className="input"
                value={draft.kind}
                onChange={(e) => setDraft((v) => ({ ...v, kind: e.target.value as AthleticEvent['kind'] }))}
                style={{ width: '100%', marginTop: 'var(--sp-2)' }}
              >
                {ATHLETIC_KINDS.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'block', marginBottom: 'var(--sp-5)' }}>
              <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Plan and travel notes</span>
              <textarea
                className="input"
                rows={5}
                maxLength={ATHLETICS_LIMITS.notes}
                value={draft.notes}
                onChange={(e) => setDraft((v) => ({ ...v, notes: e.target.value }))}
                style={{ width: '100%', marginTop: 'var(--sp-2)' }}
              />
            </label>
            <label style={{ display: 'block', marginBottom: 'var(--sp-5)' }}>
              <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Checklist, one step per line</span>
              <textarea
                className="input"
                rows={5}
                value={draft.steps.map((s) => s.text).join('\n')}
                onChange={(e) =>
                  setDraft((v) => ({
                    ...v,
                    /*
                     * Ticks survive an edit to another line. Matching on text
                     * at the same index is imperfect — reordering loses them —
                     * but it beats the alternative, which is a checklist that
                     * empties itself every time somebody fixes a typo.
                     */
                    steps: e.target.value
                      .split('\n')
                      .slice(0, ATHLETICS_LIMITS.steps)
                      .map((text, i) => ({
                        text: text.slice(0, ATHLETICS_LIMITS.stepText),
                        done: v.steps[i]?.text === text ? v.steps[i].done : false,
                      })),
                  }))
                }
                style={{ width: '100%', marginTop: 'var(--sp-2)' }}
              />
            </label>
            <button type="submit" className="btn btn-primary btn-block">
              Save event
            </button>
          </fieldset>
        </form>
      )}

      {tab === 'data' && (
        <>
          <p style={{ fontSize: 'var(--type-base)', lineHeight: 'var(--leading-normal)', textWrap: 'pretty' }}>
            Import an exported team plan as your own planning data. It verifies no eligibility and authorizes
            no travel.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginBlock: 'var(--sp-5)' }}>
            <ActionButton
              onClick={() =>
                download({
                  name: 'Semester athletics.json',
                  body: JSON.stringify(lib.value, null, 2),
                  mime: 'application/json',
                })
              }
              style={{ flex: '1 1 auto' }}
            >
              Export
            </ActionButton>
            <ActionButton
              onClick={() =>
                download({
                  name: 'Athletics import example.json',
                  body: JSON.stringify(
                    {
                      version: 1,
                      events: [
                        {
                          ...fresh(),
                          title: 'Example practice — replace with your own',
                          start: '2026-09-15T16:00',
                          end: '2026-09-15T18:00',
                        },
                      ],
                    },
                    null,
                    2,
                  ),
                  mime: 'application/json',
                })
              }
              style={{ flex: '1 1 auto' }}
            >
              Example file
            </ActionButton>
          </div>
          <FilePick
            accept=".json"
            multiple={false}
            onPick={async (files) => {
              try {
                const f = files[0];
                if (!f) return;
                if (f.size > 1_000_000) throw new Error('Choose a schedule under 1 MB.');
                const got = readAthletics(JSON.parse(await f.text()));
                // Fresh ids, so an import adds rather than overwriting.
                lib.update((old) => ({
                  ...old,
                  events: [...old.events, ...got.events.map((e) => ({ ...e, id: crypto.randomUUID() }))],
                }));
                setNotice('Imported as your own events.');
              } catch (e) {
                setNotice((e as Error).message);
              }
            }}
          >
            Import a schedule
          </FilePick>
          {lib.blocked && (
            <ActionButton
              onClick={() =>
                download({ name: 'Athletics recovery.json', body: lib.recovery(), mime: 'application/json' })
              }
              style={{ marginTop: 'var(--sp-5)' }}
            >
              Download recovery copy
            </ActionButton>
          )}
        </>
      )}
    </Page>
  );
}
