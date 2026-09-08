/**
 * The two choices that decide the shape of the app, drawn rather than described.
 *
 * **Navigation** is how you move: the tab bar, one feed, the home screen of
 * icons, or the shelves. **Layout** is how a screen is drawn once you are on
 * it: drawn, grouped, or soft. They are independent, every pairing works, and
 * exactly one navigation is ever on screen.
 *
 * ## Why both pickers are in one file
 *
 * They were not, and the split cost more than the file did. The layout picker
 * lived in `ShellPicker.tsx` and was rendered on the Appearance settings page;
 * the navigation was a `Segmented` written inline on the Navigation settings
 * page, two taps away. Two controls answering one question — *what shape is
 * this app* — with no way to see one while changing the other, and each
 * describing itself in its own words. Somebody changing the layout had no way
 * to know the navigation was a choice at all.
 *
 * So they are one component, on one page, sharing one `Choice` card. Adding a
 * navigation or a layout is a row in `NAVS` or `SHELLS` in `lib/look.ts` plus
 * a thumbnail here, and it appears in the picker, in search, and in the
 * guidebook without a third edit.
 *
 * ## Why they are thumbnails and not names
 *
 * "Grouped inset list" means nothing to anybody who has not built one and
 * everything to anybody who looks at it. Each preview is drawn in the app's
 * own tokens, so it shows what the choice will actually look like on the
 * ground somebody is on rather than a picture of it on some other ground.
 */

import type { ReactNode } from 'react';
import { useStore } from '../state/store';
import { NAVS, SHELLS } from '../lib/look';
import type { NavMode } from '../lib/types';
import { SectionLabel } from './ui';

const LABEL_STYLE = {
  margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))',
} as const;

const BLURB_STYLE = {
  fontSize: 'var(--type-base)',
  opacity: 0.65,
  marginBottom: 'var(--sp-5)',
  textWrap: 'pretty',
} as const;

/**
 * One option: a drawing of it, its name, and the sentence saying what it is.
 *
 * `aria-pressed` rather than a radio group because that is what the rest of
 * the app's choosers use, and a screen reader announcing "pressed" on the one
 * you are on is the same information the accent border gives everybody else.
 */
function Choice({
  on,
  label,
  blurb,
  preview,
  onChoose,
}: {
  on: boolean;
  label: string;
  blurb: string;
  preview: ReactNode;
  onChoose: () => void;
}) {
  return (
    <button
      type="button"
      className="bare tappable"
      aria-pressed={on}
      onClick={onChoose}
      style={{
        flex: '1 1 0',
        minWidth: 128,
        textAlign: 'left',
        padding: 'var(--sp-5)',
        borderRadius: 'var(--r-sm)',
        border: `1px solid ${on ? 'var(--app-accent)' : 'var(--app-line)'}`,
        background: on ? 'var(--app-accent-wash)' : 'transparent',
      }}
    >
      {preview}
      <span style={{ display: 'block', fontSize: 'var(--type-base)', marginTop: 'var(--sp-5)' }}>{label}</span>
      <span
        style={{
          display: 'block',
          fontSize: 'var(--type-xs)',
          opacity: 0.55,
          marginTop: 'var(--sp-1)',
          lineHeight: 'var(--leading-normal)',
          textWrap: 'pretty',
        }}
      >
        {blurb}
      </span>
    </button>
  );
}

/** The row every picker is laid out in. Wraps rather than squeezing. */
function Row({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', gap: 'var(--sp-5)', flexWrap: 'wrap' }}>{children}</div>;
}

// ── The drawings ────────────────────────────────────────────────────────

/** A stand-in for a line of text. Every thumbnail is built from these. */
function bar(w: string, dim = false) {
  return (
    <span
      style={{
        display: 'block',
        height: 4,
        width: w,
        borderRadius: 2,
        background: dim ? 'var(--app-faint)' : 'var(--app-dim)',
      }}
    />
  );
}

/** The frame every thumbnail sits in, so they are the same size and ground. */
function Frame({ children, void: onVoid = false }: { children: ReactNode; void?: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'block',
        height: 74,
        padding: 7,
        background: onVoid ? 'var(--app-void, var(--app-bg))' : 'var(--app-bg)',
        border: '1px solid var(--app-line-soft)',
        borderRadius: 'var(--r-sm)',
        overflow: 'hidden',
      }}
    >
      {children}
    </span>
  );
}

/**
 * The three layouts, drawn.
 *
 * Deliberately the same content in all three: the choice is about
 * arrangement, and a preview that also changed what was in it would be
 * selling something else.
 *
 * Soft used to have no drawing of its own — the picker asked `id ===
 * 'grouped'` and gave everything else the drawn one, so two of the three
 * options showed the same picture and the odd one out was the one nobody
 * could recognise. Each has its own now, and `appearance.test.tsx` counts
 * them against `SHELLS` so a fourth layout cannot ship without one.
 */
function LayoutPreview({ shell }: { shell: string }) {
  if (shell === 'grouped') {
    return (
      <Frame void>
        {bar('34%', true)}
        <span
          style={{
            display: 'block',
            marginTop: 'var(--sp-3)',
            background: 'var(--app-panel)',
            borderRadius: 'var(--r-sm)',
            border: '1px solid var(--app-line-soft)',
            overflow: 'hidden',
          }}
        >
          {['70%', '52%', '61%'].map((w, i) => (
            <span
              key={w}
              style={{
                display: 'block',
                padding: '5px 6px',
                // Inset from the left, which is the thing the layout is about.
                backgroundImage:
                  i < 2 ? 'linear-gradient(var(--app-line-soft), var(--app-line-soft))' : 'none',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: '6px 100%',
                backgroundSize: 'calc(100% - 6px) 1px',
              }}
            >
              {bar(w)}
            </span>
          ))}
        </span>
      </Frame>
    );
  }

  if (shell === 'soft') {
    // The figure first, then two tiles lifted off the page. That is what soft
    // does that neither of the others does, so that is what the drawing shows.
    return (
      <Frame void>
        <span
          style={{
            display: 'block',
            padding: '5px 6px',
            background: 'var(--app-panel)',
            borderRadius: 'var(--r-sm)',
            boxShadow: '0 1px 3px rgba(0,0,0,.28)',
          }}
        >
          <span
            style={{
              display: 'block',
              height: 11,
              width: '38%',
              borderRadius: 2,
              background: 'var(--app-accent, var(--app-dim))',
              opacity: 0.85,
            }}
          />
          <span style={{ display: 'block', height: 4 }} />
          {bar('58%', true)}
        </span>
        <span style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-2)' }}>
          {['1', '2'].map((k) => (
            <span
              key={k}
              style={{
                flex: 1,
                display: 'block',
                padding: '6px 5px',
                background: 'var(--app-panel)',
                borderRadius: 'var(--r-sm)',
                boxShadow: '0 1px 3px rgba(0,0,0,.28)',
              }}
            >
              {bar('80%')}
            </span>
          ))}
        </span>
      </Frame>
    );
  }

  // Drawn: framed cards with room between them.
  return (
    <Frame>
      {bar('34%', true)}
      <span
        style={{
          display: 'block',
          marginTop: 'var(--sp-3)',
          padding: 'var(--sp-3)',
          border: '1px solid var(--app-line)',
          borderRadius: 'var(--r-sm)',
        }}
      >
        {bar('70%')}
        <span style={{ display: 'block', height: 5 }} />
        {bar('50%', true)}
      </span>
      <span
        style={{
          display: 'block',
          marginTop: 'var(--sp-2)',
          padding: 'var(--sp-3)',
          border: '1px solid var(--app-line)',
          borderRadius: 'var(--r-sm)',
        }}
      >
        {bar('60%')}
      </span>
    </Frame>
  );
}

/** A pill, for the two thumbnails that are made of them. */
function pill(w: number, on = false) {
  return (
    <span
      style={{
        display: 'block',
        height: 8,
        width: w,
        flex: 'none',
        borderRadius: 4,
        background: on ? 'var(--app-accent, var(--app-dim))' : 'var(--app-line)',
      }}
    />
  );
}

/**
 * The four navigations, drawn — each showing where its navigation *is*.
 *
 * Position is the whole difference between them: a bar at the bottom, a
 * filter row at the top, a grid in the middle, two rows of pills above the
 * content. A list of four names cannot show that and a drawing can.
 */
function NavPreview({ nav }: { nav: string }) {
  if (nav === 'feed') {
    return (
      <Frame>
        <span style={{ display: 'flex', gap: 'var(--sp-1)' }}>
          {pill(18, true)}
          {pill(14)}
          {pill(12)}
        </span>
        <span style={{ display: 'block', marginTop: 'var(--sp-3)' }}>
          {[1, 2, 3, 4].map((i) => (
            <span key={i} style={{ display: 'block', marginTop: i === 1 ? 0 : 5 }}>
              {bar(i % 2 === 0 ? '58%' : '76%', i % 2 === 0)}
            </span>
          ))}
        </span>
      </Frame>
    );
  }

  if (nav === 'springboard') {
    return (
      <Frame>
        <span
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 'var(--sp-2)',
          }}
        >
          {Array.from({ length: 8 }, (_, i) => (
            <span
              key={i}
              style={{
                display: 'block',
                aspectRatio: '1',
                borderRadius: 'var(--r-sm)',
                background: i === 0 ? 'var(--app-accent, var(--app-dim))' : 'var(--app-line)',
              }}
            />
          ))}
        </span>
      </Frame>
    );
  }

  if (nav === 'shelves') {
    return (
      <Frame>
        <span style={{ display: 'flex', gap: 'var(--sp-1)' }}>
          {pill(16, true)}
          {pill(13)}
          {pill(11)}
        </span>
        <span style={{ display: 'flex', gap: 'var(--sp-1)', marginTop: 'var(--sp-2)' }}>
          {pill(12)}
          {pill(15, true)}
          {pill(10)}
        </span>
        <span style={{ display: 'block', marginTop: 'var(--sp-4)' }}>
          {bar('72%')}
          <span style={{ display: 'block', height: 5 }} />
          {bar('54%', true)}
        </span>
      </Frame>
    );
  }

  // The bar: content above, a fixed row of tabs pinned to the bottom.
  return (
    <Frame>
      <span style={{ display: 'block', height: 40 }}>
        {bar('72%')}
        <span style={{ display: 'block', height: 5 }} />
        {bar('54%', true)}
        <span style={{ display: 'block', height: 5 }} />
        {bar('64%', true)}
      </span>
      <span
        style={{
          display: 'flex',
          gap: 'var(--sp-2)',
          justifyContent: 'space-between',
          borderTop: '1px solid var(--app-line)',
          paddingTop: 'var(--sp-2)',
        }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            style={{
              display: 'block',
              width: 7,
              height: 7,
              borderRadius: 2,
              background: i === 0 ? 'var(--app-accent, var(--app-dim))' : 'var(--app-line)',
            }}
          />
        ))}
      </span>
    </Frame>
  );
}

// ── The pickers ─────────────────────────────────────────────────────────

/**
 * Which navigation is drawn. One of four, and only ever one.
 */
export function NavPicker() {
  const { state, dispatch } = useStore();

  return (
    <>
      <SectionLabel style={LABEL_STYLE}>Navigation</SectionLabel>
      <div style={BLURB_STYLE}>
        Four ways of moving through the same screens. Only one is ever on screen at a time, and
        none of them hides anything — every screen is reachable in all four, and search finds
        everything whichever you pick.
      </div>
      <Row>
        {NAVS.map((n) => (
          <Choice
            key={n.id}
            on={state.nav === n.id}
            label={n.label}
            blurb={n.blurb}
            preview={<NavPreview nav={n.id} />}
            onChoose={() => dispatch({ type: 'setNav', nav: n.id as NavMode })}
          />
        ))}
      </Row>
    </>
  );
}

/**
 * How a screen is drawn once you are on it. Adds no navigation of its own.
 */
export function LayoutPicker() {
  const { state, dispatch } = useStore();

  return (
    <>
      <SectionLabel style={LABEL_STYLE}>Layout</SectionLabel>
      <div style={BLURB_STYLE}>
        Three ways of arranging every screen. Neither the controls nor the content change — the
        same screen shows the same things in all three.
      </div>
      <Row>
        {SHELLS.map((s) => (
          <Choice
            key={s.id}
            on={state.shell === s.id}
            label={s.label}
            blurb={s.blurb}
            preview={<LayoutPreview shell={s.id} />}
            onChoose={() => dispatch({ type: 'setLook', look: { shell: s.id } })}
          />
        ))}
      </Row>
    </>
  );
}
