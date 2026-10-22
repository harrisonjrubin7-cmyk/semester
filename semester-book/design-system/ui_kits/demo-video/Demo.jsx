const { CompositionStage, useComposition, Captions, Easing, animate, clamp } = window;
const MOTION = {
  enter: (s, e) => animate({ from: 0, to: 1, start: s, end: e, ease: Easing.easeOutCubic }),
  draw: (s, e) => animate({ from: 0, to: 1, start: s, end: e, ease: Easing.easeInOutCubic }),
  pop: (s, e) => animate({ from: 0, to: 1, start: s, end: e, ease: Easing.easeOutBack }),
};
const INK = '#090a0e', PAPER = '#f4f1ea', FG = '#eceef2', BLUE = '#416180', SRC = { official: ['◆ Official', '#2c455d', 'rgba(44,69,93,.08)'], connected: ['⇄ Connected', '#2d5c61', 'transparent'], yours: ['○ Yours', '#4a4b4f', 'transparent'], ai: ['✦ AI-assisted', '#544a7f', 'rgba(84,74,127,.08)'] };
const Chip = ({ k, style }) => <span style={{ display: 'inline-flex', gap: 6, padding: '3px 10px', fontSize: 15, color: SRC[k][1], border: '1px solid ' + SRC[k][1] + '88', background: SRC[k][2], borderRadius: 3, ...style }}>{SRC[k][0]}</span>;
const TILES = ['LMS', 'Student portal', 'Registrar', 'Bursar', 'Degree audit', 'Email', 'Calendar', 'Housing', 'Dining', 'Advising', 'Career', 'Chatbot'];
function Problem({ T, C }) {
  const gather = MOTION.draw(C.Today - 0.2, C.Today + 1.2)(T);
  const fade = 1 - MOTION.enter(C.Today + 0.8, C.Today + 1.4)(T);
  return <div style={{ position: 'absolute', inset: 0, opacity: fade }}>{TILES.map((t, i) => {
    const a = MOTION.pop(0.15 + i * 0.18, 0.75 + i * 0.18)(T);
    const x = 160 + (i % 4) * 400 + Math.sin(i * 2.3 + T * 0.6) * 18, y = 170 + Math.floor(i / 4) * 250 + Math.cos(i * 1.7 + T * 0.5) * 14;
    const tx = x + (960 - 120 - x) * gather, ty = y + (540 - 40 - y) * gather;
    return <div key={t} style={{ position: 'absolute', left: tx, top: ty, width: 240, padding: '18px 22px', border: '1px solid rgba(236,238,242,.18)', background: '#12141a', color: FG, borderRadius: 6, fontSize: 24, fontFamily: 'var(--font-heading)', fontWeight: 600, opacity: a, transform: 'scale(' + (0.6 + 0.4 * a) * (1 - 0.6 * gather) + ') rotate(' + ((i % 3) - 1) * 3 * (1 - gather) + 'deg)' }}>{t}<div style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 15, color: 'rgba(236,238,242,.5)', marginTop: 6 }}>{['3 new', 'Hold', 'Due Thu', '$1,240', '26 cr left', '14 unread', 'Clash', 'Ticket', '9 swipes', 'Book?', 'Apply', '??'][i]}</div></div>;
  })}</div>;
}
function Screen({ T, C, children }) {
  const inA = MOTION.enter(C.Today + 0.6, C.Today + 1.6)(T), out = MOTION.enter(C.Close - 0.3, C.Close + 0.3)(T);
  const zoom = 1 + 0.06 * clamp((T - C.Today) / (C.Close - C.Today), 0, 1);
  return <div style={{ position: 'absolute', left: 150, top: 50, width: 1620, height: 880, borderRadius: 12, overflow: 'hidden', background: PAPER, boxShadow: '0 30px 80px rgba(0,0,0,.5)', opacity: inA * (1 - out), transform: 'translateY(' + (40 * (1 - inA)) + 'px) scale(' + zoom * (1 - 0.08 * out) + ')', transformOrigin: '50% 40%', display: 'grid', gridTemplateColumns: '260px 1fr' }}>
    <div style={{ background: INK, padding: 28, display: 'grid', alignContent: 'start', gap: 16 }}><div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, letterSpacing: '.22em', color: '#d4d9e2', fontSize: 20, marginBottom: 18 }}>SEMESTER</div>{['Today', 'Plan', 'Learn', 'Help', 'Campus', 'Progress', 'You'].map((n, i) => <div key={n} style={{ fontSize: 19, color: i === 0 ? FG : 'rgba(236,238,242,.55)', padding: '8px 12px', borderRadius: 6, background: i === 0 ? 'rgba(148,188,227,.14)' : 'none' }}>{n}</div>)}</div>
    <div style={{ position: 'relative', padding: '40px 56px', color: '#1b1a17', fontFamily: 'var(--font-body)' }}>{children}</div>
  </div>;
}
function Today({ T, C }) {
  const vis = 1 - MOTION.enter(C.Ask - 0.2, C.Ask + 0.5)(T);
  const card = MOTION.enter(C.Today + 1.6, C.Today + 2.4)(T);
  const rows = [['09:00', 'BIO 210 · Lecture', 'official'], ['11:30', 'Study block · Lab report', 'yours'], ['16:00', 'Rowing practice', 'connected']];
  return <div style={{ position: 'absolute', inset: '40px 56px', opacity: vis }}>
    <div style={{ fontSize: 16, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(27,26,23,.6)' }}>Today</div>
    <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 48, margin: '8px 0 28px' }}>Tuesday, 7 October</div>
    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 36 }}>
      <div><div style={{ border: '1px solid rgba(122,83,16,.5)', borderRadius: 8, padding: 28, background: '#fbf9f4', opacity: card, transform: 'translateY(' + 24 * (1 - card) + 'px)' }}><div style={{ fontSize: 15, letterSpacing: '.08em', textTransform: 'uppercase', color: '#7a5310' }}>! Begin today · Action required</div><div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 36, margin: '10px 0' }}>Clear immunization hold</div><Chip k="official" style={{ opacity: MOTION.pop(C.Today + 2.6, C.Today + 3.1)(T) }} /><div style={{ fontSize: 20, color: 'rgba(27,26,23,.7)', marginTop: 14 }}>Blocks spring registration on Oct 14.</div><div style={{ display: 'inline-block', marginTop: 20, padding: '12px 22px', background: BLUE, color: '#fff', borderRadius: 3, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 20 }}>Upload record</div></div></div>
      <div>{rows.map(([t, n, s], i) => { const a = MOTION.enter(C.Today + 3 + i * 0.5, C.Today + 3.6 + i * 0.5)(T); return <div key={n} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12, padding: '16px 0', borderBottom: '1px solid rgba(27,26,23,.1)', opacity: a, transform: 'translateX(' + 20 * (1 - a) + 'px)' }}><span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 22 }}>{t}</span><div><div style={{ fontSize: 20 }}>{n}</div><Chip k={s} style={{ marginTop: 6 }} /></div></div>; })}</div>
    </div></div>;
}
function Ask({ T, C }) {
  const vis = MOTION.enter(C.Ask + 0.2, C.Ask + 0.8)(T) * (1 - MOTION.enter(C.Consent - 0.2, C.Consent + 0.5)(T));
  const q = 'Can I finish the lab report without missing rowing?';
  const typed = q.slice(0, Math.floor(q.length * MOTION.draw(C.Ask + 0.8, C.Ask + 2.4)(T)));
  const ans = MOTION.enter(C.Ask + 3, C.Ask + 3.8)(T), cite = MOTION.pop(C.Ask + 4.2, C.Ask + 4.7)(T);
  return <div style={{ position: 'absolute', inset: '40px 56px', opacity: vis }}>
    <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 44, marginBottom: 28 }}>Ask Semester</div>
    <div style={{ marginLeft: 'auto', width: 'fit-content', maxWidth: 900, padding: '18px 24px', background: '#f1ede4', borderRadius: 10, fontSize: 24 }}>{typed}<span style={{ opacity: typed.length < q.length ? 1 : 0 }}>▍</span></div>
    <div style={{ marginTop: 28, border: '1px solid rgba(84,74,127,.45)', borderRadius: 8, padding: 28, background: '#fff', opacity: ans, transform: 'translateY(' + 20 * (1 - ans) + 'px)', maxWidth: 1150 }}>
      <Chip k="ai" /><div style={{ fontSize: 24, lineHeight: 1.55, marginTop: 16 }}>Yes. About 3 hours remain <b style={{ opacity: cite, fontSize: 16, border: '1px solid #ccc', padding: '0 5px' }}>1</b>. Use today 11:30–13:00 and Wednesday evening — both clear of practice <b style={{ opacity: cite, fontSize: 16, border: '1px solid #ccc', padding: '0 5px' }}>2</b>.</div>
      <div style={{ display: 'flex', gap: 24, marginTop: 18, fontSize: 17, color: 'rgba(27,26,23,.65)', opacity: cite }}><span>1 · BIO 210 syllabus <Chip k="official" /></span><span>2 · Your calendar <Chip k="yours" /></span></div>
    </div></div>;
}
function Consent({ T, C }) {
  const vis = MOTION.enter(C.Consent + 0.2, C.Consent + 0.8)(T) * 1;
  const on = MOTION.draw(C.Consent + 1.6, C.Consent + 2.1)(T), log = MOTION.enter(C.Consent + 2.6, C.Consent + 3.2)(T);
  return <div style={{ position: 'absolute', inset: '40px 56px', opacity: vis }}>
    <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 44, marginBottom: 8 }}>What Jonas can see</div>
    <div style={{ fontSize: 22, color: 'rgba(27,26,23,.65)', marginBottom: 28 }}>Nothing by default. You decide, and you can stop any time.</div>
    {[['Final grades', 1], ['Billing milestones', on], ['Class schedule', 0]].map(([l, v]) => <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 900, padding: '20px 24px', border: '1px solid rgba(27,26,23,.16)', borderRadius: 6, marginBottom: 12, background: '#fbf9f4' }}><span style={{ fontSize: 24 }}>{l}</span><span style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 18 }}>{v > 0.5 ? 'On' : 'Off'}<span style={{ width: 56, height: 30, borderRadius: 15, background: v > 0.5 ? BLUE : '#e8e4dc', border: '1px solid rgba(27,26,23,.3)', position: 'relative' }}><span style={{ position: 'absolute', top: 3, left: 3 + 26 * v, width: 22, height: 22, borderRadius: '50%', background: v > 0.5 ? '#fff' : '#888' }}></span></span></span></div>)}
    <div style={{ marginTop: 18, fontSize: 19, color: '#3e6141', opacity: log }}>✓ Shared Billing milestones with Jonas · logged in your access history</div>
  </div>;
}
function Close({ T, C }) {
  const a = MOTION.enter(C.Close + 0.4, C.Close + 1.4)(T), b = MOTION.enter(C.Close + 1.6, C.Close + 2.6)(T);
  const end = 1 - MOTION.enter(C.Close + 5.4, C.Close + 6)(T);
  return <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', opacity: end }}><div style={{ textAlign: 'center' }}><div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, letterSpacing: '.22em', color: '#d4d9e2', fontSize: 34, opacity: a, transform: 'translateY(' + 16 * (1 - a) + 'px)' }}>SEMESTER</div><div style={{ fontFamily: 'var(--font-display)', fontSize: 92, color: FG, marginTop: 28, opacity: b, transform: 'scale(' + (0.96 + 0.04 * b + 0.01 * (T - C.Close)) + ')' }}>One clear next step.</div><div style={{ fontSize: 26, color: 'rgba(236,238,242,.6)', marginTop: 24, opacity: b }}>Now in a paid pilot at Vanderbilt University</div></div></div>;
}
function Piece() {
  const { T, CUES: C } = useComposition();
  React.useEffect(() => { const r = document.querySelector('[data-om-exportable-video-with-duration-secs]'); if (r) r.setAttribute('data-screen-label', 't=' + Math.floor(T) + 's'); });
  return <div style={{ position: 'absolute', inset: 0, background: INK, overflow: 'hidden', fontFamily: 'var(--font-body)' }}>
    <Problem T={T} C={C} />
    <Screen T={T} C={C}><Today T={T} C={C} /><Ask T={T} C={C} /><Consent T={T} C={C} /></Screen>
    <Close T={T} C={C} />
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 44, textAlign: 'center' }}><Captions items={[{ at: 0.4, until: C.Today - 0.2, text: 'A semester lives in a dozen systems.' }, { at: C.Today + 1.2, until: C.Ask, text: 'Semester turns it into one clear next step — with the source beside every fact.' }, { at: C.Ask + 0.6, until: C.Consent, text: 'Ask, and get an answer that shows its sources.' }, { at: C.Consent + 0.6, until: C.Close, text: 'You decide what your family and advisors see.' }]} /></div>
  </div>;
}
function App() {
  const [t, setT] = window.useTweaks(window.TWEAK_DEFAULTS);
  return <><CompositionStage width={1920} height={1080} scenes={window.OM_SCENES} playback={window.OM_PLAYBACK} bg="#040507"><Piece /></CompositionStage><window.TweaksPanel><window.TweakToggle label="Motion editor" value={t.motionEditor} onChange={(v) => setT('motionEditor', v)} /></window.TweaksPanel></>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
