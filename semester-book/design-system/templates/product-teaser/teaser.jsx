const { useComposition, CompositionStage, animate, Easing, clamp, useTweaks, TweaksPanel, TweakSection, TweakToggle } = window;

const MOTION = {
  enter: (T, s, d = 0.7) => animate({ from: 0, to: 1, start: s, end: s + d, ease: Easing.easeOutCubic })(T),
  draw: (T, s, d = 1.2) => animate({ from: 0, to: 1, start: s, end: s + d, ease: Easing.easeInOutCubic })(T),
  pop: (T, s, d = 0.5) => animate({ from: 0, to: 1, start: s, end: s + d, ease: Easing.easeOutBack })(T),
};
const mix = (a, b, p) => a + (b - a) * p;

const C = {
  ink: '#090a0e', panel: '#12141a', hero: '#191c23', fg: '#eceef2', dim: 'rgba(236,238,242,.64)',
  parch: '#fbf9f4', pfg: '#1b1a17', psub: 'rgba(27,26,23,.68)', line: 'rgba(27,26,23,.12)',
  blue: '#94bce3', sterling: '#d4d9e2',
  official: ['#2c455d', '#eef6ff'], personal: ['#4a4b4f', '#efefef'], est: ['#7a5310', '#f8efd9'], ai: ['#544a7f', '#efeaf9'],
};
const HEAD = "'Barlow Condensed', system-ui, sans-serif";
const BODY = "'Barlow', system-ui, sans-serif";
const DISPLAY = "'Cinzel', Georgia, serif";

const SITES = [
  { name: 'Course site', x: 260, y: 230, r: -4, n: 7 },
  { name: 'Registrar', x: 1180, y: 170, r: 3, n: 2 },
  { name: 'Student email', x: 620, y: 520, r: 2, n: 23 },
  { name: 'Calendar', x: 1340, y: 600, r: -3, n: 4 },
  { name: 'Campus portal', x: 140, y: 690, r: 5, n: 11 },
];

function Headline({ T, CUES, show }) {
  const lines = [
    { at: CUES.Chaos + 1.4, until: CUES.Merge + 0.2, text: 'Five sites to find out what’s due.' },
    { at: CUES.Merge + 1.6, until: CUES.Today + 0.2, text: 'Or one.' },
    { at: CUES.Today + 0.8, until: CUES.Trust + 0.2, text: 'Every item says where it came from.' },
    { at: CUES.Trust + 0.8, until: CUES.Close + 0.1, text: 'AI reads your records only when your school turns it on.' },
  ];
  const cur = lines.find(l => T >= l.at && T < l.until);
  if (!cur || !show) return null;
  const a = MOTION.enter(T, cur.at, 0.6) * (1 - MOTION.enter(T, cur.until - 0.4, 0.4));
  return (
    <div style={{ position: 'absolute', left: 120, right: 120, bottom: 72, fontFamily: HEAD, fontWeight: 600, fontSize: 64, letterSpacing: '-0.01em', color: C.fg, opacity: a, transform: `translateY(${(1 - a) * 18}px)` }}>{cur.text}</div>
  );
}

function SiteWindow({ s, i, T, CUES }) {
  const e = MOTION.pop(T, CUES.Chaos + 0.25 + i * 0.35, 0.6);
  const m = MOTION.draw(T, CUES.Merge + 0.1 + i * 0.06, 1.3);
  const drift = Math.sin(T * 0.7 + i) * 6;
  const x = mix(s.x + drift, 960 - 210, m), y = mix(s.y - drift, 540 - 150, m);
  const sc = mix(0.85 + e * 0.15, 0.4, m);
  const badge = Math.min(s.n, Math.floor(clamp((T - CUES.Chaos - 1 - i * 0.3) * 4, 0, 99)));
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 420, height: 300, transform: `translate(${x}px,${y}px) rotate(${mix(s.r, 0, m)}deg) scale(${sc})`, opacity: e * (1 - m), background: C.hero, border: '1px solid rgba(236,238,242,.14)', borderRadius: 8, boxShadow: '0 30px 60px rgba(0,0,0,.5)', overflow: 'hidden' }}>
      <div style={{ height: 44, background: C.panel, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px' }}>
        {[0, 1, 2].map(k => <span key={k} style={{ width: 10, height: 10, borderRadius: 5, background: 'rgba(236,238,242,.2)' }}></span>)}
        <span style={{ marginLeft: 10, fontFamily: BODY, fontSize: 20, color: C.dim, flex: 1 }}>{s.name}</span>
        {badge > 0 && <span style={{ minWidth: 30, height: 30, borderRadius: 15, background: '#a3301f', color: '#fff', fontFamily: BODY, fontWeight: 600, fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px' }}>{badge}</span>}
      </div>
      <div style={{ padding: 22, display: 'grid', gap: 14 }}>
        {[0.9, 0.6, 0.75, 0.5].map((w, k) => <div key={k} style={{ height: 16, width: `${w * 100}%`, borderRadius: 3, background: 'rgba(236,238,242,.1)' }}></div>)}
      </div>
    </div>
  );
}

const ROWS = [
  { t: 'Problem set 4', m: 'Due tonight, 11:59 pm', src: 'Institution verified', c: C.official },
  { t: 'Lab moved to Room 214', m: 'Changed since yesterday', src: 'Institution verified', c: C.official },
  { t: 'Read chapter 7', m: 'About 40 minutes', src: 'Estimated', c: C.est },
  { t: 'Study group', m: '4:00 pm, library', src: 'Yours', c: C.personal },
];

function TodayCard({ T, CUES }) {
  const a = MOTION.pop(T, CUES.Merge + 1.0, 0.8);
  const zoom = mix(1, 1.08, MOTION.draw(T, CUES.Today, 8.5));
  const side = MOTION.draw(T, CUES.Trust, 1.2);
  const out = MOTION.enter(T, CUES.Close, 0.6);
  const x = mix(960, 660, side), sc = mix(0.6 + 0.4 * a, 1, 0) * mix(zoom, 0.88, side);
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1000, height: 700, transform: `translate(${x - 500}px,${500 - 350 - 40 * side}px) scale(${sc})`, opacity: a * (1 - out), background: C.parch, borderRadius: 10, boxShadow: '0 40px 90px rgba(0,0,0,.55)', overflow: 'hidden', color: C.pfg }}>
      <div style={{ height: 56, background: C.ink, display: 'flex', alignItems: 'center', padding: '0 28px', fontFamily: DISPLAY, fontSize: 22, letterSpacing: '.3em', color: C.sterling }}>SEMESTER</div>
      <div style={{ padding: '30px 40px 0' }}>
        <div style={{ fontFamily: BODY, fontSize: 18, letterSpacing: '.08em', textTransform: 'uppercase', color: C.psub }}>Tuesday</div>
        <div style={{ fontFamily: HEAD, fontWeight: 600, fontSize: 52, letterSpacing: '-.015em', marginTop: 2 }}>Today</div>
      </div>
      <div style={{ padding: '18px 40px', display: 'grid' }}>
        {ROWS.map((r, i) => {
          const e = MOTION.enter(T, CUES.Merge + 2.2 + i * 0.45, 0.6);
          const hl = i === 0 ? MOTION.enter(T, CUES.Today + 1.2, 0.5) * (1 - MOTION.enter(T, CUES.Today + 4.5, 0.5)) : 0;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '18px 0', borderTop: `1px solid ${C.line}`, opacity: e, transform: `translateX(${(1 - e) * 30}px)` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 28 }}>{r.t}</div>
                <div style={{ fontFamily: BODY, fontSize: 21, color: C.psub, marginTop: 2 }}>{r.m}</div>
              </div>
              <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: 18, color: r.c[0], background: r.c[1], border: `1px solid ${r.c[0]}`, borderRadius: 4, padding: '6px 12px', transform: `scale(${1 + hl * 0.12})`, boxShadow: hl ? `0 0 0 ${hl * 6}px rgba(148,188,227,.45)` : 'none' }}>{r.src}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const SWITCHES = [
  { l: 'Courses and due dates', on: true, at: 2.6 },
  { l: 'Grades', on: false },
  { l: 'Accommodations', on: false },
];

function TrustPanel({ T, CUES }) {
  const a = MOTION.enter(T, CUES.Trust + 0.6, 0.8);
  const out = MOTION.enter(T, CUES.Close, 0.6);
  return (
    <div style={{ position: 'absolute', left: 1220, top: 220, width: 560, opacity: a * (1 - out), transform: `translateX(${(1 - a) * 40}px)`, display: 'grid', gap: 18 }}>
      <div style={{ fontFamily: BODY, fontSize: 20, letterSpacing: '.08em', textTransform: 'uppercase', color: C.blue }}>School settings · AI access</div>
      {SWITCHES.map((s, i) => {
        const flip = s.on ? MOTION.draw(T, CUES.Trust + s.at, 0.4) : 0;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', background: C.hero, border: '1px solid rgba(236,238,242,.14)', borderRadius: 8 }}>
            <span style={{ fontFamily: BODY, fontSize: 26, color: C.fg }}>{s.l}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontFamily: BODY, fontSize: 20, color: C.dim, width: 34 }}>{flip > 0.5 ? 'On' : 'Off'}</span>
              <span style={{ width: 64, height: 36, borderRadius: 18, background: flip > 0.5 ? '#749dc4' : 'rgba(236,238,242,.18)', position: 'relative' }}>
                <span style={{ position: 'absolute', top: 4, left: 4 + 28 * flip, width: 28, height: 28, borderRadius: 14, background: C.fg }}></span>
              </span>
            </span>
          </div>
        );
      })}
      <div style={{ fontFamily: BODY, fontSize: 22, color: C.dim, marginTop: 6, opacity: MOTION.enter(T, CUES.Trust + 3.4, 0.6) }}>Stored in the United States only.</div>
    </div>
  );
}

function Wordmark({ T, CUES, authoredTotal }) {
  const a = MOTION.enter(T, CUES.Close + 0.5, 1.0);
  const out = MOTION.enter(T, authoredTotal - 0.6, 0.5);
  const track = mix(0.18, 0.34, MOTION.draw(T, CUES.Close + 0.5, 3));
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, opacity: a * (1 - out) }}>
      <div style={{ fontFamily: DISPLAY, fontSize: 132, letterSpacing: `${track}em`, marginRight: `-${track}em`, color: '#f6f8fb' }}>SEMESTER</div>
      <div style={{ fontFamily: HEAD, fontWeight: 600, fontSize: 44, color: C.blue, opacity: MOTION.enter(T, CUES.Close + 1.3, 0.6) }}>semester.app</div>
    </div>
  );
}

function Piece({ captions }) {
  const { T, CUES, authoredTotal } = useComposition();
  return (
    <div data-screen-label={`Teaser t=${Math.floor(T)}s`} style={{ position: 'absolute', inset: 0, background: C.ink, overflow: 'hidden' }}>
      {SITES.map((s, i) => <SiteWindow key={i} s={s} i={i} T={T} CUES={CUES} />)}
      <TodayCard T={T} CUES={CUES} />
      <TrustPanel T={T} CUES={CUES} />
      <Wordmark T={T} CUES={CUES} authoredTotal={authoredTotal} />
      <Headline T={T} CUES={CUES} show={captions} />
    </div>
  );
}

function Teaser() {
  const [t, setTweak] = useTweaks(window.TWEAK_DEFAULTS);
  return (
    <React.Fragment>
      <CompositionStage width={1920} height={1080} scenes={window.OM_SCENES} playback={window.OM_PLAYBACK} bg="#090a0e">
        <Piece captions={t.captions} />
      </CompositionStage>
      <TweaksPanel>
        <TweakSection label="Teaser" />
        <TweakToggle label="Motion editor" value={t.motionEditor} onChange={v => setTweak('motionEditor', v)} />
        <TweakToggle label="Headlines" value={t.captions} onChange={v => setTweak('captions', v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}
window.Teaser = Teaser;
