/**
 * Internships, jobs, research posts — the other deadline set.
 *
 * A term runs two calendars at once and the app only knew about one. The
 * syllabus calendar is published and readable; the recruiting calendar arrives
 * by email, on a careers portal and in a conversation at a coffee chat, and it
 * has been living in a spreadsheet or nowhere.
 *
 * The reason it belongs *here* rather than in a spreadsheet is that its
 * deadlines land on the same days as coursework. A first-round application due
 * the same Friday as a paper is one Friday, not two problems, and nothing
 * could say so while they were in different places.
 *
 * Every row carries one next action in the student's own words. Not a status —
 * a status is something you read, and a next action is something you do. It is
 * free text because "email Priya about the referral" was never going to be one
 * of eight options in a dropdown.
 */

import { useState } from 'react';
import { useStore } from '../state/store';
import { Suggested } from '../components/Suggested';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel, Segmented } from '../components/ui';
import {
  KINDS,
  LIVE,
  STAGES,
  daysInStage,
  line,
  order,
  quiet,
  safeUrl,
  summary,
  title,
  type Application,
  type ApplyKind,
  type Stage,
} from '../lib/apply';

export function Applying() {
  const { state, now } = useStore();
  const [tab, setTab] = useState<'open' | 'add' | 'closed'>('open');

  const open = order(
    state.applications.filter((a) => LIVE.includes(a.stage)),
    now,
  );
  const closed = order(
    state.applications.filter((a) => !LIVE.includes(a.stage)),
    now,
  );

  return (
    <div style={{ padding: 18 }}>
      <Blueprint style={{ padding: '14px 15px' }}>
        <div className="kicker">Where it stands</div>
        <div
          className="chrome-text"
          style={{ marginTop: 5, fontSize: 'calc(14px * var(--text-scale, 1))', textWrap: 'pretty' }}
        >
          {summary(state.applications, now)}
        </div>
      </Blueprint>

      <Segmented
        options={[
          { id: 'open', label: `Open${open.length ? ` (${open.length})` : ''}` },
          { id: 'add', label: 'Add one' },
          { id: 'closed', label: `Closed${closed.length ? ` (${closed.length})` : ''}` },
        ]}
        value={tab}
        onChange={setTab}
        style={{ margin: '16px 0' }}
      />

      {tab === 'add' ? <AddOne onAdded={() => setTab('open')} /> : null}

      {tab === 'open' ? (
        open.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {open.map((a) => (
              <Row key={a.id} a={a} />
            ))}
          </div>
        ) : (
          <p
            style={{
              fontSize: 'calc(12.5px * var(--text-scale, 1))',
              opacity: 0.6,
              lineHeight: 1.55,
              textWrap: 'pretty',
            }}
          >
            Nothing tracked yet. Anything with a date on it turns up on Today and in the
            calendar alongside coursework — which is the point, because they land on the same
            days.
          </p>
        )
      ) : null}

      {tab === 'closed' ? (
        closed.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {closed.map((a) => (
              <Row key={a.id} a={a} />
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.6 }}>
            Nothing closed out yet.
          </p>
        )
      ) : null}
      {/* Suggested, never added. See `components/Suggested.tsx`. */}
      <Suggested />

    </div>
  );
}

function Row({ a }: { a: Application }) {
  const { dispatch, now } = useStore();
  const [open, setOpen] = useState(false);
  const url = safeUrl(a.url);

  return (
    <Blueprint style={{ padding: '13px 14px' }}>
      <button
        type="button"
        className="bare tappable"
        onClick={() => setOpen(!open)}
        style={{ display: 'block', width: '100%', textAlign: 'left' }}
      >
        <span
          style={{
            display: 'block',
            fontSize: 'calc(14.5px * var(--text-scale, 1))',
            textWrap: 'pretty',
          }}
        >
          {title(a)}
        </span>
        <span
          style={{
            display: 'block',
            fontSize: 'calc(11.5px * var(--text-scale, 1))',
            opacity: 0.62,
            marginTop: 3,
            textWrap: 'pretty',
          }}
        >
          {line(a, now)}
        </span>
      </button>

      {a.next ? (
        <div
          style={{
            marginTop: 8,
            padding: '8px 10px',
            borderRadius: 'var(--r-sm)',
            background: 'var(--app-warn-wash)',
            border: '1px solid var(--app-warn-line)',
            fontSize: 'calc(12.5px * var(--text-scale, 1))',
            lineHeight: 1.45,
            textWrap: 'pretty',
          }}
        >
          Next: {a.next}
          {a.nextBy ? ` · by ${a.nextBy}` : ''}
        </div>
      ) : null}

      {open ? (
        <div style={{ marginTop: 11 }}>
          <div className="kicker">Move it</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {STAGES.map((s) => (
              <button
                key={s.id}
                type="button"
                className="bare tappable"
                aria-pressed={a.stage === s.id}
                onClick={() => dispatch({ type: 'moveApplication', id: a.id, stage: s.id })}
                style={{
                  width: 'auto',
                  padding: '7px 11px',
                  borderRadius: 'var(--r-sm)',
                  border: `1px solid ${a.stage === s.id ? 'var(--app-accent)' : 'var(--app-line)'}`,
                  fontSize: 'calc(11.5px * var(--text-scale, 1))',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="kicker" style={{ marginTop: 12 }}>
            The next thing you have to do
          </div>
          <input
            className="input"
            value={a.next}
            onChange={(e) =>
              dispatch({ type: 'patchApplication', id: a.id, patch: { next: e.target.value } })
            }
            placeholder="Email Priya about the referral"
            aria-label={`Next step for ${title(a)}`}
            spellCheck
            style={{ width: '100%', height: 40, marginTop: 6 }}
          />
          <input
            className="input"
            type="date"
            value={a.nextBy}
            onChange={(e) =>
              dispatch({ type: 'patchApplication', id: a.id, patch: { nextBy: e.target.value } })
            }
            aria-label={`When the next step for ${title(a)} is wanted by`}
            style={{ width: 170, height: 38, marginTop: 7 }}
          />

          <div
            style={{
              fontSize: 'calc(11.5px * var(--text-scale, 1))',
              opacity: 0.55,
              marginTop: 11,
              lineHeight: 1.5,
              textWrap: 'pretty',
            }}
          >
            {daysInStage(a, now)} days in this stage
            {quiet(a, now) ? ' — worth a nudge, though the app has no opinion about that' : ''}.
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {url ? (
              <a
                className="bare tappable"
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                style={{
                  width: 'auto',
                  padding: '7px 12px',
                  borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--app-line)',
                  fontSize: 'calc(11.5px * var(--text-scale, 1))',
                  textDecoration: 'none',
                }}
              >
                Open the posting
              </a>
            ) : null}
            <button
              type="button"
              className="bare tappable"
              onClick={() => dispatch({ type: 'removeApplication', id: a.id })}
              style={{
                width: 'auto',
                padding: '7px 12px',
                fontSize: 'calc(11.5px * var(--text-scale, 1))',
                opacity: 0.5,
              }}
            >
              Delete
            </button>
          </div>
        </div>
      ) : null}
    </Blueprint>
  );
}

function AddOne({ onAdded }: { onAdded: () => void }) {
  const { dispatch } = useStore();
  const [org, setOrg] = useState('');
  const [role, setRole] = useState('');
  const [kind, setKind] = useState<ApplyKind>('internship');
  const [due, setDue] = useState('');
  const [rolling, setRolling] = useState(false);
  const [url, setUrl] = useState('');
  const [stage, setStage] = useState<Stage>('found');

  const add = () => {
    if (!org.trim() && !role.trim()) return;
    dispatch({
      type: 'addApplication',
      patch: { org, role, kind, due: rolling ? '' : due, rolling, url, stage },
    });
    setOrg('');
    setRole('');
    setDue('');
    setUrl('');
    setRolling(false);
    onAdded();
  };

  return (
    <>
      <input
        className="input"
        value={org}
        onChange={(e) => setOrg(e.target.value)}
        placeholder="Who it is with"
        aria-label="Who the application is with"
        style={{ width: '100%', height: 42 }}
      />
      <input
        className="input"
        value={role}
        onChange={(e) => setRole(e.target.value)}
        placeholder="What the post is"
        aria-label="What the post is"
        style={{ width: '100%', height: 42, marginTop: 8 }}
      />

      <SectionLabel style={{ margin: '16px 0 8px' }}>What kind</SectionLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            className="bare tappable"
            aria-pressed={kind === k.id}
            onClick={() => setKind(k.id)}
            style={{
              width: 'auto',
              padding: '7px 12px',
              borderRadius: 'var(--r-sm)',
              border: `1px solid ${kind === k.id ? 'var(--app-accent)' : 'var(--app-line)'}`,
              fontSize: 'calc(11.5px * var(--text-scale, 1))',
            }}
          >
            {k.label}
          </button>
        ))}
      </div>

      <SectionLabel style={{ margin: '16px 0 8px' }}>When it closes</SectionLabel>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="input"
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          disabled={rolling}
          aria-label="The application deadline"
          style={{ width: 170, height: 40 }}
        />
        <button
          type="button"
          className="bare tappable"
          aria-pressed={rolling}
          onClick={() => setRolling(!rolling)}
          style={{
            width: 'auto',
            padding: '8px 13px',
            borderRadius: 'var(--r-sm)',
            border: `1px solid ${rolling ? 'var(--app-accent)' : 'var(--app-line)'}`,
            fontSize: 'calc(11.5px * var(--text-scale, 1))',
          }}
        >
          Rolling
        </button>
      </div>
      {/* Rolling is a real state and not the same as an unknown date. Saying
          so is what stops the list quietly treating "open until filled" as
          "no hurry". */}
      <div
        style={{
          fontSize: 'calc(11.5px * var(--text-scale, 1))',
          opacity: 0.55,
          marginTop: 7,
          lineHeight: 1.5,
          textWrap: 'pretty',
        }}
      >
        {rolling
          ? 'Open until filled. Nothing will land on a day for it, so give it a next step instead.'
          : 'Leave it blank if you do not know yet — the app will not guess one.'}
      </div>

      <SectionLabel style={{ margin: '16px 0 8px' }}>Where it has got to</SectionLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {STAGES.filter((s) => s.id !== 'closed').map((s) => (
          <button
            key={s.id}
            type="button"
            className="bare tappable"
            aria-pressed={stage === s.id}
            onClick={() => setStage(s.id)}
            style={{
              width: 'auto',
              padding: '7px 12px',
              borderRadius: 'var(--r-sm)',
              border: `1px solid ${stage === s.id ? 'var(--app-accent)' : 'var(--app-line)'}`,
              fontSize: 'calc(11.5px * var(--text-scale, 1))',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <input
        className="input"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Link to the posting — optional"
        aria-label="Link to the posting"
        style={{ width: '100%', height: 42, marginTop: 16 }}
      />

      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={add}
        style={{ height: 46, marginTop: 14, textTransform: 'uppercase', letterSpacing: '0.09em' }}
      >
        Add it
      </button>
    </>
  );
}
