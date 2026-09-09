import { useMemo, useState } from 'react';
import type { Change, ChangeSet, Verdict } from '../lib/changeset';
import { SectionLabel } from './ui';
import { Folding } from './Fold';

/**
 * What an import would change, one row at a time, before anything is written.
 *
 * The same shape the announcement screen already uses: a tickable row per
 * change, the sentence it rests on underneath, and one button that applies the
 * ticked ones. That screen's principle is the whole point — a change you
 * cannot check is a change you should not take — and it applies more here,
 * because a deck produces thirty proposals rather than two.
 *
 * ## What is ticked when it opens, and what is not
 *
 * Adding something the course does not have is safe and starts ticked.
 * Replacing something you already have, and resolving a contradiction, are
 * decisions somebody has to make, so they start unticked and have to be
 * chosen. "Accept everything" exists and is not what happens by default.
 *
 * A conflict is never inside "accept everything". That is not a nicety: one of
 * the two dates is the one the exam is on, and an accept-all that silently
 * picks the new file is how somebody ends up revising for the wrong Wednesday.
 */

const HEADING: Record<Verdict, string> = {
  new: 'New',
  fuller: 'Fuller than what you have',
  'gap-fill': 'Completes something you started',
  conflict: 'Disagrees with your course',
  duplicate: '',
};

/** The order they are read in: what is safe, then what needs a decision. */
const ORDER: Verdict[] = ['new', 'gap-fill', 'fuller', 'conflict'];

/** Ticked when the sheet opens. Adding, yes; replacing and resolving, no. */
const SAFE: Verdict[] = ['new', 'gap-fill'];

function describe(change: Change): string {
  const p = change.piece;
  switch (p.what) {
    case 'card':
      return p.card.q;
    case 'term':
      return `${p.term.t} — ${p.term.d}`;
    case 'unit':
      return `A unit: ${p.name}`;
    case 'item':
      return `${p.title} — ${p.month + 1}/${p.day}${p.weight ? ` · ${p.weight}` : ''}`;
    case 'grade':
      return `${p.row.what} — ${p.row.pct}`;
    case 'note':
      return p.title;
    // The five a pasted reading produces. Named by the one field that
    // identifies each, which is what the reader is deciding about.
    case 'figure':
      return `A figure: ${p.figure.title}`;
    case 'frame':
      return `An exam framing: ${p.frame.t}`;
    case 'selftest':
      return `To answer out loud: ${p.card.q}`;
    case 'case':
      return `A claim and its test: ${p.file.title}`;
    case 'example':
      return `A worked example: ${p.example.t}`;
  }
}

/** The second line: what the card actually says, where there is more to say. */
function detail(change: Change): string {
  const p = change.piece;
  if (p.what === 'card') return p.card.a;
  if (p.what === 'note') return p.body;
  if (p.what === 'unit') return p.body;
  if (p.what === 'frame') return p.frame.d;
  if (p.what === 'selftest') return p.card.a;
  if (p.what === 'case') return `${p.file.claim} → ${p.file.verdict}`;
  if (p.what === 'example') return p.example.d;
  if (p.what === 'figure') return p.figure.caption;
  return '';
}

export function ReviewSheet({
  set,
  says,
  dropped,
  source,
  course,
  onApply,
  applying,
}: {
  set: ChangeSet;
  /** What the reader made of the material, in a sentence. */
  says: string;
  /** Passages it claimed and could not find. Named, never hidden. */
  dropped: string[];
  source: string;
  course: string;
  onApply: (accepted: Change[]) => void;
  applying?: boolean;
}) {
  const groups = useMemo(() => {
    const by = new Map<Verdict, { change: Change; at: number }[]>();
    set.changes.forEach((change, at) => {
      const list = by.get(change.verdict) ?? [];
      list.push({ change, at });
      by.set(change.verdict, list);
    });
    return by;
  }, [set]);

  const [taken, setTaken] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(set.changes.map((c, i) => [i, SAFE.includes(c.verdict)])),
  );
  /** Groups the reader has opened. A run of new cards is a count until asked. */
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const count = Object.values(taken).filter(Boolean).length;
  const conflicts = groups.get('conflict')?.length ?? 0;

  if (set.seenBefore) {
    return (
      <div style={{ marginTop: 'var(--sp-7)' }}>
        <Folding name="ReviewSheet">
        <SectionLabel>Already in</SectionLabel>
        <div style={{ fontSize: 'var(--type-base)', lineHeight: 'var(--leading-relaxed)', opacity: 0.75 }}>
          You have added this exact file to {course} before. Nothing in it is new, so there is
          nothing to review.
        </div>
        </Folding>
      </div>
    );
  }

  if (set.changes.length === 0) {
    return (
      <div style={{ marginTop: 'var(--sp-7)' }}>
        <Folding name="ReviewSheet">
        <SectionLabel>Nothing new</SectionLabel>
        <div style={{ fontSize: 'var(--type-base)', lineHeight: 'var(--leading-relaxed)', opacity: 0.75 }}>
          {set.duplicates > 0
            ? `Everything in ${source} is already covered by ${course} — ${set.duplicates} ${set.duplicates === 1 ? 'piece' : 'pieces'} checked, none of them new. That is a good answer, not a failure.`
            : `Nothing came out of ${source} that this could add.`}
        </div>
        </Folding>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 'var(--sp-7)' }}>
      <Folding name="ReviewSheet">
      <SectionLabel>
        {source} — {course}
      </SectionLabel>

      {says && (
        <div
          style={{
            fontSize: 'var(--type-base)',
            lineHeight: 'var(--leading-relaxed)',
            opacity: 0.75,
            marginBottom: 'var(--sp-6)',
          }}
        >
          {says}
        </div>
      )}

      {ORDER.map((verdict) => {
        const rows = groups.get(verdict);
        if (!rows || rows.length === 0) return null;
        /*
         * A run of new cards is a count with a way in, not thirty rows to
         * read past. Everything else is shown one at a time, because every
         * other verdict is a decision about something you already have.
         */
        const foldable = verdict === 'new' && rows.length > 3;
        const shown = foldable && !open[verdict] ? [] : rows;

        return (
          <div key={verdict} style={{ marginBottom: 'var(--sp-7)' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 'var(--sp-4)',
                marginBottom: 'var(--sp-4)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 'var(--type-xs)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  opacity: verdict === 'conflict' ? 1 : 0.6,
                  color: verdict === 'conflict' ? 'var(--app-warn)' : undefined,
                }}
              >
                {rows.length} {HEADING[verdict].toLowerCase()}
              </span>
              {foldable && (
                <button
                  type="button"
                  className="bare tappable"
                  onClick={() => setOpen((was) => ({ ...was, [verdict]: !was[verdict] }))}
                  style={{ width: 'auto', flex: 'none', fontSize: 'var(--type-xs)', opacity: 0.6 }}
                >
                  {open[verdict] ? 'FEWER' : 'REVIEW EACH'}
                </button>
              )}
            </div>

            {foldable && !open[verdict] && (
              <button
                type="button"
                className="bare tappable"
                aria-pressed={rows.every(({ at }) => taken[at])}
                onClick={() => {
                  const all = rows.every(({ at }) => taken[at]);
                  setTaken((was) => {
                    const next = { ...was };
                    for (const { at } of rows) next[at] = !all;
                    return next;
                  });
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '11px 12px',
                  borderRadius: 'var(--r-md)',
                  border: `1px solid ${rows.every(({ at }) => taken[at]) ? 'var(--app-accent-deep)' : 'var(--app-line)'}`,
                  background: rows.every(({ at }) => taken[at]) ? 'var(--app-accent-wash)' : 'transparent',
                  fontSize: 'var(--type-md)',
                }}
              >
                Add all {rows.length}
              </button>
            )}

            {shown.map(({ change, at }) => (
              <Row
                key={`${change.verdict}-${change.piece.hash}`}
                change={change}
                on={taken[at] ?? false}
                onToggle={() => setTaken((was) => ({ ...was, [at]: !was[at] }))}
              />
            ))}
          </div>
        );
      })}

      {set.duplicates > 0 && (
        <div
          style={{
            fontSize: 'var(--type-sm)',
            opacity: 0.55,
            marginBottom: 'var(--sp-6)',
            lineHeight: 'var(--leading-normal)',
          }}
        >
          {set.duplicates} {set.duplicates === 1 ? 'piece' : 'pieces'} already covered — skipped.
        </div>
      )}

      {dropped.length > 0 && (
        <div
          style={{
            fontSize: 'var(--type-sm)',
            opacity: 0.6,
            marginBottom: 'var(--sp-6)',
            lineHeight: 'var(--leading-normal)',
          }}
        >
          Left out because the words were not in the file: {dropped.join('; ')}.
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={count === 0 || applying}
        onClick={() => onApply(set.changes.filter((_, i) => taken[i]))}
        style={{ height: 46, marginTop: 'var(--sp-4)' }}
      >
        {applying ? 'Adding…' : `Add the ${count} ticked`}
      </button>

      {conflicts > 0 && (
        <div
          style={{
            fontSize: 'var(--type-sm)',
            color: 'var(--app-warn)',
            marginTop: 'var(--sp-4)',
            lineHeight: 'var(--leading-normal)',
          }}
        >
          {conflicts === 1 ? 'One disagreement is' : `${conflicts} disagreements are`} listed above
          and start unticked. One of the two is right and this cannot tell which.
        </div>
      )}
      </Folding>
    </div>
  );
}

function Row({
  change,
  on,
  onToggle,
}: {
  change: Change;
  on: boolean;
  onToggle: () => void;
}) {
  const conflict = change.verdict === 'conflict';
  const p = change.piece;
  const quote = 'quote' in p ? p.quote : undefined;
  const page = p.where.page;

  return (
    <button
      type="button"
      className="bare tappable"
      aria-pressed={on}
      onClick={onToggle}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '11px 12px',
        marginBottom: 7,
        borderRadius: 'var(--r-md)',
        border: `1px solid ${on ? 'var(--app-accent-deep)' : conflict ? 'var(--app-warn-line)' : 'var(--app-line)'}`,
        background: on ? 'var(--app-accent-wash)' : conflict ? 'var(--app-warn-wash)' : 'transparent',
      }}
    >
      <span style={{ display: 'block', fontSize: 'var(--type-md)', lineHeight: 'var(--leading-tight)' }}>
        {describe(change)}
      </span>

      {detail(change) && (
        <span
          style={{
            display: 'block',
            fontSize: 'var(--type-sm)',
            opacity: 0.7,
            marginTop: 3,
            lineHeight: 'var(--leading-normal)',
          }}
        >
          {detail(change)}
        </span>
      )}

      <span
        style={{
          display: 'block',
          fontSize: 'var(--type-sm)',
          opacity: 0.6,
          marginTop: 'var(--sp-3)',
          lineHeight: 'var(--leading-normal)',
        }}
      >
        {change.because}
      </span>

      {/* Both sides, for anything that would replace or contradict something.
          Seeing only the new one is not a choice, it is a prompt. */}
      {change.against && (
        <span
          style={{
            display: 'block',
            fontSize: 'var(--type-sm)',
            opacity: 0.62,
            marginTop: 'var(--sp-3)',
            paddingLeft: 9,
            borderLeft: `2px solid ${conflict ? 'var(--app-warn-line)' : 'var(--app-line)'}`,
            lineHeight: 'var(--leading-normal)',
          }}
        >
          Yours: {change.against}
        </span>
      )}

      {/* The sentence it rests on, and where it is. This is the safety of it. */}
      {(quote || page) && (
        <span
          style={{
            display: 'block',
            fontFamily: 'var(--font-heading)',
            fontSize: 'var(--type-xs)',
            letterSpacing: '0.06em',
            opacity: 0.5,
            marginTop: 'var(--sp-3)',
          }}
        >
          {page ? `SLIDE ${page}` : ''}
          {page && quote ? ' · ' : ''}
          {quote ? `“${quote.slice(0, 90)}”` : ''}
        </span>
      )}
    </button>
  );
}
