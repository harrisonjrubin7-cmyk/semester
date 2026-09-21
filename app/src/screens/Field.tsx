import { useRef } from 'react';
import { faintLine, secondLine } from '../lib/dim';
import { revealKindly } from '../lib/prefers';
import { useStore } from '../state/store';
import { useRowStyle } from '../components/shell/useShell';
import { useLive } from '../lib/live';
import { Blueprint } from '../components/Blueprint';
import { FigureCard } from '../components/FigureCard';
import { SectionLabel } from '../components/ui';
import { addedLine } from '../lib/study';
import { Folding } from '../components/Fold';

/** The note under a heading saying part of what follows arrived later. */
const SINCE = {
  fontSize: 'var(--type-sm)',
  color: 'var(--app-dim)',
  lineHeight: 'var(--leading-relaxed)',
  marginBottom: 'var(--sp-4)',
} as const;

/**
 * The field guide, presented as it was published.
 *
 * The study guides this app was built from were Claude artifacts: long-form
 * documents you read from the top, with a masthead, numbered sections, a
 * glossary and a self-test at the end. Every mode in the app broke that up for
 * a reason — Cards drills it, Read makes it foldable, Cram strips it to frames
 * and terms — and somewhere in the breaking up, the thing you could actually
 * sit and read went missing.
 *
 * This puts it back. Same material, no accordions, no drilling: the document.
 *
 * On the colour matching, which is the reason this is a mode rather than an
 * embed: the original artifacts live on claude.site, and a page in a
 * cross-origin iframe cannot be restyled from outside it — you would get the
 * artifact's own palette sitting in a hole in the middle of this one, on every
 * theme, forever. Rebuilding the presentation from the same guide data means
 * every rule here is drawn from the app's own tokens, so it matches in light,
 * dark and stealth-chrome without anything to keep in sync. It also means this
 * works for a course somebody generated from their own syllabus this morning,
 * which an embed of four published URLs never could.
 */
export function FieldGuide() {
  // A row's padding and hairline, from the layout rather than hard-coded.
  const jumpRow = useRowStyle(9);
  const termRow = useRowStyle(11);
  const askRow = useRowStyle(13);
  const { state, catalog } = useStore();
  const { guide, figures: figMap, extras } = useLive(state.guideId);
  const sections = useRef<(HTMLDivElement | null)[]>([]);

  const cards = guide.units.reduce((n, u) => n + u.cards.length, 0);
  const meta = [
    `${guide.units.length} ${guide.units.length === 1 ? 'section' : 'sections'}`,
    `${cards} ${cards === 1 ? 'point' : 'points'}`,
    guide.terms.length ? `${guide.terms.length} terms` : '',
    guide.selfTest?.length ? `${guide.selfTest.length} self-test` : '',
    guide.addedLong.frames + guide.addedLong.selfTest + guide.addedLong.cases
      ? `${guide.addedLong.frames + guide.addedLong.selfTest + guide.addedLong.cases} added`
      : '',
  ]
    .filter(Boolean)
    .join(' · ');

  /*
   * No `<Page>` here, deliberately.
   *
   * This is not a screen. `Guide` renders it as one of its modes, inside the
   * guide's own frame — a second one would double the padding and put a second
   * search box under the first. See the note at the top of
   * `components/Page.tsx`.
   */
  return (
    <div style={{ marginTop: 'calc(18px * var(--density, 1))' }}>
      <Folding name="FieldGuide">
      {/* ── Masthead ─────────────────────────────────────────────────── */}
      <Blueprint style={{ paddingBlock: 'calc(20px * var(--density, 1))', paddingInline: 'calc(17px * var(--density, 1))', background: 'var(--app-hero)' }}>
        <div className="kicker">Field guide · {guide.code}</div>
        <div
          className="chrome-text"
          style={{
            fontSize: 'calc(30px * var(--text-scale, 1))',
            lineHeight: 1.06,
            letterSpacing: '-0.01em',
            marginTop: 'var(--sp-4)',
            textWrap: 'pretty',
          }}
        >
          {guide.name}
        </div>
        <div
          style={{
            fontSize: 'var(--type-md)',
            color: 'var(--app-dim)',
            lineHeight: 'var(--leading-relaxed)',
            marginTop: 'var(--sp-4)',
            textWrap: 'pretty',
          }}
        >
          {guide.blurb}
        </div>
        <div
          style={{
            marginTop: 'var(--sp-6)',
            paddingTop: 'calc(11px * var(--density, 1))',
            borderTop: '1px solid var(--app-line)',
            fontFamily: 'var(--font-heading)',
            fontSize: 'calc(10.5px * var(--text-scale, 1))',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--app-dim)',
          }}
        >
          {meta}
        </div>
        {guide.source && (
          <div style={{ fontSize: 'var(--type-xs)', ...secondLine(), marginTop: 'var(--sp-3)' }}>From {guide.source}</div>
        )}
      </Blueprint>

      {/* ── Contents ─────────────────────────────────────────────────── */}
      <SectionLabel>Contents</SectionLabel>
      {guide.units.map((u, i) => (
        <button
          key={u.name}
          type="button"
          className="bare tappable"
          onClick={() => revealKindly(sections.current[i], { block: 'start' })}
          style={{
            display: 'flex',
            gap: 'var(--sp-6)',
            alignItems: 'baseline',
            ...jumpRow,
            textAlign: 'left',
          }}
        >
          <span
            style={{
              width: 24,
              flex: 'none',
              fontFamily: 'var(--font-heading)',
              fontSize: 'var(--type-base)',
              ...faintLine(),
            }}
          >
            {String(i + 1).padStart(2, '0')}
          </span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-md)', lineHeight: 'var(--leading-tight)' }}>{u.name}</span>
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'calc(10.5px * var(--text-scale, 1))',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              ...faintLine(),
              flex: 'none',
            }}
          >
            {u.cards.length}
          </span>
        </button>
      ))}

      {/* ── The body ─────────────────────────────────────────────────── */}
      {guide.units.map((u, i) => {
        const fig = figMap[i];
        const base = guide.baseCards[i] ?? u.cards.length;
        return (
          <div
            key={u.name}
            ref={(el) => {
              sections.current[i] = el;
            }}
            style={{ marginTop: 'calc(34px * var(--density, 1))', scrollMarginTop: 12 }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 'var(--sp-6)',
                paddingBottom: 'calc(9px * var(--density, 1))',
                borderBottom: '1px solid var(--app-accent)',
              }}
            >
              <div
                className="chrome-text"
                style={{ fontSize: 'var(--type-xl)', lineHeight: 1, flex: 'none', color: 'var(--app-dim)' }}
              >
                {String(i + 1).padStart(2, '0')}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 'calc(19px * var(--text-scale, 1))',
                  lineHeight: 1.15,
                  flex: 1,
                  minWidth: 0,
                  textWrap: 'pretty',
                }}
              >
                {u.name}
              </div>
            </div>

            {fig && (
              <div style={{ marginTop: 'calc(15px * var(--density, 1))' }}>
                <FigureCard figure={fig} />
              </div>
            )}

            {u.cards.map((c, ci) => (
              <div key={c.q} style={{ marginTop: 'calc(17px * var(--density, 1))' }}>
                {ci >= base && (
                  <span className="tag tag-accent" style={{ marginBottom: 'var(--sp-3)', display: 'inline-block' }}>
                    Added
                  </span>
                )}
                {/* Question-led, the way the published guides read: the heading
                    is the thing an exam asks, and the paragraph answers it. */}
                <div
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: 'calc(16px * var(--text-scale, 1))',
                    lineHeight: 1.25,
                    color: 'var(--app-accent)',
                    textWrap: 'pretty',
                  }}
                >
                  {c.q}
                </div>
                <div
                  style={{
                    fontSize: 'var(--type-md)',
                    lineHeight: 'var(--leading-loose)',
                    color: 'var(--app-dim)',
                    marginTop: 'calc(5px * var(--density, 1))',
                    textWrap: 'pretty',
                  }}
                >
                  {c.a}
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {/* ── Frames ───────────────────────────────────────────────────── */}
      {guide.frames && guide.frames.length > 0 && (
        <>
          <SectionLabel style={{ marginTop: 'calc(36px * var(--density, 1))', marginInline: '0', marginBottom: 'calc(10px * var(--density, 1))' }}>
            {catalog.frameLabels[state.guideId] ?? 'Frames'}
          </SectionLabel>
          {guide.addedLong.frames > 0 && (
            <div style={SINCE}>{addedLine(guide.addedLong.frames, 'framings')}</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(11px * var(--density, 1))' }}>
            {guide.frames.map((f) => (
              <div
                key={f.t}
                style={{
                  borderLeft: '2px solid var(--app-accent)',
                  paddingLeft: 'calc(13px * var(--density, 1))',
                  paddingTop: 'var(--sp-1)',
                  paddingBottom: 'var(--sp-1)',
                }}
              >
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(17px * var(--text-scale, 1))', lineHeight: 1.15 }}>
                  {f.t}
                </div>
                <div
                  style={{
                    fontSize: 'var(--type-base-plus)',
                    color: 'var(--app-dim)',
                    lineHeight: 'var(--leading-relaxed)',
                    marginTop: 'var(--sp-2)',
                    textWrap: 'pretty',
                  }}
                >
                  {f.d}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Case files ───────────────────────────────────────────────── */}
      {guide.cases && guide.cases.length > 0 && (
        <>
          <SectionLabel style={{ marginTop: 'calc(36px * var(--density, 1))', marginInline: '0', marginBottom: 'calc(10px * var(--density, 1))' }}>Case files</SectionLabel>
          {guide.addedLong.cases > 0 && (
            <div style={SINCE}>{addedLine(guide.addedLong.cases, 'pairings')}</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
            {guide.cases.map((c) => (
              <Blueprint key={c.title} plain style={{ paddingBlock: 'calc(15px * var(--density, 1))', paddingInline: 'calc(15px * var(--density, 1))' }}>
                <div className="kicker">{c.when}</div>
                <div
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: 'calc(18px * var(--text-scale, 1))',
                    lineHeight: 1.15,
                    marginTop: 'var(--sp-2)',
                  }}
                >
                  {c.title}
                </div>
                {(
                  [
                    ['Claim', c.claim],
                    ['Test', c.test],
                    ['Verdict', c.verdict],
                    ['So what', c.lesson],
                  ] as const
                ).map(([label, body]) =>
                  body ? (
                    <div key={label} style={{ marginTop: 'var(--sp-5)' }}>
                      <div
                        style={{
                          fontFamily: 'var(--font-heading)',
                          fontSize: 'calc(10px * var(--text-scale, 1))',
                          letterSpacing: '0.14em',
                          textTransform: 'uppercase',
                          ...secondLine(),
                        }}
                      >
                        {label}
                      </div>
                      <div
                        style={{
                          fontSize: 'var(--type-base-plus)',
                          lineHeight: 'var(--leading-relaxed)',
                          color: 'var(--app-dim)',
                          marginTop: 'var(--sp-1)',
                          textWrap: 'pretty',
                        }}
                      >
                        {body}
                      </div>
                    </div>
                  ) : null,
                )}
              </Blueprint>
            ))}
          </div>
        </>
      )}

      {/* ── Figures that belong to no one unit ───────────────────────── */}
      {extras.length > 0 && (
        <>
          <SectionLabel style={{ marginTop: 'calc(36px * var(--density, 1))', marginInline: '0', marginBottom: 'calc(10px * var(--density, 1))' }}>Also worth knowing</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-7)' }}>
            {extras.map((f, i) => (
              <FigureCard key={`x${i}`} figure={f} />
            ))}
          </div>
        </>
      )}

      {/* ── Glossary ─────────────────────────────────────────────────── */}
      {guide.terms.length > 0 && (
        <>
          <SectionLabel style={{ marginTop: 'calc(36px * var(--density, 1))', marginInline: '0', marginBottom: 'calc(6px * var(--density, 1))' }}>Glossary</SectionLabel>
          {guide.terms.map((t) => (
            <div key={t.t} style={termRow}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(15.5px * var(--text-scale, 1))' }}>{t.t}</div>
              <div
                style={{
                  fontSize: 'var(--type-base)',
                  color: 'var(--app-dim)',
                  lineHeight: 'var(--leading-relaxed)',
                  marginTop: 'var(--sp-1)',
                  textWrap: 'pretty',
                }}
              >
                {t.d}
              </div>
            </div>
          ))}
        </>
      )}

      {/* ── Self-test ────────────────────────────────────────────────── */}
      {guide.selfTest && guide.selfTest.length > 0 && (
        <>
          <SectionLabel style={{ marginTop: 'calc(36px * var(--density, 1))', marginInline: '0', marginBottom: 'calc(6px * var(--density, 1))' }}>Test yourself</SectionLabel>
          <div style={{ fontSize: 'var(--type-sm-plus)', color: 'var(--app-dim)', lineHeight: 'var(--leading-relaxed)', marginBottom: 'var(--sp-5)' }}>
            The guide’s own questions, written to be answered out loud. Answers are below each one —
            cover them, or use Cards if you would rather they were hidden.
          </div>
          {guide.addedLong.selfTest > 0 && (
            <div style={{ ...SINCE, marginBottom: 'var(--sp-5)' }}>
              {addedLine(guide.addedLong.selfTest, 'questions')}
            </div>
          )}
          {guide.selfTest.map((c, i) => (
            <div key={c.q} style={askRow}>
              <div style={{ display: 'flex', gap: 'calc(11px * var(--density, 1))' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: 'var(--type-base)',
                    ...faintLine(),
                    flex: 'none',
                    width: 20,
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: 'block',
                      fontFamily: 'var(--font-heading)',
                      fontSize: 'var(--type-lg)',
                      lineHeight: 1.25,
                    }}
                  >
                    {c.q}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 'var(--type-base-plus)',
                      color: 'var(--app-dim)',
                      lineHeight: 'var(--leading-relaxed-plus)',
                      marginTop: 'var(--sp-2)',
                      textWrap: 'pretty',
                    }}
                  >
                    {c.a}
                  </span>
                </span>
              </div>
            </div>
          ))}
        </>
      )}

      <div
        style={{
          marginTop: 'calc(30px * var(--density, 1))',
          paddingTop: 'var(--sp-6)',
          borderTop: '1px solid var(--app-line)',
          fontSize: 'var(--type-xs)',
          ...faintLine(),
          lineHeight: 'var(--leading-relaxed)',
        }}
      >
        End of {guide.code}. {guide.source ? `Built from ${guide.source}.` : ''} Anything you add to
        this course appears here too, marked.
      </div>
      </Folding>
    </div>
  );
}
