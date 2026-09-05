import { useState } from 'react';
import { useStore } from '../state/store';
import { useLive } from '../lib/live';
import { cardKey } from '../lib/review';
import { KINDS, OFFER, doneLine, newMortem, saidSomething, type MissKind, type PostMortem as Mortem } from '../lib/postmortem';
import type { Returned } from '../lib/returned';
import { unitName } from '../lib/unit';

/**
 * Two questions, once, at the moment a paper comes back.
 *
 * The mark is the least informative thing on it — two people lose the same
 * fifteen points for opposite reasons, and the reason decides what to do next.
 * See `lib/postmortem.ts` for what it does with the answers and, more
 * importantly, what it refuses to do to the card record.
 *
 * Closed until asked for, so the panel it sits in stays a panel about a mark.
 * Skipping it leaves nothing half-finished behind: a post-mortem with nothing
 * in it is never stored.
 */
export function PostMortem({ record, courseId }: { record: Returned; courseId: string }) {
  const { dispatch, now } = useStore();
  const { guide } = useLive(courseId);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Mortem>(() => record.mortem ?? newMortem(now.getTime()));

  const units = guide.units;
  const done = record.mortem;

  if (!open) {
    return (
      <div style={{ marginTop: 10 }}>
        {done ? (
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.6, lineHeight: 1.45, textWrap: 'pretty' }}>
            {doneLine(done, units.map((u) => unitName(u.name)))}
          </div>
        ) : (
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, lineHeight: 1.45, textWrap: 'pretty' }}>
            {OFFER}
          </div>
        )}
        <button
          type="button"
          className="bare tappable"
          onClick={() => {
            setDraft(record.mortem ?? newMortem(now.getTime()));
            setOpen(true);
          }}
          style={{
            width: 'auto',
            padding: '6px 10px',
            marginTop: 7,
            borderRadius: 'var(--r-sm)',
            border: '1px solid var(--app-line)',
            fontSize: 'calc(11px * var(--text-scale, 1))',
            fontFamily: 'var(--font-heading)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          {done ? 'Change it' : 'Where the marks went'}
        </button>
      </div>
    );
  }

  const toggleUnit = (i: number) =>
    setDraft({
      ...draft,
      units: draft.units.includes(i) ? draft.units.filter((u) => u !== i) : [...draft.units, i],
    });
  const toggleKind = (k: MissKind) =>
    setDraft({
      ...draft,
      kinds: draft.kinds.includes(k) ? draft.kinds.filter((x) => x !== k) : [...draft.kinds, k],
    });

  const chip = (on: boolean) => ({
    width: 'auto' as const,
    padding: '6px 10px',
    borderRadius: 'var(--r-sm)',
    border: `1px solid ${on ? 'var(--app-accent)' : 'var(--app-line)'}`,
    background: on ? 'var(--app-accent-wash)' : 'transparent',
    fontSize: 'calc(11.5px * var(--text-scale, 1))',
  });

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--app-line)' }}>
      <div className="kicker">Which topics did you lose points on?</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {units.map((u, i) => (
          <button
            key={u.name}
            type="button"
            className="bare tappable"
            aria-pressed={draft.units.includes(i)}
            onClick={() => toggleUnit(i)}
            style={chip(draft.units.includes(i))}
          >
            {unitName(u.name)}
          </button>
        ))}
      </div>
      <input
        className="input"
        value={draft.other}
        onChange={(e) => setDraft({ ...draft, other: e.target.value })}
        placeholder="Anything the units do not cover"
        aria-label="Anything the units do not cover"
        style={{ height: 36, marginTop: 8, fontSize: 'calc(12.5px * var(--text-scale, 1))' }}
      />

      <div className="kicker" style={{ marginTop: 14 }}>
        What kind of miss?
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            className="bare tappable"
            aria-pressed={draft.kinds.includes(k.id)}
            onClick={() => toggleKind(k.id)}
            style={{ ...chip(draft.kinds.includes(k.id)), textAlign: 'left', width: '100%' }}
          >
            <span style={{ display: 'block' }}>{k.label}</span>
            <span style={{ display: 'block', fontSize: 'calc(10.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 2 }}>
              {k.blurb}
            </span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setOpen(false)}
          style={{ flex: 1, height: 42, letterSpacing: '0.08em', textTransform: 'uppercase' }}
        >
          Skip
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!saidSomething(draft)}
          onClick={() => {
            // The screen turns unit indexes into card keys, because the
            // reducer has no guide to look them up in.
            const keys = draft.units.flatMap((i) =>
              (units[i]?.cards ?? []).map((c) => cardKey(courseId, c.q)),
            );
            dispatch({
              type: 'postMortem',
              id: record.id,
              mortem: { ...draft, at: now.getTime() },
              keys,
            });
            setOpen(false);
          }}
          style={{
            flex: 1,
            height: 42,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            opacity: saidSomething(draft) ? 1 : 0.45,
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}
