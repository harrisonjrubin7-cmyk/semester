import type { CSSProperties } from 'react';
import type { Theme } from '../../lib/decks';
import type { Slide } from '../../lib/pptx';
import { ActionButton, SectionLabel } from '../../components/ui';

/**
 * The slide, drawn.
 *
 * The editor was a stack of form fields — a box for the title, a box for the
 * points, a box for each cell — and a deck built out of form fields is a deck
 * you have never seen until you export it. Which is exactly when the two
 * things you cannot fix are found: a title that runs onto three lines, and
 * eleven points on a slide that holds six.
 *
 * So this is one renderer, used three times:
 *
 * - {@link Canvas} — the slide you type into, laid out where the exported one
 *   lays out, in the deck's own colours;
 * - {@link Still} — the same slide with nothing to type into, which is what
 *   the presenter view shows;
 * - {@link Thumb} — the same slide the size of a postage stamp, for the rail.
 *
 * One renderer rather than three is not tidiness. The editor drew a slide one
 * way, the presenter drew it another and `lib/pptx.ts` drew it a third, and
 * the presenter's version had already drifted: it showed a table the exported
 * slide sized differently and put the equation last where the file puts it
 * first. What you see is what comes out, and that is only true if there is one
 * of them.
 *
 * ## The colours come from the deck
 *
 * Not from the app's palette. A slide is going on a wall or onto paper, and
 * the theme is the choice that decides which — see `THEMES` in
 * `lib/decks.ts`. That is why nothing here reads `--app-fg`.
 */

/** The ground and the two ranks of type, as CSS. */
function paint(theme: Theme): { ground: string; ink: string; dim: string } {
  return {
    ground: `#${theme.palette.ink}`,
    ink: `#${theme.palette.paper}`,
    dim: `#${theme.palette.dim}`,
  };
}

/** The frame every drawing of a slide sits in: sixteen by nine, and the ground. */
function stage(theme: Theme, extra?: CSSProperties): CSSProperties {
  const look = paint(theme);
  return {
    aspectRatio: '16 / 9',
    background: look.ground,
    color: look.ink,
    border: '1px solid var(--app-line)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    ...extra,
  };
}

/**
 * A field on the canvas.
 *
 * A real `<input>` or `<textarea>` with its chrome taken off, rather than a
 * `contentEditable` div. The placeholder reads "Click to add a title" because
 * that is what an empty slide has to say, and the accessible name says what
 * the field is for — the two are different sentences and both are needed.
 */
function Field({
  value,
  onChange,
  placeholder,
  says,
  lines = 1,
  look,
  style,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  says: string;
  lines?: number;
  look: { ink: string; dim: string };
  style?: CSSProperties;
}) {
  const shared: CSSProperties = {
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderRadius: 0,
    color: look.ink,
    padding: 0,
    resize: 'none',
    // The placeholder's colour, which cannot be set inline — see
    // `.canvas-field::placeholder` in `app.css`.
    ['--slide-dim' as string]: look.dim,
    ...style,
  };
  return lines > 1 ? (
    <textarea
      className="input canvas-field"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={says}
      rows={lines}
      style={shared}
    />
  ) : (
    <input
      className="input canvas-field"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={says}
      style={shared}
    />
  );
}

/**
 * The slide you type into.
 *
 * Laid out the way `slideXml` lays the exported one out: an opening slide is
 * its title in the middle with a line under it, and every other slide is a
 * title at the top with the body beneath. What is *in* the body is the
 * layout's business — a table slide has a table and nothing else to type into,
 * which is what makes changing layout a real choice rather than a label.
 */
export function Canvas({
  slide,
  theme,
  at,
  onChange,
}: {
  slide: Slide;
  theme: Theme;
  /** Which slide this is, for the field names a screen reader reads out. */
  at: number;
  onChange: (next: Slide) => void;
}) {
  const look = paint(theme);
  const opening = slide.opening === true;
  const on = `on slide ${at + 1}`;

  return (
    <div
      style={stage(theme, {
        padding: 'var(--sp-7)',
        gap: 'var(--sp-4)',
        justifyContent: opening ? 'center' : 'flex-start',
      })}
    >
      <Field
        value={slide.title}
        onChange={(title) => onChange({ ...slide, title })}
        placeholder="Click to add a title"
        says={`Title ${on}`}
        look={look}
        style={{
          fontSize: opening ? 'var(--type-xl)' : 'var(--type-lg)',
          lineHeight: 'var(--leading-tight)',
          fontWeight: 600,
          height: 'auto',
        }}
      />

      {slide.note !== undefined && (
        <Field
          value={slide.note}
          onChange={(note) => onChange({ ...slide, note })}
          placeholder={opening ? 'Click to add a subtitle' : 'Click to add a line under the title'}
          says={`The line under the title ${on}`}
          look={{ ink: look.dim, dim: look.dim }}
          style={{ fontSize: 'var(--type-md)', height: 'auto' }}
        />
      )}

      {slide.equation !== undefined && (
        <Field
          value={slide.equation}
          onChange={(equation) => onChange({ ...slide, equation })}
          placeholder="Click to add an equation"
          says={`Equation ${on}`}
          look={look}
          style={{ fontSize: 'var(--type-lg)', textAlign: 'center', height: 'auto' }}
        />
      )}

      {slide.table && (
        <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              {slide.table.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} style={{ border: `1px solid ${look.dim}`, padding: 0 }}>
                      <Field
                        value={cell}
                        onChange={(next) =>
                          onChange({
                            ...slide,
                            table: (slide.table ?? []).map((line, i) =>
                              i === r ? line.map((was, j) => (j === c ? next : was)) : line,
                            ),
                          })
                        }
                        placeholder={r === 0 ? 'Heading' : ''}
                        says={`${on}, ${r === 0 ? 'heading' : `row ${r}`}, column ${c + 1}`}
                        look={r === 0 ? look : { ink: look.dim, dim: look.dim }}
                        style={{
                          fontSize: 'var(--type-sm)',
                          fontWeight: r === 0 ? 600 : 400,
                          padding: 'var(--sp-2) var(--sp-3)',
                          height: 'auto',
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!opening && !slide.table && slide.equation === undefined && (
        <Field
          value={slide.bullets.join('\n')}
          onChange={(text) =>
            onChange({
              ...slide,
              // The trailing empty line is kept while somebody is typing and
              // dropped once they have moved on, which is what makes Return at
              // the end of the last point feel like a new point rather than
              // like nothing happening.
              bullets: text.split('\n').filter((l, i, all) => l !== '' || i < all.length - 1),
            })
          }
          placeholder="Click to add text — one point per line"
          says={`Points ${on}`}
          lines={6}
          look={look}
          style={{
            fontSize: 'var(--type-md)',
            lineHeight: 'var(--leading-relaxed)',
            flex: 1,
            minHeight: 0,
          }}
        />
      )}

      {slide.table && (
        <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
          <ActionButton
            onClick={() => {
              const width = slide.table?.[0]?.length ?? 2;
              onChange({ ...slide, table: [...(slide.table ?? []), Array(width).fill('')] });
            }}
            style={{ width: 'auto', padding: 'var(--sp-2) var(--sp-5)' }}
          >
            Add a row
          </ActionButton>
          <ActionButton
            onClick={() =>
              onChange({ ...slide, table: (slide.table ?? []).map((row) => [...row, '']) })
            }
            style={{ width: 'auto', padding: 'var(--sp-2) var(--sp-5)' }}
          >
            Add a column
          </ActionButton>
        </div>
      )}
    </div>
  );
}

/**
 * The slide with nothing to type into — what the room sees.
 *
 * Everything the exported slide carries has to be here too. A presenter view
 * showing less than the file is a presenter view that lies about what is on
 * the wall: a deck built from a sheet is all table, and used to show as a bare
 * title.
 */
export function Still({ slide, theme }: { slide: Slide; theme: Theme }) {
  const look = paint(theme);
  const opening = slide.opening === true;
  return (
    <div
      style={stage(theme, {
        padding: 'var(--sp-7)',
        gap: 'var(--sp-5)',
        justifyContent: opening ? 'center' : 'flex-start',
      })}
    >
      <h2
        style={{
          fontSize: opening ? 'var(--type-xl)' : 'var(--type-lg)',
          lineHeight: 'var(--leading-tight)',
          margin: 0,
        }}
      >
        {slide.title}
      </h2>
      {slide.note !== undefined && slide.note !== '' && (
        <div style={{ color: look.dim, fontSize: 'var(--type-md)' }}>{slide.note}</div>
      )}
      {slide.equation !== undefined && slide.equation !== '' && (
        <div style={{ fontSize: 'var(--type-lg)', textAlign: 'center' }}>{slide.equation}</div>
      )}
      {slide.table && slide.table.length > 0 && (
        <div style={{ overflow: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 'var(--type-sm)', width: '100%' }}>
            <tbody>
              {slide.table.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td
                      key={c}
                      style={{
                        border: `1px solid ${look.dim}`,
                        padding: 'var(--sp-2) var(--sp-4)',
                        color: r === 0 ? look.ink : look.dim,
                        fontWeight: r === 0 ? 600 : 400,
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {slide.bullets.length > 0 && (
        <ul
          style={{
            margin: 0,
            paddingLeft: 'var(--sp-7)',
            fontSize: 'var(--type-md)',
            lineHeight: 'var(--leading-relaxed)',
          }}
        >
          {slide.bullets.map((line, n) => (
            <li key={n}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The slide the size of a postage stamp.
 *
 * Words rather than grey bars: the rail is how somebody finds the slide about
 * the second experiment, and a rail of identical grey rectangles is a rail you
 * have to click through one at a time. Too small to read is fine; too small to
 * recognise is not.
 */
export function Thumb({ slide, theme }: { slide: Slide; theme: Theme }) {
  const look = paint(theme);
  return (
    <div
      aria-hidden="true"
      style={stage(theme, {
        padding: 'var(--sp-3)',
        gap: 'var(--sp-1)',
        justifyContent: slide.opening ? 'center' : 'flex-start',
      })}
    >
      <div
        style={{
          fontSize: 'var(--type-xs)',
          lineHeight: 'var(--leading-tight)',
          fontWeight: 600,
          overflow: 'hidden',
        }}
      >
        {slide.title || ' '}
      </div>
      {slide.note ? (
        <div style={{ fontSize: 'var(--type-xs)', color: look.dim, overflow: 'hidden' }}>
          {slide.note}
        </div>
      ) : null}
      {slide.bullets.slice(0, 3).map((line, n) => (
        <div
          key={n}
          style={{
            fontSize: 'var(--type-xs)',
            color: look.dim,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          · {line}
        </div>
      ))}
      {slide.table ? (
        <div style={{ fontSize: 'var(--type-xs)', color: look.dim }}>
          {slide.table.length} × {slide.table[0]?.length ?? 0} table
        </div>
      ) : null}
      {slide.equation ? (
        <div style={{ fontSize: 'var(--type-xs)', color: look.dim, overflow: 'hidden' }}>
          {slide.equation}
        </div>
      ) : null}
    </div>
  );
}

/** The speaker-notes pane, under the canvas, where every slide editor puts it. */
export function Notes({
  value,
  at,
  onChange,
}: {
  value: string;
  at: number;
  onChange: (next: string) => void;
}) {
  return (
    <div>
      <SectionLabel>What you say</SectionLabel>
      <textarea
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Click to add speaker notes — yours, not the room’s"
        aria-label={`Speaker notes for slide ${at + 1}`}
        rows={4}
        style={{ width: '100%', fontSize: 'var(--type-base)' }}
      />
    </div>
  );
}
