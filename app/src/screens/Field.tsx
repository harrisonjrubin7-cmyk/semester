import { useRef } from 'react';
import { useStore } from '../state/store';
import { useLive } from '../lib/live';
import { Blueprint } from '../components/Blueprint';
import { FigureCard } from '../components/FigureCard';
import { SectionLabel } from '../components/ui';

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
  const { state, catalog } = useStore();
  const { guide, figures: figMap, extras } = useLive(state.guideId);
  const sections = useRef<(HTMLDivElement | null)[]>([]);

  const cards = guide.units.reduce((n, u) => n + u.cards.length, 0);
  const meta = [
    `${guide.units.length} ${guide.units.length === 1 ? 'section' : 'sections'}`,
    `${cards} ${cards === 1 ? 'point' : 'points'}`,
    guide.terms.length ? `${guide.terms.length} terms` : '',
    guide.selfTest?.length ? `${guide.selfTest.length} self-test` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div style={{ marginTop: 18 }}>
      {/* ── Masthead ─────────────────────────────────────────────────── */}
      <Blueprint style={{ padding: '20px 17px', background: 'var(--app-hero)' }}>
        <div className="kicker">Field guide · {guide.code}</div>
        <div
          className="chrome-text"
          style={{
            fontSize: 'calc(30px * var(--text-scale, 1))',
            lineHeight: 1.06,
            letterSpacing: '-0.01em',
            marginTop: 8,
            textWrap: 'pretty',
          }}
        >
          {guide.name}
        </div>
        <div
          style={{
            fontSize: 'calc(14px * var(--text-scale, 1))',
            opacity: 0.75,
            lineHeight: 1.5,
            marginTop: 8,
            textWrap: 'pretty',
          }}
        >
          {guide.blurb}
        </div>
        <div
          style={{
            marginTop: 12,
            paddingTop: 11,
            borderTop: '1px solid var(--app-line)',
            fontFamily: 'var(--font-heading)',
            fontSize: 'calc(10.5px * var(--text-scale, 1))',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            opacity: 0.55,
          }}
        >
          {meta}
        </div>
        {guide.source && (
          <div style={{ fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.45, marginTop: 6 }}>From {guide.source}</div>
        )}
      </Blueprint>

      {/* ── Contents ─────────────────────────────────────────────────── */}
      <SectionLabel>Contents</SectionLabel>
      {guide.units.map((u, i) => (
        <button
          key={u.name}
          type="button"
          className="bare tappable"
          onClick={() => sections.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'baseline',
            padding: '9px 0',
            borderBottom: '1px solid var(--app-line)',
            textAlign: 'left',
          }}
        >
          <span
            style={{
              width: 24,
              flex: 'none',
              fontFamily: 'var(--font-heading)',
              fontSize: 'calc(13px * var(--text-scale, 1))',
              opacity: 0.4,
            }}
          >
            {String(i + 1).padStart(2, '0')}
          </span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 'calc(14px * var(--text-scale, 1))', lineHeight: 1.3 }}>{u.name}</span>
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'calc(10.5px * var(--text-scale, 1))',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              opacity: 0.4,
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
            style={{ marginTop: 34, scrollMarginTop: 12 }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 12,
                paddingBottom: 9,
                borderBottom: '1px solid var(--app-accent)',
              }}
            >
              <div
                className="chrome-text"
                style={{ fontSize: 'calc(26px * var(--text-scale, 1))', lineHeight: 1, flex: 'none', opacity: 0.55 }}
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
              <div style={{ marginTop: 15 }}>
                <FigureCard figure={fig} />
              </div>
            )}

            {u.cards.map((c, ci) => (
              <div key={c.q} style={{ marginTop: 17 }}>
                {ci >= base && (
                  <span className="tag tag-accent" style={{ marginBottom: 6, display: 'inline-block' }}>
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
                    fontSize: 'calc(14px * var(--text-scale, 1))',
                    lineHeight: 1.6,
                    opacity: 0.85,
                    marginTop: 5,
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
          <SectionLabel style={{ margin: '36px 0 10px' }}>
            {catalog.frameLabels[state.guideId] ?? 'Frames'}
          </SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {guide.frames.map((f) => (
              <div
                key={f.t}
                style={{
                  borderLeft: '2px solid var(--app-accent)',
                  paddingLeft: 13,
                  paddingTop: 2,
                  paddingBottom: 2,
                }}
              >
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(17px * var(--text-scale, 1))', lineHeight: 1.15 }}>
                  {f.t}
                </div>
                <div
                  style={{
                    fontSize: 'calc(13.5px * var(--text-scale, 1))',
                    opacity: 0.75,
                    lineHeight: 1.5,
                    marginTop: 4,
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
          <SectionLabel style={{ margin: '36px 0 10px' }}>Case files</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {guide.cases.map((c) => (
              <Blueprint key={c.title} plain style={{ padding: '15px 15px' }}>
                <div className="kicker">{c.when}</div>
                <div
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: 'calc(18px * var(--text-scale, 1))',
                    lineHeight: 1.15,
                    marginTop: 4,
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
                    <div key={label} style={{ marginTop: 10 }}>
                      <div
                        style={{
                          fontFamily: 'var(--font-heading)',
                          fontSize: 'calc(10px * var(--text-scale, 1))',
                          letterSpacing: '0.14em',
                          textTransform: 'uppercase',
                          opacity: 0.45,
                        }}
                      >
                        {label}
                      </div>
                      <div
                        style={{
                          fontSize: 'calc(13.5px * var(--text-scale, 1))',
                          lineHeight: 1.5,
                          opacity: 0.85,
                          marginTop: 2,
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
          <SectionLabel style={{ margin: '36px 0 10px' }}>Also worth knowing</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {extras.map((f, i) => (
              <FigureCard key={`x${i}`} figure={f} />
            ))}
          </div>
        </>
      )}

      {/* ── Glossary ─────────────────────────────────────────────────── */}
      {guide.terms.length > 0 && (
        <>
          <SectionLabel style={{ margin: '36px 0 6px' }}>Glossary</SectionLabel>
          {guide.terms.map((t) => (
            <div key={t.t} style={{ padding: '11px 0', borderBottom: '1px solid var(--app-line)' }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(15.5px * var(--text-scale, 1))' }}>{t.t}</div>
              <div
                style={{
                  fontSize: 'calc(13px * var(--text-scale, 1))',
                  opacity: 0.72,
                  lineHeight: 1.5,
                  marginTop: 2,
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
          <SectionLabel style={{ margin: '36px 0 6px' }}>Test yourself</SectionLabel>
          <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.6, lineHeight: 1.5, marginBottom: 10 }}>
            The guide’s own questions, written to be answered out loud. Answers are below each one —
            cover them, or use Cards if you would rather they were hidden.
          </div>
          {guide.selfTest.map((c, i) => (
            <div key={c.q} style={{ padding: '13px 0', borderBottom: '1px solid var(--app-line)' }}>
              <div style={{ display: 'flex', gap: 11 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: 'calc(13px * var(--text-scale, 1))',
                    opacity: 0.4,
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
                      fontSize: 'calc(15px * var(--text-scale, 1))',
                      lineHeight: 1.25,
                    }}
                  >
                    {c.q}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 'calc(13.5px * var(--text-scale, 1))',
                      opacity: 0.7,
                      lineHeight: 1.55,
                      marginTop: 4,
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
          marginTop: 30,
          paddingTop: 12,
          borderTop: '1px solid var(--app-line)',
          fontSize: 'calc(11px * var(--text-scale, 1))',
          opacity: 0.4,
          lineHeight: 1.5,
        }}
      >
        End of {guide.code}. {guide.source ? `Built from ${guide.source}.` : ''} Anything you add to
        this course appears here too, marked.
      </div>
    </div>
  );
}
