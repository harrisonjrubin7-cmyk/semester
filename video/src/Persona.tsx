import { AbsoluteFill, useVideoConfig } from 'remotion';
import { tokensFor } from '../../app/src/lib/look';

/**
 * The layout of a character reference sheet, drawn before one is bought.
 *
 * ## What this is, and what it is not
 *
 * It is not the sheet. The sheet is nine drawings of a character that does not
 * exist yet, and only an image model is going to make those. This is the
 * storyboard for it: the nine panels at the arrangement and proportion the
 * prompt asks for, each labelled with the view and expression that belongs in
 * it, with the framing guide each one should be composed to.
 *
 * It exists because the sheet is the expensive artefact and the one nobody can
 * un-make. Every clip of a course is generated against it, so a persona
 * settled carelessly is a face on four courses — and the first chance anybody
 * gets to disagree should not be after the invoice. `--broll none` made the
 * same argument for the documentary: the mode that costs nothing has to do
 * something real, or the two modes are impossible to tell apart in a review.
 *
 * Afterwards it has a second use. Hold the generated sheet against this and
 * the panels either line up or they do not, which is a cheaper answer than
 * looking at nine drawings and trying to remember what was asked for.
 *
 * ## Why 3:4 and not the frame everything else uses
 *
 * A 3×3 grid of portrait panels is a portrait page. Drawn at 1920×1080 each
 * cell comes out about 550 by 200, which is a letterbox, and a letterbox is
 * the one shape a head-and-shoulders portrait cannot be composed in. The
 * sheet is a still and owes nothing to a video's aspect.
 */

export interface PersonaPanel {
  view: string;
  expression: string;
}

export interface PersonaProps extends Record<string, unknown> {
  /** The preset id, e.g. "host-nell". */
  id: string;
  name: string;
  role: string;
  label: string;
  /** The character in one sentence, from `personas.mjs`'s `describe`. */
  described: string;
  note: string;
  panels: PersonaPanel[];
  ground: string;
  accent: string;
}

export function Persona({
  id,
  name,
  role,
  label,
  described,
  note,
  panels,
  ground,
  accent,
}: PersonaProps) {
  const { width, height } = useVideoConfig();
  /*
   * `tokensFor`, not a palette retyped here. Thirteen grounds and two faded
   * strengths have been got wrong twice by being measured against the wrong
   * surface — `CLAUDE.md` has the story — and a sheet is where a persona's
   * accent is decided for every course it appears in.
   */
  const tokens = tokensFor({ ground, accent }, false);
  const pad = Math.round(width * 0.055);
  const gap = Math.round(width * 0.02);

  return (
    <AbsoluteFill
      style={{
        background: tokens['--app-bg'],
        color: tokens['--app-fg'],
        fontFamily: 'Barlow, system-ui, sans-serif',
        padding: pad,
        display: 'flex',
        flexDirection: 'column',
        gap,
      }}
    >
      <div>
        <div
          style={{
            fontSize: Math.round(height * 0.016),
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: tokens['--app-accent-deep'],
          }}
        >
          {`Character reference · ${id}`}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: Math.round(width * 0.02) }}>
          <div style={{ fontSize: Math.round(height * 0.045), lineHeight: 1.1 }}>{name}</div>
          <div style={{ fontSize: Math.round(height * 0.019), opacity: 0.6 }}>
            {`${label} · ${role}`}
          </div>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gridTemplateRows: 'repeat(3, 1fr)',
          gap,
        }}
      >
        {panels.map((panel) => (
          <Cell
            key={`${panel.view}-${panel.expression}`}
            panel={panel}
            tokens={tokens}
            size={Math.round(height * 0.014)}
          />
        ))}
      </div>

      <div style={{ fontSize: Math.round(height * 0.019), lineHeight: 1.45, textWrap: 'pretty' }}>
        <span style={{ color: tokens['--app-accent'] }}>{'Every panel: '}</span>
        {described}
        {/* An em dash, not a full stop: the note continues the sentence, and
            a note is lowercase by the rule `personas.mjs` enforces — so a
            stop in front of it reads as a typo rather than as punctuation. */}
        {note ? ` — ${note}` : ''}
        {'.'}
      </div>
      <div style={{ fontSize: Math.round(height * 0.014), opacity: 0.5, lineHeight: 1.4 }}>
        Flat neutral background, even lighting, no scene, no text. A layout, not
        a drawing — nothing here has been generated and nothing has been spent.
      </div>
    </AbsoluteFill>
  );
}

/**
 * One panel: a frame, a framing guide, and what goes in it.
 *
 * The guide is an ellipse and a rule — head height and shoulder line at the
 * proportions a head-and-shoulders portrait wants. Geometry rather than a
 * sketch, because a sketch of a character nobody has designed would be this
 * file deciding what the image model was asked to decide.
 *
 * Both sit in the upper two thirds, clear of the label. The first cut put the
 * shoulder rule at 78% and it ran straight through the word `FRONT`, which in
 * a still reads as a line struck through the label rather than as a guide.
 */
function Cell({
  panel,
  tokens,
  size,
}: {
  panel: PersonaPanel;
  tokens: Record<string, string>;
  size: number;
}) {
  return (
    <div
      style={{
        border: `1px solid ${tokens['--app-track']}`,
        borderRadius: 6,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: size,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '14%',
          width: '34%',
          aspectRatio: '3 / 4',
          transform: 'translateX(-50%)',
          border: `1px solid ${tokens['--app-accent-deep']}`,
          borderRadius: '50%',
          opacity: 0.45,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '16%',
          right: '16%',
          top: '58%',
          height: 1,
          background: tokens['--app-accent-deep'],
          opacity: 0.45,
        }}
      />
      <div
        style={{
          position: 'relative',
          fontSize: size,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: tokens['--app-accent'],
        }}
      >
        {panel.view}
      </div>
      <div style={{ position: 'relative', fontSize: Math.round(size * 1.25), opacity: 0.75 }}>
        {panel.expression}
      </div>
    </div>
  );
}

/** The sheet is a still, so one frame is the whole composition. */
export const PERSONA_WIDTH = 1080;
export const PERSONA_HEIGHT = 1440;
