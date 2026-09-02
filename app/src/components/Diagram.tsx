import type { DiagramKind } from '../lib/types';

/**
 * The figures that have to be drawn rather than tabulated.
 *
 * Each is hand-built inline SVG on a 320×200 canvas, using the app's own tokens
 * so they sit inside the stealth-chrome treatment rather than beside it. They
 * are the pictures the guides tell you to be able to sketch from memory, so the
 * priority is legibility at phone size: few labels, thick enough strokes, and
 * the one thing the figure is actually about picked out in the accent.
 */

const W = 320;
const H = 200;

const ink = 'var(--app-fg)';
const line = 'var(--app-line)';
const accent = 'var(--app-accent)';
const dim = 'var(--app-accent-deep)';

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      style={{ display: 'block', overflow: 'visible' }}
    >
      {children}
    </svg>
  );
}

/** Standard axes with quantity across and price/cost up. */
function Axes({ x = 'Quantity', y = 'Price' }: { x?: string; y?: string }) {
  return (
    <>
      <path d="M40 12 L40 168 L306 168" stroke={line} strokeWidth={1} fill="none" />
      <text x={306} y={184} fill={dim} fontSize={9} textAnchor="end" letterSpacing="0.1em">
        {x.toUpperCase()}
      </text>
      <text
        x={34}
        y={16}
        fill={dim}
        fontSize={9}
        textAnchor="end"
        letterSpacing="0.1em"
        transform="rotate(-90 34 16)"
      >
        {y.toUpperCase()}
      </text>
    </>
  );
}

const label = {
  fontSize: 10,
  fontFamily: 'var(--font-heading)',
  letterSpacing: '0.06em',
} as const;

function SupplyDemand() {
  return (
    <Frame>
      <Axes />
      {/* demand: down-sloping, supply: up-sloping, crossing at (170, 92) */}
      <path d="M60 30 L285 150" stroke={ink} strokeWidth={1.6} fill="none" />
      <path d="M60 150 L285 30" stroke={ink} strokeWidth={1.6} fill="none" />
      <text x={288} y={152} fill={ink} {...label}>D</text>
      <text x={288} y={32} fill={ink} {...label}>S</text>
      <circle cx={172.5} cy={90} r={3.5} fill={accent} />
      <path d="M40 90 L172.5 90 L172.5 168" stroke={accent} strokeWidth={1} strokeDasharray="3 3" fill="none" />
      <text x={30} y={94} fill={accent} textAnchor="end" {...label}>P*</text>
      <text x={172.5} y={182} fill={accent} textAnchor="middle" {...label}>Q*</text>
      <text x={196} y={48} fill={dim} fontSize={9}>above P*: surplus</text>
      <text x={62} y={140} fill={dim} fontSize={9}>below P*: shortage</text>
    </Frame>
  );
}

function PriceCeiling() {
  return (
    <Frame>
      <Axes />
      <path d="M60 30 L285 150" stroke={ink} strokeWidth={1.6} fill="none" />
      <path d="M60 150 L285 30" stroke={ink} strokeWidth={1.6} fill="none" />
      <text x={288} y={152} fill={ink} {...label}>D</text>
      <text x={288} y={32} fill={ink} {...label}>S</text>
      <circle cx={172.5} cy={90} r={3} fill={dim} />
      <text x={30} y={94} fill={dim} textAnchor="end" {...label}>P*</text>
      <path d="M40 90 L172.5 90" stroke={line} strokeWidth={1} strokeDasharray="3 3" fill="none" />
      {/* the binding ceiling, below equilibrium */}
      <path d="M40 126 L300 126" stroke={accent} strokeWidth={1.8} fill="none" />
      <text x={30} y={130} fill={accent} textAnchor="end" {...label}>ceiling</text>
      {/* Qs (on supply) to Qd (on demand) at the ceiling price */}
      <circle cx={105} cy={126} r={3} fill={accent} />
      <circle cx={240} cy={126} r={3} fill={accent} />
      <path d="M105 126 L105 168 M240 126 L240 168" stroke={line} strokeWidth={1} strokeDasharray="3 3" />
      <text x={105} y={182} fill={accent} textAnchor="middle" {...label}>Qs</text>
      <text x={240} y={182} fill={accent} textAnchor="middle" {...label}>Qd</text>
      <path d="M112 118 L233 118" stroke={accent} strokeWidth={1} markerEnd="" />
      <text x={172} y={112} fill={accent} textAnchor="middle" fontSize={9.5}>shortage</text>
    </Frame>
  );
}

function CostCurves() {
  return (
    <Frame>
      <Axes x="Quantity" y="$" />
      {/* MC rising steeply, cutting AVC and ATC at their minima */}
      <path d="M60 150 Q150 140 200 90 T280 24" stroke={accent} strokeWidth={1.8} fill="none" />
      <path d="M60 120 Q140 152 200 132 T285 74" stroke={ink} strokeWidth={1.4} fill="none" />
      <path d="M60 66 Q150 130 210 112 T285 60" stroke={ink} strokeWidth={1.4} fill="none" />
      <text x={283} y={20} fill={accent} {...label}>MC</text>
      <text x={288} y={76} fill={ink} {...label}>AVC</text>
      <text x={288} y={58} fill={ink} {...label}>ATC</text>
      <circle cx={211} cy={113} r={3} fill={accent} />
      <circle cx={196} cy={133} r={3} fill={accent} />
      <text x={150} y={40} fill={dim} fontSize={9}>MC cuts each average</text>
      <text x={150} y={52} fill={dim} fontSize={9}>at its minimum</text>
    </Frame>
  );
}

function Monopoly() {
  return (
    <Frame>
      <Axes />
      {/* demand and MR: same intercept, MR twice the slope */}
      <path d="M55 26 L285 160" stroke={ink} strokeWidth={1.6} fill="none" />
      <path d="M55 26 L170 160" stroke={dim} strokeWidth={1.4} strokeDasharray="5 3" fill="none" />
      <path d="M55 130 L285 106" stroke={ink} strokeWidth={1.4} fill="none" />
      <text x={288} y={162} fill={ink} {...label}>D</text>
      <text x={172} y={172} fill={dim} {...label}>MR</text>
      <text x={288} y={108} fill={ink} {...label}>MC</text>
      {/* Q from MR = MC, price up on demand */}
      <circle cx={128} cy={117} r={3} fill={dim} />
      <path d="M128 117 L128 168" stroke={line} strokeWidth={1} strokeDasharray="3 3" />
      <path d="M128 117 L128 68" stroke={accent} strokeWidth={1.4} />
      <circle cx={128} cy={68} r={3.5} fill={accent} />
      <path d="M40 68 L128 68" stroke={accent} strokeWidth={1} strokeDasharray="3 3" />
      <text x={30} y={72} fill={accent} textAnchor="end" {...label}>P</text>
      <text x={128} y={182} fill={dim} textAnchor="middle" {...label}>Q</text>
      <text x={146} y={62} fill={accent} fontSize={9}>2 · price off demand</text>
      <text x={146} y={124} fill={dim} fontSize={9}>1 · MR = MC</text>
    </Frame>
  );
}

function Externality() {
  return (
    <Frame>
      <Axes x="Quantity" y="$" />
      <path d="M55 34 L290 150" stroke={ink} strokeWidth={1.5} fill="none" />
      <path d="M55 150 L290 44" stroke={ink} strokeWidth={1.5} fill="none" />
      <path d="M55 112 L290 12" stroke={accent} strokeWidth={1.6} fill="none" />
      <text x={292} y={152} fill={ink} {...label}>MPB</text>
      <text x={292} y={46} fill={ink} {...label}>MPC</text>
      <text x={292} y={14} fill={accent} {...label}>MSC</text>
      {/* market quantity where MPB = MPC; optimum where MPB = MSC */}
      <circle cx={175} cy={94} r={3} fill={dim} />
      <circle cx={135} cy={74} r={3.5} fill={accent} />
      <path d="M175 94 L175 168" stroke={line} strokeWidth={1} strokeDasharray="3 3" />
      <path d="M135 74 L135 168" stroke={accent} strokeWidth={1} strokeDasharray="3 3" />
      <text x={175} y={182} fill={dim} textAnchor="middle" {...label}>Q mkt</text>
      <text x={129} y={182} fill={accent} textAnchor="end" {...label}>Q opt</text>
      <path d="M135 74 L175 94 L135 60 Z" fill={accent} opacity={0.28} />
      <text x={196} y={64} fill={accent} fontSize={9}>deadweight loss</text>
    </Frame>
  );
}

function ElasticityAlongDemand() {
  // The line runs from (55,24) to (290,160). Labels sit in the open wedge below
  // it — short enough that none of them cross the curve at phone size.
  return (
    <Frame>
      <Axes />
      <path d="M55 24 L290 160" stroke={ink} strokeWidth={1.8} fill="none" />
      <text x={60} y={74} fill={ink} fontSize={11} fontFamily="var(--font-heading)" letterSpacing="0.1em">
        ELASTIC
      </text>
      <text x={60} y={87} fill={dim} fontSize={9}>upper half</text>
      <circle cx={172.5} cy={92} r={4} fill={accent} />
      <text x={183} y={89} fill={accent} fontSize={9.5} fontFamily="var(--font-heading)" letterSpacing="0.06em">
        UNIT ELASTIC
      </text>
      <text x={183} y={101} fill={dim} fontSize={9}>revenue peaks here</text>
      <text x={196} y={148} fill={ink} fontSize={11} fontFamily="var(--font-heading)" letterSpacing="0.1em">
        INELASTIC
      </text>
      <text x={196} y={161} fill={dim} fontSize={9}>lower half</text>
    </Frame>
  );
}

function NormalCurve() {
  const bell = 'M40 160 C 90 160, 110 30, 168 30 C 226 30, 246 160, 296 160';
  return (
    <Frame>
      <path d={bell} stroke={ink} strokeWidth={1.8} fill="none" />
      <path d="M40 160 L300 160" stroke={line} strokeWidth={1} />
      {[
        { x: 168, l: 'μ' },
        { x: 211, l: '+1' },
        { x: 254, l: '+2' },
        { x: 125, l: '−1' },
        { x: 82, l: '−2' },
      ].map((m) => (
        <g key={m.l}>
          <path d={`M${m.x} 160 L${m.x} 166`} stroke={line} strokeWidth={1} />
          <text x={m.x} y={178} fill={dim} textAnchor="middle" fontSize={9.5}>
            {m.l}
          </text>
        </g>
      ))}
      <path d="M125 148 L211 148" stroke={accent} strokeWidth={1.4} />
      <text x={168} y={143} fill={accent} textAnchor="middle" fontSize={10}>68%</text>
      <path d="M82 128 L254 128" stroke={accent} strokeWidth={1.2} opacity={0.75} />
      <text x={168} y={123} fill={accent} textAnchor="middle" fontSize={10} opacity={0.85}>95%</text>
      <text x={168} y={104} fill={dim} textAnchor="middle" fontSize={9.5}>99.7% within three</text>
    </Frame>
  );
}

function Skew() {
  const curve = 'M40 160 C 80 160, 92 40, 132 40 C 178 40, 196 120, 300 156';
  return (
    <Frame>
      <path d={curve} stroke={ink} strokeWidth={1.8} fill="none" />
      <path d="M40 160 L300 160" stroke={line} strokeWidth={1} />
      {[
        { x: 130, l: 'Mo', d: 'mode' },
        { x: 152, l: 'Md', d: 'median' },
        { x: 178, l: 'Mn', d: 'mean' },
      ].map((m, i) => (
        <g key={m.l}>
          <path d={`M${m.x} 160 L${m.x} ${52 + i * 8}`} stroke={i === 2 ? accent : line} strokeWidth={1} strokeDasharray="3 3" />
          <text x={m.x} y={176} fill={i === 2 ? accent : dim} textAnchor="middle" fontSize={9.5}>
            {m.l}
          </text>
        </g>
      ))}
      <text x={228} y={110} fill={accent} fontSize={9.5}>the tail pulls</text>
      <text x={228} y={122} fill={accent} fontSize={9.5}>the mean right</text>
    </Frame>
  );
}

function ValidityReliability() {
  const targets = [
    { cx: 82, cy: 62, label: 'Valid, reliable', pts: [[0, 0], [5, 4], [-4, 5], [3, -5]], good: true },
    { cx: 238, cy: 62, label: 'Reliable, not valid', pts: [[18, -16], [22, -12], [16, -11], [21, -18]], danger: true },
    { cx: 82, cy: 150, label: 'Valid, not reliable', pts: [[-20, 14], [22, -16], [4, 22], [-16, -18]] },
    { cx: 238, cy: 150, label: 'Neither', pts: [[20, 16], [-24, 8], [10, 24], [26, -6]] },
  ];
  return (
    <Frame>
      {targets.map((t) => (
        <g key={t.label}>
          <circle cx={t.cx} cy={t.cy} r={30} stroke={line} strokeWidth={1} fill="none" />
          <circle cx={t.cx} cy={t.cy} r={16} stroke={line} strokeWidth={1} fill="none" />
          <circle cx={t.cx} cy={t.cy} r={3} stroke={line} strokeWidth={1} fill="none" />
          {t.pts.map((p, i) => (
            <circle
              key={i}
              cx={t.cx + p[0]}
              cy={t.cy + p[1]}
              r={2.6}
              fill={t.danger ? accent : t.good ? accent : dim}
              opacity={t.danger || t.good ? 1 : 0.65}
            />
          ))}
          <text
            x={t.cx}
            y={t.cy + 44}
            fill={t.danger ? accent : dim}
            textAnchor="middle"
            fontSize={9.5}
          >
            {t.label}
          </text>
        </g>
      ))}
    </Frame>
  );
}

function CausalDiagrams() {
  const panels = [
    { x: 6, title: 'Causal', nodes: 'X → Y' },
    { x: 84, title: 'Reverse', nodes: 'X ← Y' },
    { x: 162, title: 'Spurious', nodes: 'Z → both' },
    { x: 240, title: 'Mediated', nodes: 'X → M → Y' },
  ];
  return (
    <Frame>
      {panels.map((p, i) => (
        <g key={p.title}>
          <rect x={p.x} y={22} width={72} height={122} stroke={line} strokeWidth={1} fill="none" />
          <text x={p.x + 36} y={16} fill={i >= 2 ? accent : dim} textAnchor="middle" fontSize={10} fontFamily="var(--font-heading)" letterSpacing="0.08em">
            {p.title.toUpperCase()}
          </text>
          <circle cx={p.x + 20} cy={110} r={11} stroke={ink} strokeWidth={1.2} fill="none" />
          <text x={p.x + 20} y={114} fill={ink} textAnchor="middle" fontSize={10}>X</text>
          <circle cx={p.x + 52} cy={110} r={11} stroke={ink} strokeWidth={1.2} fill="none" />
          <text x={p.x + 52} y={114} fill={ink} textAnchor="middle" fontSize={10}>Y</text>
          {i === 0 && <path d={`M${p.x + 32} 110 L${p.x + 39} 110`} stroke={accent} strokeWidth={1.6} />}
          {i === 1 && <path d={`M${p.x + 39} 110 L${p.x + 32} 110`} stroke={accent} strokeWidth={1.6} />}
          {i === 2 && (
            <>
              <circle cx={p.x + 36} cy={56} r={11} stroke={accent} strokeWidth={1.4} fill="none" />
              <text x={p.x + 36} y={60} fill={accent} textAnchor="middle" fontSize={10}>Z</text>
              <path d={`M${p.x + 30} 66 L${p.x + 23} 99 M${p.x + 42} 66 L${p.x + 49} 99`} stroke={accent} strokeWidth={1.4} />
            </>
          )}
          {i === 3 && (
            <>
              <circle cx={p.x + 36} cy={56} r={11} stroke={accent} strokeWidth={1.4} fill="none" />
              <text x={p.x + 36} y={60} fill={accent} textAnchor="middle" fontSize={10}>M</text>
              <path d={`M${p.x + 25} 100 L${p.x + 31} 67 M${p.x + 42} 66 L${p.x + 48} 99`} stroke={accent} strokeWidth={1.4} />
            </>
          )}
          <text x={p.x + 36} y={136} fill={dim} textAnchor="middle" fontSize={8}>
            {p.nodes}
          </text>
        </g>
      ))}
      <text x={W / 2} y={168} fill={dim} textAnchor="middle" fontSize={9.5}>
        Panel 3 kills the claim. Panel 4 explains it.
      </text>
    </Frame>
  );
}

function ScatterChocolate() {
  const pts = [
    [62, 148], [78, 140], [86, 132], [96, 144], [104, 126], [116, 118],
    [124, 130], [134, 108], [146, 116], [154, 96], [166, 104], [176, 84],
    [188, 92], [198, 72], [210, 80], [222, 62], [234, 70], [246, 48],
    [258, 58], [268, 40], [280, 52], [90, 118], [140, 92],
  ];
  return (
    <Frame>
      <Axes x="Chocolate per capita" y="Nobels" />
      <path d="M56 156 L288 44" stroke={accent} strokeWidth={1.4} strokeDasharray="5 3" fill="none" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={2.8} fill={ink} opacity={0.72} />
      ))}
      <text x={196} y={126} fill={accent} fontSize={10} fontFamily="var(--font-heading)" letterSpacing="0.06em">
        r = 0.79
      </text>
      <text x={196} y={139} fill={dim} fontSize={9}>and not causal</text>
    </Frame>
  );
}

function PerceptualMap() {
  return (
    <Frame>
      <path d="M160 14 L160 176 M28 95 L292 95" stroke={line} strokeWidth={1} />
      <text x={160} y={10} fill={dim} textAnchor="middle" fontSize={9}>PREMIUM</text>
      <text x={160} y={190} fill={dim} textAnchor="middle" fontSize={9}>VALUE</text>
      <text x={24} y={99} fill={dim} textAnchor="end" fontSize={9}>TRADITIONAL</text>
      <text x={296} y={99} fill={dim} fontSize={9}>MODERN</text>
      {[
        { x: 96, y: 52, l: 'A' },
        { x: 120, y: 40, l: 'B' },
        { x: 108, y: 140, l: 'C' },
        { x: 200, y: 150, l: 'D' },
      ].map((b) => (
        <g key={b.l}>
          <circle cx={b.x} cy={b.y} r={9} stroke={ink} strokeWidth={1.2} fill="none" />
          <text x={b.x} y={b.y + 3.5} fill={ink} textAnchor="middle" fontSize={9}>{b.l}</text>
        </g>
      ))}
      <circle cx={232} cy={48} r={22} stroke={accent} strokeWidth={1.4} strokeDasharray="4 3" fill="none" />
      <text x={232} y={51} fill={accent} textAnchor="middle" fontSize={9}>open</text>
      <text x={232} y={82} fill={accent} textAnchor="middle" fontSize={8.5}>opportunity — or nobody wants it</text>
    </Frame>
  );
}

function Funnel() {
  const stages = [
    'Problem recognition',
    'Information search',
    'Evaluation',
    'Purchase',
    'Post-purchase',
  ];
  const levers = ['communication', 'SEO, reviews', 'positioning, price', 'incentives', 'service, loyalty'];
  return (
    <Frame>
      {stages.map((s, i) => {
        const top = 8 + i * 37;
        const inset = i * 22;
        return (
          <g key={s}>
            <path
              d={`M${18 + inset} ${top} L${302 - inset} ${top} L${292 - inset} ${top + 30} L${28 + inset} ${top + 30} Z`}
              stroke={i === 0 ? accent : line}
              strokeWidth={1.2}
              fill="none"
            />
            <text x={160} y={top + 14} fill={ink} textAnchor="middle" fontSize={10} fontFamily="var(--font-heading)" letterSpacing="0.06em">
              {s.toUpperCase()}
            </text>
            <text x={160} y={top + 25} fill={dim} textAnchor="middle" fontSize={8.5}>
              lever: {levers[i]}
            </text>
          </g>
        );
      })}
    </Frame>
  );
}

function BrandPyramid() {
  const levels = [
    { l: 'Resonance', d: 'loyalty, community, advocacy', w: 96 },
    { l: 'Judgments & feelings', d: 'what I think and feel', w: 160 },
    { l: 'Performance & imagery', d: 'what are you', w: 224 },
    { l: 'Salience', d: 'do they know you exist', w: 288 },
  ];
  return (
    <Frame>
      {levels.map((lv, i) => {
        const top = 14 + i * 44;
        return (
          <g key={lv.l}>
            <rect x={(W - lv.w) / 2} y={top} width={lv.w} height={38} stroke={i === 0 ? accent : line} strokeWidth={1.2} fill="none" />
            <text x={160} y={top + 17} fill={i === 0 ? accent : ink} textAnchor="middle" fontSize={10} fontFamily="var(--font-heading)" letterSpacing="0.06em">
              {lv.l.toUpperCase()}
            </text>
            <text x={160} y={top + 29} fill={dim} textAnchor="middle" fontSize={8.5}>{lv.d}</text>
          </g>
        );
      })}
    </Frame>
  );
}

function ChannelLevels() {
  const rows = [
    { n: '0', chain: ['Maker', 'Customer'], note: 'full margin, full control — you fund it' },
    { n: '1', chain: ['Maker', 'Retailer', 'Customer'], note: 'more reach, shared margin' },
    { n: '2', chain: ['Maker', 'Wholesaler', 'Retailer', 'Customer'], note: 'widest reach, thinnest margin' },
  ];
  return (
    <Frame>
      {rows.map((r, i) => {
        const y = 24 + i * 58;
        const boxW = 268 / r.chain.length - 8;
        return (
          <g key={r.n}>
            <text x={12} y={y + 15} fill={accent} fontSize={12} fontFamily="var(--font-heading)">
              {r.n}
            </text>
            {r.chain.map((c, j) => {
              const x = 32 + j * (boxW + 8);
              return (
                <g key={c}>
                  <rect x={x} y={y} width={boxW} height={22} stroke={line} strokeWidth={1} fill="none" />
                  <text x={x + boxW / 2} y={y + 15} fill={ink} textAnchor="middle" fontSize={8.5}>
                    {c}
                  </text>
                  {j < r.chain.length - 1 && (
                    <path d={`M${x + boxW} ${y + 11} L${x + boxW + 8} ${y + 11}`} stroke={dim} strokeWidth={1} />
                  )}
                </g>
              );
            })}
            <text x={32} y={y + 36} fill={dim} fontSize={8.5}>{r.note}</text>
          </g>
        );
      })}
    </Frame>
  );
}

function ProductLifeCycle() {
  return (
    <Frame>
      <path d="M40 160 L300 160" stroke={line} strokeWidth={1} />
      <path
        d="M44 154 C 90 152, 104 60, 150 46 C 196 34, 214 44, 240 46 C 266 48, 280 110, 296 152"
        stroke={accent}
        strokeWidth={1.8}
        fill="none"
      />
      {[
        { x: 74, l: 'Intro', d: 'awareness' },
        { x: 138, l: 'Growth', d: 'distribution' },
        { x: 214, l: 'Maturity', d: 'defend share' },
        { x: 278, l: 'Decline', d: 'harvest' },
      ].map((s) => (
        <g key={s.l}>
          <path d={`M${s.x} 160 L${s.x} 166`} stroke={line} strokeWidth={1} />
          <text x={s.x} y={178} fill={ink} textAnchor="middle" fontSize={9} fontFamily="var(--font-heading)" letterSpacing="0.06em">
            {s.l.toUpperCase()}
          </text>
          <text x={s.x} y={189} fill={dim} textAnchor="middle" fontSize={8}>{s.d}</text>
        </g>
      ))}
      {[104, 176, 250].map((x) => (
        <path key={x} d={`M${x} 26 L${x} 158`} stroke={line} strokeWidth={1} strokeDasharray="3 4" />
      ))}
    </Frame>
  );
}

function ThreeV() {
  const legs = [
    { cx: 160, cy: 52, l: 'Customer', d: 'benefits − price' },
    { cx: 84, cy: 136, l: 'Collaborator', d: 'margin to carry it' },
    { cx: 236, cy: 136, l: 'Company', d: 'profit, share' },
  ];
  return (
    <Frame>
      <path d="M160 52 L84 136 L236 136 Z" stroke={line} strokeWidth={1} fill="none" />
      {legs.map((g) => (
        <g key={g.l}>
          <circle cx={g.cx} cy={g.cy} r={30} stroke={accent} strokeWidth={1.3} fill="none" />
          <text x={g.cx} y={g.cy - 2} fill={ink} textAnchor="middle" fontSize={10} fontFamily="var(--font-heading)" letterSpacing="0.06em">
            {g.l.toUpperCase()}
          </text>
          <text x={g.cx} y={g.cy + 11} fill={dim} textAnchor="middle" fontSize={8}>{g.d}</text>
        </g>
      ))}
      <text x={160} y={186} fill={accent} textAnchor="middle" fontSize={9.5}>
        all three positive, or it collapses
      </text>
    </Frame>
  );
}

const DIAGRAMS: Record<DiagramKind, () => React.JSX.Element> = {
  'supply-demand': SupplyDemand,
  'price-ceiling': PriceCeiling,
  'cost-curves': CostCurves,
  monopoly: Monopoly,
  externality: Externality,
  'elasticity-along-demand': ElasticityAlongDemand,
  'normal-curve': NormalCurve,
  skew: Skew,
  'validity-reliability': ValidityReliability,
  'causal-diagrams': CausalDiagrams,
  'scatter-chocolate': ScatterChocolate,
  'perceptual-map': PerceptualMap,
  funnel: Funnel,
  'brand-pyramid': BrandPyramid,
  'channel-levels': ChannelLevels,
  'product-life-cycle': ProductLifeCycle,
  'three-v': ThreeV,
};

export function Diagram({ kind }: { kind: DiagramKind }) {
  const Drawing = DIAGRAMS[kind];
  if (!Drawing) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <Drawing />
    </div>
  );
}
