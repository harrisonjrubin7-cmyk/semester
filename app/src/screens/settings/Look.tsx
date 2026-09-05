import { useStore } from '../../state/store';
import { SettingsPage } from './Page';
import { CustomRow, SettingsGroup } from '../../components/settings/Rows';
import { lights } from '../../lib/settings';
import { ShellPicker } from '../../components/ShellPicker';
import { SectionLabel, Segmented, Toggle } from '../../components/ui';
import { usePrefersDark } from '../../lib/prefers';
import {
  ACCENTS,
  BADGES,
  BODYFACES,
  CORNERS,
  DENSITIES,
  FEEDS,
  GROUNDS,
  ICON_SHAPES,
  LABELS,
  LINE_HEIGHTS,
  MATCH_DEVICE,
  READING_WIDTHS,
  accentFromHue,
  SIZES,
  TYPEFACES,
  contrast,
  contrastVerdict,
  ground as groundOf,
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
              marginTop: 12,
              accentColor: derived.base,
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
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
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 6, lineHeight: 1.45 }}>
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
 * Everything about how the app looks.
 *
 * Sixteen sections that used to be scattered through one long screen, grouped
 * into three: what colour it is, how it reads, and how it is spaced. The
 * controls are the ones that were already here — this moved them and did not
 * rewrite any of them.
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
          <SettingsGroup
            header="Colour"
            footer="The accent being a metal rather than a colour is most of why the app looks drawn instead of like a dashboard."
            lit={lights('accent ground colour color dark light theme mode parchment fog ink paper device', lit)}
          >
            <CustomRow>
              <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>The accent</SectionLabel>
              <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.65, marginBottom: 10, textWrap: 'pretty' }}>
                All metals and stones. The accent being a metal rather than a colour is most of why the
                app looks drawn instead of like a dashboard, so these change the shade and not that.
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
                        fontSize: 'calc(12px * var(--text-scale, 1))',
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
                  <span style={{ display: 'block', fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.55, marginTop: 2 }}>
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
                        <span style={{ display: 'block', fontSize: 'calc(14px * var(--text-scale, 1))' }}>{g.label}</span>
                        <span style={{ display: 'block', fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 2 }}>
                          {g.blurb}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {groundOf(resolveGround(state.ground, prefersDark)).light && (
                <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 8, lineHeight: 1.45 }}>
                  On a light ground the brushed-metal type inverts to a dark sweep, so display headings
                  keep their lustre instead of disappearing.
                </div>
              )}
            </CustomRow>
          </SettingsGroup>

          <SettingsGroup
            header="Type"
            footer="Text size and line spacing move everything on every screen, including the tab bar. Nothing here is fixed in pixels."
            lit={lights('font fonts typeface heading body text size larger bigger smaller line height spacing reading width', lit)}
          >
            <CustomRow>
              <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>Headings</SectionLabel>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
                        fontSize: 'calc(13px * var(--text-scale, 1))',
                        fontFamily: t.heading,
                        borderColor: on ? 'var(--app-accent)' : 'var(--app-line)',
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 6, lineHeight: 1.45 }}>
                {TYPEFACES.find((t) => t.id === state.typeface)?.blurb}
              </div>
            </CustomRow>
            <CustomRow>
              <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>Body text</SectionLabel>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
                        fontSize: 'calc(13px * var(--text-scale, 1))',
                        fontFamily: b.body,
                        borderColor: on ? 'var(--app-accent)' : 'var(--app-line)',
                      }}
                    >
                      {b.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 6, lineHeight: 1.45 }}>
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
              <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 6, lineHeight: 1.45 }}>
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
              <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 6, lineHeight: 1.45 }}>
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
              <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 6, lineHeight: 1.45 }}>
                Scales the text. Buttons and the tab bar keep their size on purpose — a tap target that
                grew with the type would push the bar off the bottom of a phone.
              </div>

              {/* The one setting that changes an arithmetic rather than a look. */}
            </CustomRow>
          </SettingsGroup>

          <SettingsGroup
            header="Layout"
            footer="The drawn layout is the app as it is. Grouped arranges every screen the way a phone's own settings do. Nothing is hidden either way."
            lit={lights('layout shell grouped drawn inset list rows panel arrangement', lit)}
          >
            <CustomRow>
              <ShellPicker />
            </CustomRow>
          </SettingsGroup>

          <SettingsGroup
            header="Shape and spacing"
            footer="How much fits on a screen, and how hard the edges are."
            lit={lights('corners rounded square spacing density icon shape badges tab bar labels feed style', lit)}
          >
            <CustomRow>
              <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>Corners</SectionLabel>
              <Segmented
                options={CORNERS.map((c) => ({ id: c.id, label: c.label }))}
                value={state.corners}
                onChange={(corners) => dispatch({ type: 'setLook', look: { corners } })}
              />
            </CustomRow>
            <CustomRow>
              <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>Spacing</SectionLabel>
              <Segmented
                options={DENSITIES.map((d) => ({ id: d.id, label: d.label }))}
                value={state.density}
                onChange={(density) => dispatch({ type: 'setLook', look: { density } })}
              />
              <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 6, lineHeight: 1.45 }}>
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
            <CustomRow>
              <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>Tab bar</SectionLabel>
              <Segmented
                options={LABELS.map((l) => ({ id: l.id, label: l.label }))}
                value={state.labels}
                onChange={(labels) => dispatch({ type: 'setLook', look: { labels } })}
              />
              <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 6, lineHeight: 1.45 }}>
                {LABELS.find((l) => l.id === state.labels)?.blurb} The names stay for a screen reader
                either way.
              </div>
            </CustomRow>
            <CustomRow>
              <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>Badges</SectionLabel>
              <Segmented
                options={BADGES.map((b) => ({ id: b.id, label: b.label }))}
                value={state.badges}
                onChange={(badges) => dispatch({ type: 'setLook', look: { badges } })}
              />
              <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 6, lineHeight: 1.45 }}>
                {BADGES.find((b) => b.id === state.badges)?.blurb} A number is a claim on your attention,
                and an app that puts one on everything has made them all mean nothing.
              </div>

              <HuePicker />
            </CustomRow>
            <CustomRow>
              <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>Today’s feed</SectionLabel>
              <Segmented
                options={FEEDS.map((f) => ({ id: f.id, label: f.label }))}
                value={state.feed}
                onChange={(feed) => dispatch({ type: 'setLook', look: { feed } })}
              />
              <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 6, lineHeight: 1.45 }}>
                {FEEDS.find((f) => f.id === state.feed)?.blurb}
              </div>
            </CustomRow>
          </SettingsGroup>
        </>
      )}
    </SettingsPage>
  );
}
