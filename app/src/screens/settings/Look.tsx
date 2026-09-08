import type { CSSProperties } from 'react';
import { useStore } from '../../state/store';
import { SettingsPage } from './Page';
import { CustomRow, Group, SelectRow } from '../../components/shell/Rows';
import { TONE_LABELS } from '../../lib/tone';
import { lights } from '../../lib/settings';
import { SectionLabel, Segmented, Toggle } from '../../components/ui';
import { usePrefersDark } from '../../lib/prefers';
import {
  ACCENTS,
  BODYFACES,
  CORNERS,
  DENSITIES,
  GROUNDS,
  ICON_SHAPES,
  LINE_HEIGHTS,
  MATCH_DEVICE,
  MATCH_GROUND,
  READING_WIDTHS,
  accentFromHue,
  SIZES,
  TYPEFACES,
  contrast,
  contrastVerdict,
  ground as groundOf,
  resolveCorners,
  resolveGround,
} from '../../lib/look';

/**
 * A hue you can drag, with the reason it is safe to offer.
 *
 * A colour picker without a contrast readout is a way to let somebody make
 * their own app unreadable and then wonder why it happened. So the number moves
 * with the slider, in words rather than as a standard nobody outside the trade
 * has heard of: "Easy to read", "Readable", "Hard work at small sizes", "Too
 * faint to read".
 *
 * The check is against `shade` rather than `base`, because `shade` is what
 * section labels are set in — small, uppercase and tracked out, which is the
 * hardest thing on any screen to read and therefore the one worth measuring.
 *
 * It never refuses a colour. Somebody who wants a faint accent for a reason of
 * their own is allowed to have it; what they are not allowed is to have it
 * without being told.
 */
/**
 * The explanation under a control.
 *
 * One object rather than twelve identical inline ones — this screen is nothing
 * but rows of a control and a sentence saying what it does, and the twelfth
 * copy of the same four properties is where they start drifting apart.
 */
const HINT: CSSProperties = {
  fontSize: 'calc(11.5px * var(--text-scale, 1))',
  opacity: 0.5,
  marginTop: 'var(--sp-3)',
  lineHeight: 'var(--leading-normal)',
};

function HuePicker() {
  const { state, dispatch } = useStore();
  const prefersDark = usePrefersDark();
  const on = state.hue >= 0;
  const g = groundOf(resolveGround(state.ground, prefersDark));
  const derived = accentFromHue(on ? state.hue : 210, g.light);
  // The second entry of the ramp is `--app-bg`, which is the surface a section
  // label actually sits on.
  const ratio = contrast(derived.shade, g.ramp[1]);
  const verdict = contrastVerdict(ratio);

  return (
    <>
      <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>
        Your own accent
      </SectionLabel>
      <Toggle
        label="Pick a hue instead of one of the accents"
        on={on}
        onChange={() => dispatch({ type: 'setLook', look: { hue: on ? -1 : 210 } })}
      />
      {on && (
        <>
          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={state.hue}
            aria-label="Accent hue"
            onChange={(e) => dispatch({ type: 'setLook', look: { hue: Number(e.target.value) } })}
            style={{
              width: '100%',
              marginTop: 'var(--sp-6)',
              accentColor: derived.base,
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-5)', marginTop: 'var(--sp-5)' }}>
            <span
              aria-hidden
              style={{
                width: 26,
                height: 26,
                flex: 'none',
                borderRadius: 'var(--r-sm)',
                background: derived.base,
                border: '1px solid var(--app-line)',
              }}
            />
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 'calc(12.5px * var(--text-scale, 1))',
                fontFamily: 'var(--font-heading)',
                color: derived.shade,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              Section label
            </span>
            <span
              style={{
                flex: 'none',
                fontSize: 'calc(11.5px * var(--text-scale, 1))',
                opacity: verdict.ok ? 0.65 : 1,
                color: verdict.ok ? undefined : 'var(--app-warn, #d9534f)',
                textAlign: 'right',
              }}
            >
              {verdict.label}
            </span>
          </div>
          <div style={HINT}>
            Measured against the ground you are on, using the smallest thing the accent is
            ever set in — a section label. Nothing stops you keeping a faint one; this only
            makes sure you know.
          </div>
        </>
      )}
    </>
  );
}

/**
 * What the app is made of: its colour, its type, its edges, its voice.
 *
 * Sixteen sections that used to be scattered through one long screen, grouped
 * into four: what colour it is, how it reads, how it talks, and how it is
 * spaced.
 *
 * What is deliberately *not* here is the app's shape — which navigation is
 * drawn and how a screen is arranged. Those two were split across this page
 * and the Navigation page, one each, so nobody could see one while changing
 * the other. They are together on **Layout and navigation** now, and this
 * page links to it rather than keeping a second copy of half the question.
 */
export function SettingsLook() {
  const { state, dispatch } = useStore();
  const prefersDark = usePrefersDark();

  return (
    <SettingsPage
      screen="setLook"
      title="Appearance"
      blurb="Ten grounds and seven metals, and none of them changes what anything does. Pick what you can read for four hours."
    >
      {(lit) => (
        <>
          <Group
            header="Colour"
            footer="The accent being a metal rather than a colour is most of why the app looks drawn instead of like a dashboard."
            lit={lights('accent ground colour color dark light theme mode parchment fog ink paper device', lit)}
          >
            <CustomRow>
              <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>The accent</SectionLabel>
              <div style={{ fontSize: 'var(--type-base)', opacity: 0.65, marginBottom: 'var(--sp-5)', textWrap: 'pretty' }}>
                All metals and stones. The accent being a metal rather than a colour is most of why the
                app looks drawn instead of like a dashboard, so these change the shade and not that.
              </div>
              <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
                {ACCENTS.map((a) => {
                  const on = state.accent === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      className="btn"
                      onClick={() => dispatch({ type: 'setLook', look: { accent: a.id } })}
                      aria-pressed={on}
                      style={{
                        flex: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        padding: '7px 12px',
                        fontSize: 'var(--type-sm)',
                        borderColor: on ? a.base : 'var(--app-line)',
                      }}
                    >
                      <span
                        style={{
                          width: 11,
                          height: 11,
                          borderRadius: '50%',
                          background: a.base,
                          flex: 'none',
                        }}
                      />
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </CustomRow>
            <CustomRow>
              <HuePicker />
            </CustomRow>
            <CustomRow>
              <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>The ground</SectionLabel>
              {/*
                Above the forty-two, because it is the answer for most people and
                because a device on a light-and-dark schedule otherwise means coming
                back here twice a day, which nobody does — they pick one and squint for
                half of it. See `lib/look.ts`.
              */}
              <button
                type="button"
                className="bare tappable"
                aria-pressed={state.ground === MATCH_DEVICE}
                onClick={() => dispatch({ type: 'setLook', look: { ground: MATCH_DEVICE } })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  textAlign: 'left',
                  padding: '10px 11px',
                  marginBottom: 7,
                  borderRadius: 'var(--r-sm)',
                  border: `1px solid ${state.ground === MATCH_DEVICE ? 'var(--app-accent)' : 'var(--app-line)'}`,
                  background: state.ground === MATCH_DEVICE ? 'var(--app-accent-wash)' : 'transparent',
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 'calc(13.5px * var(--text-scale, 1))' }}>
                    Match my device
                  </span>
                  <span style={{ display: 'block', fontSize: 'var(--type-xs)', opacity: 0.55, marginTop: 'var(--sp-1)' }}>
                    {`Ink after dark, Parchment in daylight. Following your device now: ${
                      prefersDark ? 'dark' : 'light'
                    }.`}
                  </span>
                </span>
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {GROUNDS.map((g) => {
                  const on = state.ground === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      className="bare tappable"
                      aria-pressed={on}
                      onClick={() => dispatch({ type: 'setLook', look: { ground: g.id } })}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 11,
                        textAlign: 'left',
                        padding: '10px 12px',
                        borderRadius: 'var(--r-md)',
                        border: `1px solid ${on ? 'var(--app-accent-deep)' : 'var(--app-line)'}`,
                        background: on ? 'var(--app-accent-wash)' : 'transparent',
                      }}
                    >
                      {/* The ramp itself, as five squares — quicker to judge than a name. */}
                      <span style={{ display: 'flex', flex: 'none', borderRadius: 3, overflow: 'hidden' }}>
                        {/* Keyed by position, not by colour: three of the grounds
                            repeat a step — ink starts on black twice, paper and fog
                            both end on white — and keying by the value made React
                            drop the duplicate, so those swatches showed four bars
                            where every other one showed five. */}
                        {g.ramp.map((step, i) => (
                          <span key={i} style={{ width: 8, height: 22, background: step }} />
                        ))}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 'var(--type-md)' }}>{g.label}</span>
                        <span style={{ display: 'block', fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 'var(--sp-1)' }}>
                          {g.blurb}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {groundOf(resolveGround(state.ground, prefersDark)).light && (
                <div style={{ ...HINT, marginTop: 'var(--sp-4)' }}>
                  On a light ground the brushed-metal type inverts to a dark sweep, so display headings
                  keep their lustre instead of disappearing.
                </div>
              )}
            </CustomRow>
          </Group>

          <Group
            header="Type"
            footer="Text size and line spacing move everything on every screen, including the tab bar. Nothing here is fixed in pixels."
            lit={lights('font fonts typeface heading body text size larger bigger smaller line height spacing reading width', lit)}
          >
            <CustomRow>
              <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>Headings</SectionLabel>
              <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
                {TYPEFACES.map((t) => {
                  const on = state.typeface === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className="btn"
                      aria-pressed={on}
                      onClick={() => dispatch({ type: 'setLook', look: { typeface: t.id } })}
                      style={{
                        flex: 'none',
                        padding: '7px 12px',
                        fontSize: 'var(--type-base)',
                        fontFamily: t.heading,
                        borderColor: on ? 'var(--app-accent)' : 'var(--app-line)',
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <div style={HINT}>
                {TYPEFACES.find((t) => t.id === state.typeface)?.blurb}
              </div>
            </CustomRow>
            <CustomRow>
              <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>Body text</SectionLabel>
              <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
                {BODYFACES.map((b) => {
                  const on = state.bodyface === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      className="btn"
                      aria-pressed={on}
                      onClick={() => dispatch({ type: 'setLook', look: { bodyface: b.id } })}
                      style={{
                        flex: 'none',
                        padding: '7px 12px',
                        fontSize: 'var(--type-base)',
                        fontFamily: b.body,
                        borderColor: on ? 'var(--app-accent)' : 'var(--app-line)',
                      }}
                    >
                      {b.label}
                    </button>
                  );
                })}
              </div>
              <div style={HINT}>
                {BODYFACES.find((b) => b.id === state.bodyface)?.blurb}
              </div>
            </CustomRow>
            <CustomRow>
              <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>Line spacing</SectionLabel>
              <Segmented
                options={LINE_HEIGHTS.map((l) => ({ id: l.id, label: l.label }))}
                value={state.lineHeight}
                onChange={(lineHeight) => dispatch({ type: 'setLook', look: { lineHeight } })}
              />
              <div style={HINT}>
                Separate from text size on purpose. “I cannot see this” and “this is a wall” are two
                different complaints, and one control for both fixes neither properly.
              </div>
            </CustomRow>
            <CustomRow>
              <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>Reading width</SectionLabel>
              <Segmented
                options={READING_WIDTHS.map((w) => ({ id: w.id, label: w.label }))}
                value={state.readingWidth}
                onChange={(readingWidth) => dispatch({ type: 'setLook', look: { readingWidth } })}
              />
              <div style={HINT}>
                {READING_WIDTHS.find((w) => w.id === state.readingWidth)?.blurb} Applies to the screens
                that are read rather than scanned — a guide, an essay. The app’s column is already close to
                the comfortable measure, so in practice this narrows it rather than widening it: past about
                75 characters the eye loses the start of the next line coming back, and the column does not
                get that far.
              </div>
            </CustomRow>
            <CustomRow>
              <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>Text size</SectionLabel>
              <Segmented
                options={SIZES.map((z) => ({ id: z.id, label: z.label }))}
                value={state.textSize}
                onChange={(textSize) => dispatch({ type: 'setLook', look: { textSize } })}
              />
              <div style={HINT}>
                Scales the text. Buttons and the tab bar keep their size on purpose — a tap target that
                grew with the type would push the bar off the bottom of a phone.
              </div>

              {/* The one setting that changes an arithmetic rather than a look. */}
            </CustomRow>
          </Group>

          <Group
            header="How it talks to you"
            footer="The figures are the same in all three — five overdue is five overdue. Only the words around them change."
            lit={lights('tone voice wording supportive direct minimal phrasing language kind blunt', lit)}
          >
            <SelectRow
              label="Tone"
              value={state.tone}
              options={TONE_LABELS.map((t) => ({ id: t.id, label: t.label, sub: t.blurb }))}
              onChange={(tone) => dispatch({ type: 'setTone', tone })}
            />
          </Group>

          <Group
            header="Shape and spacing"
            footer="How much fits on a screen, and how hard the edges are."
            lit={lights('corners rounded square spacing density icon shape badges tab bar labels feed style', lit)}
          >
            <CustomRow>
              <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>Corners</SectionLabel>
              <Segmented
                options={[
                  // First, and the default. Two of the twelve grounds were
                  // drawn square and say so; the other ten decline to have an
                  // opinion and this resolves to Drawn for them, which is what
                  // it has always been.
                  { id: MATCH_GROUND, label: 'Match' },
                  ...CORNERS.map((c) => ({ id: c.id, label: c.label })),
                ]}
                value={state.corners}
                onChange={(corners) => dispatch({ type: 'setLook', look: { corners } })}
              />
              <div style={HINT}>
                {state.corners === MATCH_GROUND
                  ? `Following the ground — ${CORNERS.find(
                      (c) => c.id === resolveCorners(state.corners, resolveGround(state.ground, prefersDark)),
                    )?.label.toLowerCase()} on ${groundOf(resolveGround(state.ground, prefersDark)).label}.`
                  : 'Your own choice, kept through every ground.'}
              </div>
            </CustomRow>
            <CustomRow>
              <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>Spacing</SectionLabel>
              <Segmented
                options={DENSITIES.map((d) => ({ id: d.id, label: d.label }))}
                value={state.density}
                onChange={(density) => dispatch({ type: 'setLook', look: { density } })}
              />
              <div style={HINT}>
                Tightens the space around every section heading, which is the app’s vertical rhythm.
                Tap targets do not shrink with it — a 30px button is a miss, and a miss costs more than
                the line it saved.
              </div>
            </CustomRow>
            <CustomRow>
              <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>Icon shape</SectionLabel>
              <Segmented
                options={ICON_SHAPES.map((i) => ({ id: i.id, label: i.label }))}
                value={state.iconShape}
                onChange={(iconShape) => dispatch({ type: 'setLook', look: { iconShape } })}
              />
            </CustomRow>
          </Group>
        </>
      )}
    </SettingsPage>
  );
}
