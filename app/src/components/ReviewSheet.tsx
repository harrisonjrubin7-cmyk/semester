import { useMemo, useState } from 'react';
import { says } from '../lib/casework';
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

/**
 * How much of a passage a row shows.
 *
 * Every other detail here is a sentence — a card's answer, a definition, a
 * figure's caption. A unit's detail is the reading itself, and a chapter
 * rendered in full put the button that accepts it 1,400px below the top of
 * the sheet: measured in Chromium at 420×900 against a 3KB reading, which is
 * a short one. The row exists to be decided on, and a decision you have to
 * scroll a chapter to reach is the same dead press this sheet was moved down
 * the screen to fix.
 */
const PASSAGE = 260;

/**
 * The first `units` code units, never stopping inside a character.
 *
 * `slice` counts UTF-16 units and an emoji is two of them, so a cut at 260
 * can leave a lone high surrogate and the row ends in a replacement glyph.
 * The same guard, for the same reason, as `cut` in `lib/xlsx.ts` and the
 * surrogate filter in `lib/ooxml.ts`.
 */
function wholeChars(text: string, units: number): string {
  let out = '';
  for (const ch of text) {
    if (out.length + ch.length > units) break;
    out += ch;
  }
  return out;
}

/**
 * The passage, trimmed at a word where there is one, and how much is not shown.
 *
 * Counted in characters rather than words, which is the only unit that is true
 * of every passage this renders. Counting words meant splitting the tail on
 * whitespace, and a reading with none — Japanese or Chinese prose, a URL, a
 * base64 blob — has exactly one "word" however much of it is left: a 3,000
 * character passage reported one more word remaining. A character count cannot
 * be wrong that way.
 */
function shorten(text: string): { said: string; more: number } {
  if (text.length <= PASSAGE) return { said: text, more: 0 };
  const cut = wholeChars(text, PASSAGE);
  const at = cut.lastIndexOf(' ');
  const said = at > PASSAGE * 0.6 ? cut.slice(0, at) : cut;
  return { said, more: text.length - said.length };
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
  if (p.what === 'example') return says(p.example);
  if (p.what === 'figure') return p.figure.caption;
  return '';
}

export function ReviewSheet({
  set,
  says,
  dropped,
  source,
  course,
  attaching = 0,
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
  /**
   * Files riding along with whatever is accepted, counted.
   *
   * A file is the material itself rather than a claim about the course, so it
   * has nothing to tick — but it is written by the same press, and a press
   * this sheet refuses is a file that never reaches the course. Two things
   * depend on the count: a photograph of the board produces no pieces at all
   * and used to leave a sheet with nothing to press, and a reader who unticks
   * every proposal still meant to keep the PDF.
   */
  attaching?: number;
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
        <div style={{ fontSize: 'var(--type-base)', lineHeight: 'var(--leading-relaxed)', color: 'var(--app-dim)' }}>
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
        <div style={{ fontSize: 'var(--type-base)', lineHeight: 'var(--leading-relaxed)', color: 'var(--app-dim)' }}>
          {set.duplicates > 0
            ? `Everything in ${source} is already covered by ${course} — ${set.duplicates} ${set.duplicates === 1 ? 'piece' : 'pieces'} checked, none of them new. That is a good answer, not a failure.`
            : `Nothing came out of ${source} that this could add.`}
        </div>
        {/*
          And the file itself is still a thing to keep.

          A photograph of the board reads as nothing — the camera path is what
          sees it — so this branch was the whole of what happened when one was
          attached: a sentence, and no way to press anything. The screen's own
          hint says images become figures for the unit, and they could not,
          because the only control that writes was not drawn.
        */}
        {attaching > 0 && (
          <>
            <div
              style={{
                fontSize: 'var(--type-sm)',
                color: 'var(--app-dim)',
                marginTop: 'var(--sp-4)',
                lineHeight: 'var(--leading-normal)',
              }}
            >
              {/*
                True whichever unit was chosen above. "It goes on the unit"
                was not: with the screen's default — a unit of its own —
                `mergeGuide` skips a card-less update and `place()` sends the
                photograph to the shared rail, so no unit was made and no unit
                gained a figure. It is on the course's figures either way,
                which is what this now says.
              */}
              {attaching === 1
                ? `The file is still yours to keep — it stays with ${course}, and an image joins its figures.`
                : `The ${attaching} files are still yours to keep — they stay with ${course}, and any image among them joins its figures.`}
            </div>
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={applying}
              onClick={() => onApply([])}
              style={{ height: 46, marginTop: 'var(--sp-4)' }}
            >
              {applying
                ? 'Adding…'
                : `Attach ${attaching === 1 ? 'it' : `the ${attaching} files`} to ${course}`}
            </button>
          </>
        )}
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
            color: 'var(--app-dim)',
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
                  color: verdict === 'conflict' ? 'var(--app-warn)' : 'var(--app-dim)',
                }}
              >
                {rows.length} {HEADING[verdict].toLowerCase()}
              </span>
              {foldable && (
                <button
                  type="button"
                  className="bare tappable"
                  onClick={() => setOpen((was) => ({ ...was, [verdict]: !was[verdict] }))}
                  style={{ width: 'auto', flex: 'none', fontSize: 'var(--type-xs)', color: 'var(--app-dim)' }}
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
                  paddingBlock: 'calc(11px * var(--density, 1))', paddingInline: 'calc(12px * var(--density, 1))',
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
            color: 'var(--app-dim)',
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
            color: 'var(--app-dim)',
            marginBottom: 'var(--sp-6)',
            lineHeight: 'var(--leading-normal)',
          }}
        >
          Left out because the words were not in the file: {dropped.join('; ')}.
        </div>
      )}

      {/*
        Dead only when there is genuinely nothing to write. Ticking nothing
        while a PDF is attached is a decision about the proposals, not about
        the file, and a disabled button there loses the file.
      */}
      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={(count === 0 && attaching === 0) || applying}
        onClick={() => onApply(set.changes.filter((_, i) => taken[i]))}
        style={{ height: 46, marginTop: 'var(--sp-4)' }}
      >
        {applying
          ? 'Adding…'
          : count === 0 && attaching > 0
            ? `Attach ${attaching === 1 ? 'the file' : `the ${attaching} files`} only`
            : `Add the ${count} ticked`}
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
  const passage = shorten(detail(change));
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
        paddingBlock: 'calc(11px * var(--density, 1))', paddingInline: 'calc(12px * var(--density, 1))',
        marginBottom: 'calc(7px * var(--density, 1))',
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
            color: 'var(--app-dim)',
            marginTop: 'calc(3px * var(--density, 1))',
            lineHeight: 'var(--leading-normal)',
          }}
        >
          {passage.said}
          {/* Counted rather than cut off in silence: what is accepted is the
              whole passage, and a row that ends mid-sentence with nothing
              said reads as material that was lost. */}
          {passage.more > 0 &&
            `… and ${passage.more} more ${passage.more === 1 ? 'character' : 'characters'}, all of them kept`}
        </span>
      )}

      <span
        style={{
          display: 'block',
          fontSize: 'var(--type-sm)',
          color: 'var(--app-dim)',
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
            color: 'var(--app-dim)',
            marginTop: 'var(--sp-3)',
            paddingLeft: 'calc(9px * var(--density, 1))',
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
            color: 'var(--app-dim)',
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
