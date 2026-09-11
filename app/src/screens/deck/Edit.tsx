import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import { Page } from '../../components/Page';
import { Blueprint } from '../../components/Blueprint';
import { CoursePicker } from '../../components/CoursePicker';
import { Folding } from '../../components/Fold';
import { ActionButton, EmptyState, SectionLabel } from '../../components/ui';
import { ChevronLeft, ChevronRight, DeckIcon } from '../../components/Icons';
import { secondLine } from '../../lib/dim';
import { download } from '../../lib/deliver';
import { deckFileName, pptx } from '../../lib/pptx';
import { revealKindly } from '../../lib/prefers';
import { useTier } from '../../lib/media';
import { Canvas, Notes, Still, Thumb } from './Canvas';
import {
  LAYOUTS,
  THEMES,
  blankSlide,
  duplicate,
  forExport,
  layoutOf,
  losesSomething,
  minutes,
  relayout,
  remove,
  reorder,
  running,
  setSlide,
  shown,
  themeOf,
  toggleHidden,
  type Layout,
  type StoredDeck,
  type Theme,
  type ThemeId,
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
 * ## It is a slide now, not a form
 *
 * The first version of this was a stack of labelled boxes: one for the title,
 * one for the points, one per table cell. Everything worked and nobody could
 * see their deck until they exported it — which is when the two faults you
 * cannot fix turn up, a title running to three lines and eleven points on a
 * slide that holds six.
 *
 * So the middle of the screen is the slide, at sixteen by nine, in the deck's
 * own colours, with the fields where the exported slide puts them. `Canvas.tsx`
 * draws it, and draws the rail's thumbnails and the presenter's view from the
 * same code, so what is on the screen is what comes out of the file.
 *
 * ## The four controls a deck actually needs
 *
 * Add a slide, change this slide's layout, change the deck's theme, and the
 * three things you do to a slide once it exists — duplicate, hide, delete.
 * Everything else a presentation program has is a way of decorating one slide,
 * and this app has no business owning that.
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
  /** Which of the two pickers is open, if either. Never both. */
  const [picking, setPicking] = useState<'add' | 'layout' | 'theme' | null>(null);
  /** A layout change that would lose something, waiting to be confirmed. */
  const [losing, setLosing] = useState<{ layout: Layout; gone: string[] } | null>(null);
  const tier = useTier();

  const patch = (next: Partial<Omit<StoredDeck, 'id'>>) =>
    dispatch({ type: 'updateDeck', id: deck.id, patch: next });

  // A slide removed from under the cursor would otherwise leave `at` past the
  // end, and the editor drawing nothing at all.
  const on = Math.min(at, deck.slides.length - 1);
  const slide = deck.slides[on];
  const order = running(deck);
  const theme = themeOf(deck);

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

  /** Put a new slide of this shape after the one open, and go to it. */
  const add = (layout: Layout) => {
    const slides = [...deck.slides];
    slides.splice(on + 1, 0, blankSlide(layout));
    patch({ slides, hidden: (deck.hidden ?? []).map((h) => (h > on ? h + 1 : h)) });
    setAt(on + 1);
    setPicking(null);
  };

  /** Change this slide's shape, asking first where there is anything to lose. */
  const reshape = (layout: Layout, anyway = false) => {
    if (!slide) return;
    const gone = losesSomething(slide, layout);
    if (gone.length > 0 && !anyway) {
      setLosing({ layout, gone });
      setPicking(null);
      return;
    }
    patch(setSlide(deck, on, relayout(slide, layout)));
    setLosing(null);
    setPicking(null);
  };

  if (presenting) {
    return <Presenter deck={deck} from={on} onDone={() => setPresenting(false)} />;
  }

  /*
   * The rail runs down the side where there is room and along the top where
   * there is not — which is the only thing about this screen that changes with
   * the window. A rail 120 pixels wide beside a canvas on a phone leaves the
   * canvas 200 wide, and a slide drawn 200 wide is not a slide anybody can
   * judge.
   */
  const beside = tier !== 'phone';

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

      <Bar
        on={picking}
        onPick={(which) => setPicking((was) => (was === which ? null : which))}
        theme={theme}
        layout={slide ? layoutOf(slide) : 'title'}
        hidden={!shown(deck, on)}
        onDuplicate={() => patch(duplicate(deck, on))}
        onHide={() => patch(toggleHidden(deck, on))}
        onRemove={() => {
          patch(remove(deck, on));
          setAt(Math.max(0, on - 1));
        }}
      />

      {picking === 'add' && (
        <Choices
          name="What shape is the new slide?"
          options={LAYOUTS.map((l) => ({ id: l.id, label: l.label }))}
          value={null}
          onPick={(id) => add(id as Layout)}
        />
      )}
      {picking === 'layout' && slide && (
        <Choices
          name="Change this slide to"
          options={LAYOUTS.map((l) => ({ id: l.id, label: l.label }))}
          value={layoutOf(slide)}
          onPick={(id) => reshape(id as Layout)}
        />
      )}
      {picking === 'theme' && (
        <Choices
          name="The deck’s colours"
          options={THEMES.map((t) => ({ id: t.id, label: t.label, says: t.says }))}
          value={theme.id}
          onPick={(id) => {
            patch({ theme: id as ThemeId });
            setPicking(null);
          }}
        />
      )}

      {losing && (
        <Blueprint style={{ padding: 'var(--sp-6)', marginTop: 'var(--sp-4)' }}>
          <div style={{ fontSize: 'var(--type-sm)' }}>
            Changing to {LAYOUTS.find((l) => l.id === losing.layout)?.label.toLowerCase()} throws
            away {losing.gone.join(' and ')} on this slide. The title and your speaker notes stay.
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-5)' }}>
            <ActionButton onClick={() => setLosing(null)}>Leave it as it is</ActionButton>
            <ActionButton tone="primary" onClick={() => reshape(losing.layout, true)}>
              Change it anyway
            </ActionButton>
          </div>
        </Blueprint>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: beside ? 'row' : 'column',
          gap: 'var(--sp-5)',
          marginTop: 'var(--sp-5)',
          alignItems: 'flex-start',
        }}
      >
        <Rail
          deck={deck}
          theme={theme}
          on={on}
          down={beside}
          onGo={setAt}
          onMove={(from, to) => {
            patch(reorder(deck, from, to));
            setAt(to);
          }}
        />
        <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
          {slide && (
            <Canvas
              slide={slide}
              theme={theme}
              at={on}
              onChange={(next) => patch(setSlide(deck, on, next))}
            />
          )}
          <div
            style={{
              ...secondLine(),
              fontSize: 'var(--type-xs)',
              marginTop: 'var(--sp-3)',
            }}
          >
            Slide {on + 1} of {deck.slides.length}
            {shown(deck, on) ? '' : ' · hidden, and left out of the file'}
          </div>
          {slide && (
            <Notes
              value={slide.notes ?? ''}
              at={on}
              onChange={(notes) => patch(setSlide(deck, on, { ...slide, notes }))}
            />
          )}
        </div>
      </div>

      <Folding name="Take it away">
        <ActionButton tone="primary" disabled={busy} onClick={() => void save()}>
          {busy ? 'Building…' : 'PowerPoint file (.pptx), notes and all'}
        </ActionButton>
        <div style={{ ...secondLine(), fontSize: 'var(--type-sm)', marginTop: 'var(--sp-4)' }}>
          Hidden slides are left out of the file. Speaker notes go in as real notes, so they show
          in PowerPoint’s presenter view rather than on the wall. The theme goes in too — the file
          opens in the colours you chose here.
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

/**
 * The bar over the slide.
 *
 * Seven controls, which is all of them: add, the shape of this slide, the
 * deck's colours, and the three things you do to a slide that exists. Each of
 * the first three opens a row of choices underneath rather than a menu that
 * floats — a floating menu on a phone covers the thing it is about, and this
 * app has nowhere to put one that does not.
 */
function Bar({
  on,
  onPick,
  theme,
  layout,
  hidden,
  onDuplicate,
  onHide,
  onRemove,
}: {
  on: 'add' | 'layout' | 'theme' | null;
  onPick: (which: 'add' | 'layout' | 'theme') => void;
  theme: Theme;
  layout: Layout;
  hidden: boolean;
  onDuplicate: () => void;
  onHide: () => void;
  onRemove: () => void;
}) {
  const button = (text: string, says: string, click: () => void, open = false) => (
    <button
      key={says}
      type="button"
      className="btn btn-ghost"
      onClick={click}
      aria-label={says}
      aria-expanded={open ? true : undefined}
      style={{
        flex: 'none',
        width: 'auto',
        padding: 'var(--sp-2) var(--sp-5)',
        fontSize: 'var(--type-xs)',
        background: open ? 'var(--app-accent-wash)' : undefined,
      }}
    >
      {text}
    </button>
  );

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--sp-2)',
        alignItems: 'center',
        marginTop: 'var(--sp-5)',
        paddingBottom: 'var(--sp-3)',
        borderBottom: '1px solid var(--app-line)',
      }}
    >
      {button('+ Slide', 'Add a slide after this one', () => onPick('add'), on === 'add')}
      {button(
        `Layout · ${LAYOUTS.find((l) => l.id === layout)?.label ?? ''}`,
        'Change this slide’s layout',
        () => onPick('layout'),
        on === 'layout',
      )}
      {button(`Theme · ${theme.label}`, 'Change the deck’s colours', () => onPick('theme'), on === 'theme')}
      {button('Duplicate', 'Duplicate this slide', onDuplicate)}
      {button(
        hidden ? 'Show' : 'Hide',
        hidden ? 'Show this slide again' : 'Hide this slide without deleting it',
        onHide,
      )}
      {button('Delete', 'Delete this slide', onRemove)}
    </div>
  );
}

/** The row of choices one of the bar's three buttons opens. */
function Choices({
  name,
  options,
  value,
  onPick,
}: {
  name: string;
  options: { id: string; label: string; says?: string }[];
  value: string | null;
  onPick: (id: string) => void;
}) {
  return (
    <div style={{ marginTop: 'var(--sp-4)' }}>
      <SectionLabel>{name}</SectionLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className="bare tappable"
            onClick={() => onPick(option.id)}
            aria-pressed={option.id === value}
            style={{
              width: 'auto',
              padding: 'var(--sp-3) var(--sp-5)',
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--app-line)',
              background: option.id === value ? 'var(--app-accent-wash)' : undefined,
              fontSize: 'var(--type-sm)',
              textAlign: 'left',
            }}
          >
            <div>{option.label}</div>
            {option.says && (
              <div style={{ ...secondLine(), fontSize: 'var(--type-xs)', marginTop: 'var(--sp-1)' }}>
                {option.says}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The rail of slides, and the two arrows that move one without a drag.
 *
 * Down the side on a screen with room and along the top on a phone. Each
 * thumbnail is the slide itself rather than its title — see `Thumb` in
 * `Canvas.tsx` for why words rather than grey bars.
 */
function Rail({
  deck,
  theme,
  on,
  down,
  onGo,
  onMove,
}: {
  deck: StoredDeck;
  theme: Theme;
  on: number;
  /** Vertical, beside the slide, rather than horizontal above it. */
  down: boolean;
  onGo: (at: number) => void;
  onMove: (from: number, to: number) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: down ? 'column' : 'row',
        gap: 'var(--sp-3)',
        overflowX: down ? 'visible' : 'auto',
        overflowY: down ? 'auto' : 'visible',
        maxHeight: down ? 460 : undefined,
        paddingBottom: 'var(--sp-3)',
        flex: 'none',
        width: down ? 128 : '100%',
      }}
    >
      {deck.slides.map((slide, i) => {
        const off = !shown(deck, i);
        return (
          <div key={i} style={{ flex: 'none', width: 116 }}>
            <button
              type="button"
              className="bare tappable"
              onClick={() => onGo(i)}
              aria-current={i === on ? 'true' : undefined}
              aria-label={`Slide ${i + 1}${off ? ', hidden' : ''}: ${slide.title || 'Untitled'}`}
              style={{
                width: '100%',
                padding: 0,
                opacity: off ? 0.45 : 1,
                outline: i === on ? '2px solid var(--app-accent)' : 'none',
              }}
            >
              <Thumb slide={slide} theme={theme} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginTop: 'var(--sp-2)' }}>
              <span style={{ ...secondLine(), fontSize: 'var(--type-xs)', flex: 1 }}>
                {i + 1}
                {off ? ' · hidden' : ''}
              </span>
              {/*
                A drag has to have a single-pointer equal — see
                `a11y/dragging.test.ts`. These are it, and they are also the
                only way to reorder on a phone where the rail itself scrolls.
              */}
              <button
                type="button"
                className="btn btn-ghost"
                disabled={i === 0}
                onClick={() => onMove(i, i - 1)}
                aria-label={`Move slide ${i + 1} earlier`}
                style={{ flex: 'none', width: 'auto', padding: 'var(--sp-2)' }}
              >
                <ChevronLeft size={13} />
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={i === deck.slides.length - 1}
                onClick={() => onMove(i, i + 1)}
                aria-label={`Move slide ${i + 1} later`}
                style={{ flex: 'none', width: 'auto', padding: 'var(--sp-2)' }}
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
      // Space on a focused button is that button's press. Taking it here
      // first made Done unreachable by keyboard — the one control somebody
      // needs when the deck is over the whole screen.
      if (e.key === ' ' && e.target instanceof HTMLButtonElement) return;
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

      {/*
        The slide, drawn by the same code the editor and the file use — see
        `Canvas.tsx`. It used to be drawn again here, by hand, and the copy had
        already drifted: it put the equation last where the file puts it first,
        and sized a table differently. A presenter view that does not match the
        wall is worse than none.

        Tapping its left and right halves moves, as it does in the study
        slideshow — the same gesture in the same app.
      */}
      <div style={{ flex: 1, position: 'relative', display: 'flex' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Still slide={here.slide} theme={themeOf(deck)} />
        </div>
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
      </div>

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
