import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel, Segmented, TickBox } from '../components/ui';
import { ChevronRight } from '../components/Icons';
import { DAYS } from '../lib/edit';
import { spanOf } from '../lib/select';
import { kindOf } from '../lib/kinds';
import {
  ACTIVITY_KINDS,
  activityKind,
  clashes,
  clock,
  dayName,
  guessKind,
  hoursOf,
  load,
  loadLine,
  readInvolvement,
  showHours,
  weeklyHours,
  type ActivityKind,
  type Commitment,
} from '../lib/activities';

/**
 * Everything you do that is not a class.
 *
 * A semester is not four courses. It is four courses, a job, a research
 * position, two clubs, a chapter, and intramural soccer on Tuesdays — and the
 * app knew about none of it, which meant every picture it drew of a week was
 * wrong in the same direction. The reason a week falls apart is almost never
 * the coursework alone; it is the coursework plus eighteen hours of everything
 * else, and the collision is invisible until it happens.
 *
 * Anything with a fixed time lands on the same day and week grids as your
 * classes, in the same seven colours, so a Tuesday that already has practice
 * on it looks full before you agree to something else. Anything without one —
 * a job with variable shifts — is hours you state, because estimating them
 * from a meeting time would be inventing a number about your own life.
 *
 * The links go out to AnchorLink and nowhere clever. This app cannot read it:
 * it is behind single sign-on and no browser will let a page read a tab it
 * does not own. There is no compiled-in list of Vanderbilt organisations
 * either — there are several hundred, they turn over every year, and a list of
 * invented or stale ones would be worse than none, because somebody would
 * email a president who graduated in 2021.
 */
export function Activities() {
  const { state, catalog } = useStore();
  const [tab, setTab] = useState<'yours' | 'add' | 'find'>('yours');

  const mine = state.commitments;
  const activityHours = weeklyHours(mine);

  // Class hours from the timetable: each meeting, times its real length.
  const classHours = useMemo(() => {
    let minutes = 0;
    for (const m of catalog.modules) {
      const length = spanOf(m.course.meets) ?? 50;
      for (const block of m.schedule ?? []) minutes += block.days.length * length;
    }
    return minutes / 60;
  }, [catalog.modules]);

  const week = load(classHours, activityHours);

  const classesOn = useMemo(() => {
    const byDay = new Map<number, { title: string; at: number; minutes: number }[]>();
    for (const m of catalog.modules) {
      const length = spanOf(m.course.meets) ?? 50;
      for (const block of m.schedule ?? []) {
        for (const day of block.days) {
          const list = byDay.get(day) ?? [];
          list.push({ title: m.course.code, at: block.at, minutes: length });
          byDay.set(day, list);
        }
      }
    }
    return (day: number) => byDay.get(day) ?? [];
  }, [catalog.modules]);

  const conflicts = useMemo(() => clashes(mine, classesOn), [mine, classesOn]);

  return (
    <div style={{ padding: 18 }}>
      <Segmented
        options={[
          { id: 'yours', label: 'Yours' },
          { id: 'add', label: 'Add one' },
          { id: 'find', label: 'Find things' },
        ]}
        value={tab}
        onChange={setTab}
        style={{ marginBottom: 16 }}
      />

      {tab === 'yours' && (
        <>
          <Blueprint style={{ padding: '14px 15px' }}>
            <div className="kicker">Your week</div>
            <div style={{ fontSize: 'calc(13.5px * var(--text-scale, 1))', marginTop: 8, lineHeight: 1.55 }}>{loadLine(week)}</div>
            <div
              style={{
                display: 'flex',
                gap: 14,
                marginTop: 12,
                paddingTop: 11,
                borderTop: '1px solid var(--app-line)',
                fontSize: 'calc(11.5px * var(--text-scale, 1))',
                opacity: 0.65,
              }}
            >
              <span>{showHours(week.classHours)} in class</span>
              <span>{showHours(week.activityHours)} elsewhere</span>
              <span>{mine.filter((c) => c.active).length} commitments</span>
            </div>
          </Blueprint>

          {conflicts.length > 0 && (
            <div
              style={{
                fontSize: 'calc(12.5px * var(--text-scale, 1))',
                marginTop: 12,
                padding: '11px 13px',
                borderRadius: 'var(--r-md)',
                lineHeight: 1.5,
                border: '1px solid var(--app-warn-line)',
                background: 'var(--app-warn-wash)',
              }}
            >
              {conflicts.map((clash, i) => (
                <div key={i} style={{ marginBottom: i === conflicts.length - 1 ? 0 : 6 }}>
                  <strong style={{ fontWeight: 600 }}>{clash.commitment.name}</strong> runs into{' '}
                  {clash.classTitle} on {dayName(clash.day)}s.
                </div>
              ))}
              <div style={{ opacity: 0.75, marginTop: 8 }}>
                Said rather than prevented — leaving lecture early on match days is a real thing
                people do, and the app does not get to decide that.
              </div>
            </div>
          )}

          <SectionLabel>What you are in</SectionLabel>
          {mine.length === 0 && (
            <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.55, padding: '14px 0', lineHeight: 1.5 }}>
              Nothing yet. Add a club, a job, a team or a lab and it appears on your day and week
              alongside your classes.
            </div>
          )}
          {mine.map((c) => (
            <Row key={c.id} commitment={c} />
          ))}
        </>
      )}

      {tab === 'add' && <AddOne onDone={() => setTab('yours')} />}
      {tab === 'find' && <FindThings />}
      <div style={{ height: 26 }} />
    </div>
  );
}

function Row({ commitment }: { commitment: Commitment }) {
  const { dispatch } = useStore();
  const kind = activityKind(commitment.kind);
  const when =
    commitment.at === null
      ? `${showHours(hoursOf(commitment))} a week`
      : `${commitment.days.map((d) => DAYS.find((x) => x.day === d)?.label ?? '').join('')} · ${clock(
          commitment.at,
        )}`;

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        borderBottom: '1px solid var(--app-line)',
        opacity: commitment.active ? 1 : 0.5,
      }}
    >
      <button
        type="button"
        className="bare tappable"
        onClick={() =>
          dispatch({
            type: 'patchCommitment',
            id: commitment.id,
            patch: { active: !commitment.active },
          })
        }
        aria-label={commitment.active ? `Pause ${commitment.name}` : `Resume ${commitment.name}`}
        style={{ flex: 'none', width: 30, padding: '13px 2px 13px 0' }}
      >
        <TickBox on={commitment.active} />
      </button>
      <div style={{ flex: 1, minWidth: 0, padding: '12px 0' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              flex: 'none',
              background: kindOf(kind.tint).tint,
            }}
          />
          <span style={{ fontSize: 'calc(14.5px * var(--text-scale, 1))', minWidth: 0 }}>{commitment.name}</span>
        </div>
        <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 2 }}>
          {[kind.label, commitment.role, when, commitment.where].filter(Boolean).join(' · ')}
        </div>
      </div>
      {commitment.url ? (
        <a
          href={commitment.url}
          target="_blank"
          rel="noreferrer"
          style={{ flex: 'none', fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.6, textDecoration: 'none' }}
        >
          OPEN
        </a>
      ) : null}
      <button
        type="button"
        className="bare"
        onClick={() => dispatch({ type: 'removeCommitment', id: commitment.id })}
        aria-label={`Remove ${commitment.name}`}
        style={{ width: 26, flex: 'none', opacity: 0.45, fontSize: 'calc(15px * var(--text-scale, 1))' }}
      >
        ×
      </button>
    </div>
  );
}

function AddOne({ onDone }: { onDone: () => void }) {
  const { dispatch } = useStore();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ActivityKind>('club');
  const [role, setRole] = useState('');
  const [where, setWhere] = useState('');
  const [url, setUrl] = useState('');
  const [days, setDays] = useState<number[]>([]);
  const [time, setTime] = useState('');
  const [minutes, setMinutes] = useState('60');
  const [hours, setHours] = useState('');
  const [fixed, setFixed] = useState(true);

  const at = useMemo(() => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    return h <= 23 && min <= 59 ? h * 60 + min : null;
  }, [time]);

  const ready = name.trim().length > 1 && (fixed ? days.length > 0 && at !== null : hours !== '');

  return (
    <>
      <SectionLabel>What is it</SectionLabel>
      <input
        className="input"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          // Offered, not applied silently — you can change it below.
          if (e.target.value.trim().length > 3) setKind(guessKind(e.target.value));
        }}
        placeholder="Vanderbilt Political Review"
        style={{ width: '100%' }}
      />

      <SectionLabel>What kind</SectionLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {ACTIVITY_KINDS.map((k) => {
          const on = k.id === kind;
          return (
            <button
              key={k.id}
              type="button"
              className="btn"
              onClick={() => setKind(k.id)}
              aria-pressed={on}
              style={{
                flex: 'none',
                padding: '6px 11px',
                fontSize: 'calc(11.5px * var(--text-scale, 1))',
                background: on ? 'var(--app-accent-wash)' : 'transparent',
                borderColor: on ? 'var(--app-accent-deep)' : undefined,
              }}
            >
              {k.label}
            </button>
          );
        })}
      </div>

      <SectionLabel>When</SectionLabel>
      <Segmented
        options={[
          { id: 'fixed', label: 'It meets at a set time' },
          { id: 'loose', label: 'Hours vary' },
        ]}
        value={fixed ? 'fixed' : 'loose'}
        onChange={(v) => setFixed(v === 'fixed')}
        style={{ marginBottom: 10 }}
      />

      {fixed ? (
        <>
          <div style={{ display: 'flex', gap: 5, marginBottom: 9 }}>
            {DAYS.map((d) => {
              const on = days.includes(d.day);
              return (
                <button
                  key={d.day}
                  type="button"
                  className="btn"
                  aria-pressed={on}
                  aria-label={d.label}
                  onClick={() =>
                    setDays((prior) =>
                      on ? prior.filter((x) => x !== d.day) : [...prior, d.day].sort((a, b) => a - b),
                    )
                  }
                  style={{
                    flex: 1,
                    padding: '7px 0',
                    fontSize: 'calc(11.5px * var(--text-scale, 1))',
                    background: on ? 'var(--app-accent-wash)' : 'transparent',
                  }}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              aria-label="Start time"
              style={{ flex: 1, minWidth: 0 }}
            />
            <input
              className="input"
              type="number"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              aria-label="Minutes long"
              style={{ width: 96, flex: 'none' }}
            />
          </div>
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 6 }}>
            Start time and how many minutes it runs. It goes on your day and week grids.
          </div>
        </>
      ) : (
        <>
          <input
            className="input"
            type="number"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="Hours a week"
            style={{ width: '100%' }}
          />
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 6, lineHeight: 1.45 }}>
            Your figure, not a guess at one. It counts toward the week without being drawn on the
            grid, because there is no hour to draw it on.
          </div>
        </>
      )}

      <SectionLabel>The rest, if you have it</SectionLabel>
      <input
        className="input"
        value={role}
        onChange={(e) => setRole(e.target.value)}
        placeholder="Your role — member, treasurer, RA"
        style={{ width: '100%', marginBottom: 8 }}
      />
      <input
        className="input"
        value={where}
        onChange={(e) => setWhere(e.target.value)}
        placeholder="Where it meets"
        style={{ width: '100%', marginBottom: 8 }}
      />
      <input
        className="input"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Its page — AnchorLink, a lab site"
        style={{ width: '100%' }}
      />

      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={!ready}
        onClick={() => {
          dispatch({
            type: 'addCommitment',
            commitment: {
              name: name.trim(),
              kind,
              role: role.trim(),
              where: where.trim(),
              url: url.trim(),
              note: '',
              days: fixed ? days : [],
              at: fixed ? at : null,
              minutes: Math.max(15, Number(minutes) || 60),
              hours: fixed ? 0 : Math.max(0, Number(hours) || 0),
              active: true,
            },
          });
          onDone();
        }}
        style={{ height: 46, marginTop: 16, letterSpacing: '0.1em', textTransform: 'uppercase' }}
      >
        Add it
      </button>
    </>
  );
}

const LINKS = [
  {
    id: 'anchorlink',
    name: 'AnchorLink',
    url: 'https://anchorlink.vanderbilt.edu/',
    blurb: 'Every registered organisation, their events, and how to join one.',
  },
  {
    id: 'athletics',
    name: 'Commodore athletics',
    url: 'https://vucommodores.com',
    blurb: 'Varsity schedules, results, and student tickets.',
  },
];

function FindThings() {
  const { dispatch } = useStore();
  const [text, setText] = useState('');
  const found = useMemo(() => readInvolvement(text), [text]);
  const [taken, setTaken] = useState<string[]>([]);

  return (
    <>
      <SectionLabel>Where things are</SectionLabel>
      {LINKS.map((l) => (
        <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="bare">
          <Blueprint
            style={{
              padding: '14px 15px',
              marginBottom: 9,
              display: 'flex',
              gap: 12,
              alignItems: 'center',
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 'calc(15px * var(--text-scale, 1))' }}>{l.name}</span>
              <span style={{ display: 'block', fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 2 }}>
                {l.blurb}
              </span>
            </span>
            <ChevronRight size={16} style={{ opacity: 0.4, flex: 'none' }} />
          </Blueprint>
        </a>
      ))}
      <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, lineHeight: 1.45, marginTop: 4 }}>
        No list of organisations is built into the app. There are several hundred and they turn
        over every year — a stale one would have you emailing a president who graduated in 2021.
        AnchorLink is the list, and it is always current.
      </div>

      <SectionLabel>Bring your involvement list back</SectionLabel>
      <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.65, lineHeight: 1.5, marginBottom: 10 }}>
        Open your involvement page on AnchorLink, select it, copy, and paste here. Nothing is read
        from the page — a browser will not let this app see a tab it does not own, and it should
        not.
      </div>
      <textarea
        className="input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'Vanderbilt Political Review\nHabitat for Humanity'}
        style={{ width: '100%', minHeight: 110, resize: 'vertical', lineHeight: 1.5 }}
      />

      {text.trim() && found.length === 0 && (
        <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.6, marginTop: 10, lineHeight: 1.45 }}>
          Nothing in there reads as an organisation name. Navigation, counts and links are dropped
          rather than filed as clubs.
        </div>
      )}

      {found.length > 0 && (
        <>
          <SectionLabel>Found {found.length} — check them</SectionLabel>
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginBottom: 8, lineHeight: 1.45 }}>
            An involvement page has no reliable shape, so this is a loose read. The kind beside each
            is a guess from the name and you can change it after adding.
          </div>
          {found.map((f) => {
            const already = taken.includes(f.name);
            return (
              <div
                key={f.name}
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  borderBottom: '1px solid var(--app-line)',
                  padding: '11px 0',
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 'calc(14px * var(--text-scale, 1))' }}>{f.name}</span>
                  <span style={{ display: 'block', fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 2 }}>
                    {[activityKind(guessKind(f.name)).label, f.role].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={already}
                  onClick={() => {
                    dispatch({
                      type: 'addCommitment',
                      commitment: {
                        name: f.name,
                        kind: guessKind(f.name),
                        role: f.role,
                        where: '',
                        url: '',
                        note: '',
                        days: [],
                        at: null,
                        minutes: 60,
                        hours: 0,
                        active: true,
                      },
                    });
                    setTaken((t) => [...t, f.name]);
                  }}
                  style={{ flex: 'none', padding: '0 14px', height: 34, fontSize: 'calc(12px * var(--text-scale, 1))' }}
                >
                  {already ? 'Added' : 'Add'}
                </button>
              </div>
            );
          })}
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 10, lineHeight: 1.45 }}>
            They arrive with no hours and no meeting time, because an involvement page carries
            neither. Open one under Yours to say when it meets and what it costs you.
          </div>
        </>
      )}
    </>
  );
}
