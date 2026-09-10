import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import { Page } from '../../components/Page';
import { Blueprint } from '../../components/Blueprint';
import { CoursePicker } from '../../components/CoursePicker';
import { Folding } from '../../components/Fold';
import { ActionButton, EmptyState, SectionLabel } from '../../components/ui';
import { ChevronLeft, ChevronRight, DeckIcon, Plus } from '../../components/Icons';
import { secondLine } from '../../lib/dim';
import { download } from '../../lib/deliver';
import { deckFileName, pptx, type Slide } from '../../lib/pptx';
import { revealKindly } from '../../lib/prefers';
import {
  LAYOUTS,
  blankSlide,
  duplicate,
  forExport,
  minutes,
  remove,
  reorder,
  running,
  setSlide,
  shown,
  toggleHidden,
  type Layout,
  type StoredDeck,
} from '../../lib/decks';

/**
 * Editing a deck, and giving it.
 *
 * `screens/Deck.tsx` builds decks — from a study unit, a table, or a brief —
 * and until now that was the whole of it: the deck went straight to a .pptx and
 * was forgotten. Which is fine for the export and wrong for everything else,
 * because the ten minutes before a seminar are spent cutting two slides and
 * rewriting a title, and the app could not do either.
 *
 * So: a rail of slides, one open at a time, and the four things anybody does to
 * a deck — reorder, duplicate, hide, delete. Plus the thing that is not
 * cosmetic at all, which is speaker notes, and the reason they matter is that
 * `lib/pptx.ts` now writes them as real notes parts. A note here shows up in
 * PowerPoint's presenter view rather than on the wall behind you.
 *
 * ## Hiding, rather than deleting
 *
 * The slide you cut for time is the slide you want back when a question comes.
 * Hidden slides keep their place on the rail, are skipped when presenting and
 * left out of the file, and come back exactly where they were.
 */
export function DeckEdit({ deck }: { deck: StoredDeck }) {
  const { dispatch, say } = useStore();
  const [at, setAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [presenting, setPresenting] = useState(false);

  const patch = (next: Partial<Omit<StoredDeck, 'id'>>) =>
    dispatch({ type: 'updateDeck', id: deck.id, patch: next });

  // A slide removed from under the cursor would otherwise leave `at` past the
  // end, and the editor drawing nothing at all.
  const on = Math.min(at, deck.slides.length - 1);
  const slide = deck.slides[on];
  const order = running(deck);

  const save = async () => {
    setBusy(true);
    try {
      const blob = await pptx(forExport(deck));
      download({
        name: deckFileName(deck.title),
        body: blob,
        mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      });
      say('PowerPoint file saved.');
    } finally {
      setBusy(false);
    }
  };

  if (presenting) {
    return <Presenter deck={deck} from={on} onDone={() => setPresenting(false)} />;
  }

  return (
    <Page
      blurb={`${order.length} ${order.length === 1 ? 'slide' : 'slides'}${
        deck.slides.length !== order.length ? ` · ${deck.slides.length - order.length} hidden` : ''
      } · about ${minutes(deck)} min`}
      actions={
        <ActionButton onClick={() => dispatch({ type: 'closeDeck' })}>All decks</ActionButton>
      }
    >
      <input
        className="input"
        value={deck.title}
        onChange={(e) => patch({ title: e.target.value })}
        placeholder="Title"
        aria-label="Deck title"
        style={{ width: '100%', height: 46, fontSize: 'var(--type-lg)' }}
      />
      <input
        className="input"
        value={deck.subtitle}
        onChange={(e) => patch({ subtitle: e.target.value })}
        placeholder="Subtitle, your name, the course — optional"
        aria-label="Deck subtitle"
        style={{ width: '100%', height: 40, marginTop: 'var(--sp-4)' }}
      />
      <CoursePicker value={deck.courseId} onChange={(id) => patch({ courseId: id })} />

      <ActionButton
        tone="primary"
        onClick={() => setPresenting(true)}
        style={{ marginTop: 'var(--sp-5)' }}
      >
        Present it
      </ActionButton>

      <SectionLabel>The slides</SectionLabel>
      <Rail
        deck={deck}
        on={on}
        onGo={setAt}
        onMove={(from, to) => {
          patch(reorder(deck, from, to));
          setAt(to);
        }}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', marginTop: 'var(--sp-4)' }}>
        {LAYOUTS.map((layout) => (
          <button
            key={layout.id}
            type="button"
            className="bare tappable"
            onClick={() => {
              const slides = [...deck.slides];
              slides.splice(on + 1, 0, blankSlide(layout.id as Layout));
              patch({
                slides,
                hidden: (deck.hidden ?? []).map((h) => (h > on ? h + 1 : h)),
              });
              setAt(on + 1);
            }}
            style={{
              width: 'auto',
              padding: 'var(--sp-3) var(--sp-5)',
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--app-line)',
              fontSize: 'var(--type-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-2)',
            }}
          >
            <Plus size={13} />
            {layout.label}
          </button>
        ))}
      </div>

      {slide && (
        <SlideEditor
          slide={slide}
          at={on}
          of={deck.slides.length}
          hidden={!shown(deck, on)}
          onChange={(next) => patch(setSlide(deck, on, next))}
          onDuplicate={() => patch(duplicate(deck, on))}
          onHide={() => patch(toggleHidden(deck, on))}
          onRemove={() => {
            patch(remove(deck, on));
            setAt(Math.max(0, on - 1));
          }}
        />
      )}

      <Folding name="Take it away">
        <ActionButton tone="primary" disabled={busy} onClick={() => void save()}>
          {busy ? 'Building…' : 'PowerPoint file (.pptx), notes and all'}
        </ActionButton>
        <div style={{ ...secondLine(), fontSize: 'var(--type-sm)', marginTop: 'var(--sp-4)' }}>
          Hidden slides are left out of the file. Speaker notes go in as real notes, so they show
          in PowerPoint’s presenter view rather than on the wall.
        </div>
      </Folding>

      <Folding name="This deck">
        <ActionButton
          onClick={() => {
            dispatch({ type: 'deleteDeck', id: deck.id });
            say('Deck deleted.');
          }}
        >
          Delete it
        </ActionButton>
      </Folding>
    </Page>
  );
}

/** The rail of slides, and the two arrows that move one without a drag. */
function Rail({
  deck,
  on,
  onGo,
  onMove,
}: {
  deck: StoredDeck;
  on: number;
  onGo: (at: number) => void;
  onMove: (from: number, to: number) => void;
}) {
  return (
    <div
      style={{ display: 'flex', gap: 'var(--sp-3)', overflowX: 'auto', paddingBottom: 'var(--sp-3)' }}
    >
      {deck.slides.map((slide, i) => {
        const off = !shown(deck, i);
        return (
          <div key={i} style={{ flex: 'none', width: 128 }}>
            <Blueprint
              plain
              as="button"
              onClick={() => onGo(i)}
              aria-current={i === on ? 'true' : undefined}
              style={{
                width: '100%',
                padding: 'var(--sp-4)',
                textAlign: 'left',
                minHeight: 74,
                opacity: off ? 0.45 : 1,
                outline: i === on ? '1px solid var(--app-accent)' : 'none',
              }}
            >
              <div style={{ ...secondLine(), fontSize: 'var(--type-xs)' }}>
                {i + 1}
                {off ? ' · hidden' : ''}
              </div>
              <div
                style={{
                  fontSize: 'var(--type-sm)',
                  lineHeight: 'var(--leading-tight)',
                  marginTop: 'var(--sp-2)',
                }}
              >
                {slide.title || 'Untitled'}
              </div>
            </Blueprint>
            {/*
              A drag has to have a single-pointer equal — see
              `a11y/dragging.test.ts`. These are it, and they are also the only
              way to reorder on a phone where the rail itself scrolls.
            */}
            <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-2)' }}>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={i === 0}
                onClick={() => onMove(i, i - 1)}
                aria-label={`Move slide ${i + 1} earlier`}
                style={{ flex: 1, padding: 'var(--sp-2)' }}
              >
                <ChevronLeft size={13} />
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={i === deck.slides.length - 1}
                onClick={() => onMove(i, i + 1)}
                aria-label={`Move slide ${i + 1} later`}
                style={{ flex: 1, padding: 'var(--sp-2)' }}
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SlideEditor({
  slide,
  at,
  of,
  hidden,
  onChange,
  onDuplicate,
  onHide,
  onRemove,
}: {
  slide: Slide;
  at: number;
  of: number;
  hidden: boolean;
  onChange: (next: Slide) => void;
  onDuplicate: () => void;
  onHide: () => void;
  onRemove: () => void;
}) {
  return (
    <Blueprint style={{ padding: 'var(--sp-6)', marginTop: 'var(--sp-5)' }}>
      <SectionLabel>
        Slide {at + 1} of {of}
        {hidden ? ' · hidden' : ''}
      </SectionLabel>

      <input
        className="input"
        value={slide.title}
        onChange={(e) => onChange({ ...slide, title: e.target.value })}
        placeholder="Slide title"
        aria-label={`Title of slide ${at + 1}`}
        style={{ width: '100%', marginBottom: 'var(--sp-4)' }}
      />

      <textarea
        className="input"
        value={slide.bullets.join('\n')}
        onChange={(e) =>
          onChange({ ...slide, bullets: e.target.value.split('\n').filter((l, i, all) => l !== '' || i < all.length - 1) })
        }
        placeholder="One point per line"
        aria-label={`Points on slide ${at + 1}`}
        rows={5}
        style={{ width: '100%', marginBottom: 'var(--sp-4)', fontSize: 'var(--type-base)' }}
      />

      {slide.equation !== undefined && (
        <input
          className="input"
          value={slide.equation}
          onChange={(e) => onChange({ ...slide, equation: e.target.value })}
          placeholder="An equation, as one line"
          aria-label={`Equation on slide ${at + 1}`}
          style={{ width: '100%', marginBottom: 'var(--sp-4)' }}
        />
      )}

      <SectionLabel>What you say</SectionLabel>
      <textarea
        className="input"
        value={slide.notes ?? ''}
        onChange={(e) => onChange({ ...slide, notes: e.target.value })}
        placeholder="Speaker notes — yours, not the room’s"
        aria-label={`Speaker notes for slide ${at + 1}`}
        rows={4}
        style={{ width: '100%', fontSize: 'var(--type-base)' }}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', marginTop: 'var(--sp-5)' }}>
        <ActionButton onClick={onDuplicate} style={{ width: 'auto', padding: 'var(--sp-3) var(--sp-5)' }}>
          Duplicate
        </ActionButton>
        <ActionButton
          onClick={onHide}
          aria-label={hidden ? `Show slide ${at + 1} again` : `Hide slide ${at + 1} without deleting it`}
          style={{ width: 'auto', padding: 'var(--sp-3) var(--sp-5)' }}
        >
          {hidden ? 'Show it' : 'Hide it'}
        </ActionButton>
        <ActionButton onClick={onRemove} style={{ width: 'auto', padding: 'var(--sp-3) var(--sp-5)' }}>
          Delete
        </ActionButton>
      </div>
    </Blueprint>
  );
}

/**
 * Presenting.
 *
 * The slide, what comes next, the notes, a clock and where you are — which is
 * the whole of what a presenter view is for, and none of it was here.
 *
 * Full screen where the browser allows it and merely large where it does not,
 * because a request for full screen can be refused and a presenter view that
 * only works in one browser is one nobody trusts on the day.
 *
 * Arrow keys, space, and the two halves of the slide. Escape leaves.
 */
function Presenter({
  deck,
  from,
  onDone,
}: {
  deck: StoredDeck;
  from: number;
  onDone: () => void;
}) {
  const order = running(deck);
  const start = Math.max(0, order.findIndex((r) => r.at === from));
  const [i, setI] = useState(start === -1 ? 0 : start);
  // Both read the clock lazily. `useState(Date.now())` calls it on every
  // render and throws the result away, which is the impurity oxlint flags.
  const [since] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const box = useRef<HTMLDivElement>(null);

  const go = (to: number) => setI(Math.max(0, Math.min(order.length - 1, to)));

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        setI((was) => Math.min(order.length - 1, was + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setI((was) => Math.max(0, was - 1));
      } else if (e.key === 'Escape') {
        onDone();
      }
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  }, [order.length, onDone]);

  useEffect(() => {
    // Best effort. A refused request leaves the view large rather than full
    // screen, which still works; a thrown one must not take the deck with it.
    void box.current?.requestFullscreen?.().catch(() => undefined);
    return () => {
      if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    revealKindly(box.current, { block: 'start' });
  }, [i]);

  const here = order[i];
  const next = order[i + 1];
  const elapsed = Math.floor((now - since) / 1000);
  const clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;

  if (!here) {
    return (
      <Page>
        <EmptyState
          title="Nothing to present."
          body="Every slide in this deck is hidden. Show one and try again."
          icon={<DeckIcon />}
        />
        <ActionButton onClick={onDone}>Back to the deck</ActionButton>
      </Page>
    );
  }

  return (
    <div
      ref={box}
      style={{
        background: 'var(--app-void)',
        minHeight: '100vh',
        padding: 'var(--sp-7)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-6)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 'var(--type-sm)',
        }}
      >
        <span role="status" aria-label={`Slide ${i + 1} of ${order.length}, ${clock} elapsed`}>
          {i + 1} / {order.length} · {clock}
        </span>
        <ActionButton onClick={onDone} style={{ width: 'auto', padding: 'var(--sp-3) var(--sp-5)' }}>
          Done
        </ActionButton>
      </div>

      {/* The slide. Tapping its left and right halves moves, as it does in the
          study slideshow — the same gesture in the same app. */}
      <Blueprint
        style={{
          flex: 1,
          padding: 'var(--sp-7)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <h2 style={{ fontSize: 'var(--type-xl)', lineHeight: 'var(--leading-tight)', margin: 0 }}>
          {here.slide.title}
        </h2>
        {here.slide.bullets.length > 0 && (
          <ul style={{ marginTop: 'var(--sp-6)', fontSize: 'var(--type-lg)', lineHeight: 'var(--leading-relaxed)' }}>
            {here.slide.bullets.map((line, n) => (
              <li key={n} style={{ marginTop: 'var(--sp-3)' }}>
                {line}
              </li>
            ))}
          </ul>
        )}
        {here.slide.equation && (
          <div style={{ marginTop: 'var(--sp-6)', fontSize: 'var(--type-lg)' }}>
            {here.slide.equation}
          </div>
        )}
        <button
          type="button"
          className="bare"
          onClick={() => go(i - 1)}
          aria-label="Previous slide"
          /* `width: auto` is load-bearing: `.bare` is width:100%, and an
             absolutely positioned box with left, right and width all set is
             over-constrained — CSS drops an edge and both halves end up
             covering the whole slide. See `styles/inset.test.ts`, which was
             written after exactly this shipped in the study slideshow. */
          style={{ position: 'absolute', inset: '0 50% 0 0', width: 'auto', opacity: 0 }}
        />
        <button
          type="button"
          className="bare"
          onClick={() => go(i + 1)}
          aria-label="Next slide"
          style={{ position: 'absolute', inset: '0 0 0 50%', width: 'auto', opacity: 0 }}
        />
      </Blueprint>

      <div style={{ display: 'flex', gap: 'var(--sp-5)', flexWrap: 'wrap' }}>
        <Blueprint plain style={{ flex: 2, minWidth: 200, padding: 'var(--sp-5)' }}>
          <SectionLabel>What you say</SectionLabel>
          <div
            style={{
              fontSize: 'var(--type-base)',
              lineHeight: 'var(--leading-relaxed)',
              whiteSpace: 'pre-wrap',
            }}
          >
            {here.slide.notes?.trim() || 'No notes on this slide.'}
          </div>
        </Blueprint>
        <Blueprint plain style={{ flex: 1, minWidth: 140, padding: 'var(--sp-5)' }}>
          <SectionLabel>Next</SectionLabel>
          <div style={{ fontSize: 'var(--type-sm)', lineHeight: 'var(--leading-tight)' }}>
            {next ? next.slide.title || 'Untitled' : 'End of the deck.'}
          </div>
        </Blueprint>
      </div>
    </div>
  );
}

/** The list of decks somebody has kept, above the builders on `screens/Deck.tsx`. */
export function DeckShelf() {
  const { state, dispatch, courseCode } = useStore();
  const rows = useMemo(() => [...state.decks].sort((a, b) => b.updated - a.updated), [state.decks]);

  if (rows.length === 0) return null;

  return (
    <Folding name="Your decks">
      <SectionLabel>
        {rows.length} {rows.length === 1 ? 'deck' : 'decks'}
      </SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        {rows.map((deck) => (
          <Blueprint
            key={deck.id}
            as="button"
            plain
            onClick={() => dispatch({ type: 'editDeck', id: deck.id })}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-5)',
              padding: 'var(--sp-6)',
              textAlign: 'left',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--type-md)' }}>{deck.title || 'Untitled deck'}</div>
              <div style={{ ...secondLine(), fontSize: 'var(--type-sm)', marginTop: 'var(--sp-1)' }}>
                {[
                  deck.courseId ? courseCode(deck.courseId) : 'Personal',
                  `${running(deck).length} slides`,
                  `about ${minutes(deck)} min`,
                ].join(' · ')}
              </div>
            </div>
            <ChevronRight size={16} />
          </Blueprint>
        ))}
      </div>
    </Folding>
  );
}
