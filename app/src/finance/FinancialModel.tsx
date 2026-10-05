import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { FieldMessage, fieldProps } from '../components/FieldMessage';
import { Notice, SectionLabel, Segmented } from '../components/ui';
import { runModel } from './financialModelEngine';
import { FIELDS, GROUPS, hasErrors, validate } from './financialModelFields';
import {
  assumptionsCsv,
  assumptionsPrompt,
  boardSummary,
  monthlyCsv,
  scenarioJson,
  scenarioMarkdown,
  DISCLAIMER,
} from './financialModelExports';
import { basisLabel, formatCount, formatMonths, formatPct, formatPrice, formatRatio, formatUsd } from './financialModelFormat';
import { SCENARIOS, aiCostVsOverage, assumptionsFor, conversionVsCycle, summariseAll, type SensitivityGrid, type SensitivityMetric } from './financialModelScenarios';
import type { Assumptions, AssumptionKey, FieldSpec, ModelResult, ModelWarning, MonthRow, ScenarioId } from './financialModelTypes';

/**
 * The GTM financial model, as an internal planning tool.
 *
 * It runs on local sample data only: nothing here reads a ledger, a bank or a
 * billing system, and nothing is written to browser storage (a console view
 * writes only to the account's own `operator_preference`, and this one saves
 * nothing). Every output is therefore a forecast and says so.
 *
 * Authorisation is not decided here. The Console that mounts this view is
 * reachable only with a `console:operate` grant at platform scope, checked by
 * the database; this component only decides what to show an operator who is
 * already through that gate.
 */

type View = 'dashboard' | 'assumptions' | 'revenue' | 'expenses' | 'cash' | 'funnel' | 'sensitivity' | 'exports';

const VIEWS: readonly { id: View; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'assumptions', label: 'Assumptions' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'cash', label: 'Cash and runway' },
  { id: 'funnel', label: 'Funnel' },
  { id: 'sensitivity', label: 'Sensitivity' },
  { id: 'exports', label: 'Exports' },
];

const stack: CSSProperties = { display: 'grid', gap: 'var(--sp-5)' };
const tileGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))', gap: 'var(--sp-3)' };

export function FinancialModel() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('base');
  const [edits, setEdits] = useState<Partial<Assumptions>>({});
  const [view, setView] = useState<View>('dashboard');
  const [status, setStatus] = useState('');

  const assumptions = useMemo(() => assumptionsFor(scenarioId, edits), [scenarioId, edits]);
  const result = useMemo(() => runModel(assumptions), [assumptions]);
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[1];

  const reset = () => {
    setEdits({});
    setScenarioId('base');
    setStatus('Assumptions reset to Base.');
  };

  return (
    <div style={stack}>
      <Notice>
        <strong>Forecast on planning assumptions.</strong> {DISCLAIMER} Local sample data only: nothing is read from a bank or ledger, and nothing is saved.
      </Notice>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', alignItems: 'end' }}>
        <label style={{ display: 'grid', gap: 'var(--sp-2)', flex: '1 1 16rem' }}>
          Scenario
          <select className="input" value={scenarioId} onChange={(e) => { setScenarioId(e.target.value as ScenarioId); setStatus(''); }}>
            {SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </label>
        <button type="button" className="btn" onClick={reset}>Reset assumptions</button>
      </div>
      <p style={{ marginBlock: 0, color: 'var(--app-dim)' }}>{scenario.description}</p>
      {Object.keys(edits).length > 0 && (
        <p style={{ marginBlock: 0 }}>
          {Object.keys(edits).length} assumption{Object.keys(edits).length === 1 ? '' : 's'} edited on top of {scenario.label}. Edits carry across scenarios until reset.
        </p>
      )}
      {status && <p role="status" style={{ marginBlock: 0 }}>{status}</p>}

      <Warnings warnings={result.warnings} />

      <Segmented options={VIEWS} value={view} onChange={setView} />

      {view === 'dashboard' && <Dashboard result={result} edits={edits} />}
      {view === 'assumptions' && <AssumptionsEditor assumptions={assumptions} edits={edits} onEdit={(k, v) => setEdits((e) => ({ ...e, [k]: v }))} onClear={(k) => setEdits(({ [k]: _drop, ...rest }) => rest)} />}
      {view === 'revenue' && <RevenueTable rows={result.months} />}
      {view === 'expenses' && <ExpenseTable rows={result.months} />}
      {view === 'cash' && <CashTable result={result} />}
      {view === 'funnel' && <FunnelView result={result} />}
      {view === 'sensitivity' && <Sensitivity assumptions={assumptions} />}
      {view === 'exports' && <Exports result={result} scenarioId={scenarioId} edits={edits} onStatus={setStatus} />}
    </div>
  );
}

// ── Warnings ───────────────────────────────────────────────────────────────

function Warnings({ warnings }: { warnings: readonly ModelWarning[] }) {
  if (warnings.length === 0) return <p style={{ marginBlock: 0, color: 'var(--app-dim)' }}>No warnings under the current thresholds.</p>;
  return (
    <div style={{ display: 'grid', gap: 'var(--sp-3)' }} aria-label="Model warnings">
      {warnings.map((w) => (
        <Notice key={w.id} alert={w.severity === 'critical'} style={{ marginBlock: 0, borderColor: w.severity === 'critical' ? 'var(--app-error)' : 'var(--app-line)' }}>
          <strong>{w.severity === 'critical' ? 'Critical' : w.severity === 'warning' ? 'Warning' : 'Note'}: {w.title}.</strong> {w.detail}
        </Notice>
      ))}
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────

function Tile({ label, value, note, basis = 'forecast' }: { label: string; value: string; note?: string; basis?: 'forecast' | 'actual' }) {
  return (
    <div className="portal-panel" style={{ display: 'grid', gap: 'var(--sp-1)' }}>
      <span style={{ color: 'var(--app-dim)', fontSize: 'var(--type-sm)' }}>{label}</span>
      <strong style={{ fontSize: 'var(--type-lg)' }}>{value}</strong>
      <span style={{ color: 'var(--app-dim)', fontSize: 'var(--type-sm)' }}>{basisLabel(basis)}{note ? `. ${note}` : ''}</span>
    </div>
  );
}

function Dashboard({ result, edits }: { result: ModelResult; edits: Partial<Assumptions> }) {
  const last = result.months[result.months.length - 1];
  const u = result.unit;
  const be = result.breakEven;
  return (
    <div style={stack}>
      <div style={tileGrid}>
        <Tile label="ARR, month 36" value={formatUsd(last.arr)} note="recurring only" />
        <Tile label="MRR, month 36" value={formatUsd(last.mrr)} />
        <Tile label="Year-3 core revenue" value={formatUsd(result.years[2].revenueCore)} note="excludes marketplace" />
        <Tile label="Year-3 gross margin" value={formatPct(result.years[2].grossMarginPct)} />
        <Tile label="Break-even" value={be.month === null ? 'None in 36 mo' : `Month ${be.month}`} note={be.month !== null && !be.sustained ? 'not sustained' : 'cumulative gross profit vs costs'} />
        <Tile label="Cash runway" value={result.runwayMonths === null ? '36+ mo' : formatMonths(result.runwayMonths)} note={`lowest cash ${formatUsd(result.lowestCash)}`} />
        <Tile label="Funding needed" value={formatUsd(result.peakFundingNeed)} note="to keep cash at or above zero" />
        <Tile label="Ending cash, month 36" value={formatUsd(last.endingCash)} />
        <Tile label="Revenue per employee, year 3" value={formatUsd(result.years[2].revenuePerEmployee)} />
      </div>

      <SectionLabel>Unit economics</SectionLabel>
      <div style={tileGrid}>
        <Tile label="CAC" value={formatUsd(u.cac)} note="per annual customer, 36 months" />
        <Tile label="CAC payback" value={u.cacPaybackMonths === null ? 'n/a' : formatMonths(u.cacPaybackMonths)} note={u.paybackNote || 'CAC / monthly gross profit'} />
        <Tile label="LTV" value={formatUsd(u.ltv)} note="ARR x gross margin / churn" />
        <Tile label="LTV : CAC" value={formatRatio(u.ltvToCac)} />
        <Tile label="Gross retention" value={formatPct(u.grossRetention)} />
        <Tile label="Net revenue retention" value={formatPct(u.netRevenueRetention)} note={`measured in model ${formatPct(u.measuredNrr)}; the support minimum does not expand`} />
        <Tile label="End-to-end pilot yield" value={formatPct(u.pilotYield)} note="signed pilot to annual" />
        <Tile label="AI cost exposure" value={formatUsd(result.months.reduce((t, m) => t + m.cogsAi, 0))} note="36-month AI cost" />
      </div>

      <SectionLabel>Revenue mix by model year</SectionLabel>
      <MixChart result={result} />
      <SectionLabel>Break-even</SectionLabel>
      <BreakEvenChart rows={result.months} month={be.month} />
      <SectionLabel>Annual summary</SectionLabel>
      <DataTable
        caption="Annual summary. All figures Forecast."
        head={['Model year', 'Basis', 'Core revenue', 'Gross profit', 'Gross margin', 'Operating expense', 'Operating result', 'Ending cash', 'ARR', 'Headcount']}
        rows={result.years.map((y) => [`Year ${y.year}`, basisLabel(y.basis), formatUsd(y.revenueCore), formatUsd(y.grossProfit), formatPct(y.grossMarginPct), formatUsd(y.opexTotal), formatUsd(y.operatingResult), formatUsd(y.endingCash), formatUsd(y.arrEnd), String(y.headcount)])}
      />
      <SectionLabel>All scenarios</SectionLabel>
      <ScenarioTable edits={edits} />
    </div>
  );
}

function ScenarioTable({ edits }: { edits: Partial<Assumptions> }) {
  // Scenarios are patches on Base, so each is re-run on Base plus the founder's edits.
  const rows = useMemo(() => summariseAll(edits), [edits]);
  return (
    <DataTable
      caption="Every scenario on the current edits. All figures Forecast."
      head={['Scenario', 'Month-36 ARR', 'Year-3 revenue', 'Year-3 gross margin', 'Lowest cash', 'Funding needed', 'Break-even', 'Runway', 'Warnings']}
      rows={rows.map((s) => [s.label, formatUsd(s.arrEnd), formatUsd(s.revenueYear3), formatPct(s.grossMarginYear3), formatUsd(s.lowestCash), formatUsd(s.peakFundingNeed), s.breakEvenMonth === null ? 'none' : `month ${s.breakEvenMonth}`, s.runwayMonths === null ? '36+ mo' : `${s.runwayMonths} mo`, s.warnings.filter((w) => w !== 'paid-pilot-gate').join(', ') || 'none'])}
    />
  );
}

// ── Charts ─────────────────────────────────────────────────────────────────

const MIX: { key: keyof ModelResult['years'][0]['mix']; label: string; color: string }[] = [
  { key: 'pilot', label: 'Pilot fees', color: 'var(--chart-1)' },
  { key: 'implementation', label: 'Implementation', color: 'var(--chart-2)' },
  { key: 'platform', label: 'Platform', color: 'var(--chart-3)' },
  { key: 'support', label: 'Premium support', color: 'var(--chart-4)' },
  { key: 'aiOverage', label: 'AI overage', color: 'var(--chart-5)' },
  { key: 'studentPremium', label: 'Student Premium', color: 'var(--chart-muted)' },
];

function MixChart({ result }: { result: ModelResult }) {
  const max = Math.max(1, ...result.years.map((y) => MIX.reduce((t, m) => t + y.mix[m.key], 0)));
  const W = 560;
  const bar = 26;
  const alt = result.years.map((y) => `Year ${y.year}: ${MIX.map((m) => `${m.label} ${formatUsd(y.mix[m.key])}`).join(', ')}`).join('. ');
  return (
    <div style={{ display: 'grid', gap: 'var(--sp-3)' }}>
      <svg role="img" aria-label={`Revenue mix by model year, forecast. ${alt}`} viewBox={`0 0 ${W} ${result.years.length * (bar + 14) + 10}`} style={{ width: '100%', maxWidth: W }}>
        {result.years.map((y, i) => {
          let x = 52;
          return (
            <g key={y.year} transform={`translate(0 ${i * (bar + 14) + 6})`}>
              <text x={0} y={bar * 0.68} fill="var(--chart-label)" fontSize={12}>Year {y.year}</text>
              {MIX.map((m) => {
                const w = (y.mix[m.key] / max) * (W - 64);
                const rect = <rect key={m.key} x={x} y={0} width={Math.max(0, w)} height={bar} fill={m.color} />;
                x += w;
                return rect;
              })}
            </g>
          );
        })}
      </svg>
      <ul style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', listStyle: 'none', padding: 0, margin: 0 }} aria-label="Revenue mix legend">
        {MIX.map((m) => (
          <li key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <span aria-hidden style={{ width: 12, height: 12, background: m.color, display: 'inline-block' }} />
            {m.label}
          </li>
        ))}
      </ul>
      <p style={{ marginBlock: 0, color: 'var(--app-dim)' }}>Marketplace and partner revenue is modelled separately and is not in this chart.</p>
    </div>
  );
}

function BreakEvenChart({ rows, month }: { rows: readonly MonthRow[]; month: number | null }) {
  const W = 560;
  const H = 180;
  const gp = rows.map((r) => r.cumulativeGrossProfit);
  const cost = rows.map((r) => r.cumulativeOpexAndObligations);
  const hi = Math.max(1, ...gp, ...cost);
  const x = (i: number) => 8 + (i / (rows.length - 1)) * (W - 16);
  const y = (v: number) => H - 8 - (Math.max(0, v) / hi) * (H - 20);
  const path = (xs: number[]) => xs.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const summary = month === null ? 'Cumulative gross profit stays below cumulative operating expense and required obligations for all 36 months.' : `Cumulative gross profit first covers cumulative costs in month ${month}.`;
  return (
    <div style={{ display: 'grid', gap: 'var(--sp-3)' }}>
      <svg role="img" aria-label={`Break-even, forecast. ${summary} Cumulative gross profit ends at ${formatUsd(gp[gp.length - 1])}; cumulative costs end at ${formatUsd(cost[cost.length - 1])}.`} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W }}>
        <line x1={8} y1={H - 8} x2={W - 8} y2={H - 8} stroke="var(--chart-axis)" />
        <path d={path(cost)} fill="none" stroke="var(--chart-3)" strokeWidth={2} strokeDasharray="6 4" />
        <path d={path(gp)} fill="none" stroke="var(--chart-1)" strokeWidth={2} />
        {month !== null && <line x1={x(month - 1)} y1={8} x2={x(month - 1)} y2={H - 8} stroke="var(--chart-2)" strokeWidth={1.5} />}
      </svg>
      <p style={{ marginBlock: 0 }}>
        <span aria-hidden style={{ color: 'var(--chart-1)' }}>━</span> Cumulative core gross profit {' '}
        <span aria-hidden style={{ color: 'var(--chart-3)' }}>╌</span> Cumulative operating expense plus required obligations. {summary} Forecast.
      </p>
    </div>
  );
}

// ── Tables ─────────────────────────────────────────────────────────────────

function DataTable({ caption, head, rows }: { caption: string; head: string[]; rows: ReactNode[][] }) {
  return (
    <div role="region" aria-label={caption} tabIndex={0} style={{ overflowX: 'auto', border: '1px solid var(--app-line)', borderRadius: 'var(--r-md)' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 'var(--type-sm)' }}>
        <caption style={{ textAlign: 'start', padding: 'var(--sp-3)', color: 'var(--app-dim)' }}>{caption}</caption>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" style={{ textAlign: 'start', padding: 'var(--sp-2) var(--sp-3)', borderBottom: '1px solid var(--app-line)', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} style={{ padding: 'var(--sp-2) var(--sp-3)', borderBottom: '1px solid var(--app-line)', whiteSpace: 'nowrap' }}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RevenueTable({ rows }: { rows: readonly MonthRow[] }) {
  return (
    <DataTable
      caption="Monthly revenue, recognised. Every row is a Forecast. Marketplace is separate and excluded from core."
      head={['Month', 'Basis', 'Pilot', 'Implementation', 'Platform', 'Support', 'AI overage', 'Student Premium', 'Core revenue', 'Marketplace (separate)', 'MRR', 'ARR']}
      rows={rows.map((r) => [r.label, basisLabel(r.basis), formatUsd(r.revenuePilot), formatUsd(r.revenueImplementation), formatUsd(r.revenuePlatform), formatUsd(r.revenueSupport), formatUsd(r.revenueAiOverage), formatUsd(r.revenueStudentPremium), formatUsd(r.revenueCore), formatUsd(r.revenueMarketplace), formatUsd(r.mrr), formatUsd(r.arr)])}
    />
  );
}

function ExpenseTable({ rows }: { rows: readonly MonthRow[] }) {
  return (
    <DataTable
      caption="Monthly cost of revenue and operating expense. Every row is a Forecast."
      head={['Month', 'Basis', 'Cloud', 'AI', 'Support', 'Implementation', 'Payments', 'Delivery payroll', 'Cost of revenue', 'Gross profit', 'Gross margin', 'Payroll', 'Other operating', 'Operating expense', 'Operating result']}
      rows={rows.map((r) => [r.label, basisLabel(r.basis), formatUsd(r.cogsCloud), formatUsd(r.cogsAi), formatUsd(r.cogsSupport), formatUsd(r.cogsImplementation), formatUsd(r.cogsPayments), formatUsd(r.cogsDeliveryPayroll), formatUsd(r.cogsTotal), formatUsd(r.grossProfit), formatPct(r.grossMarginPct), formatUsd(r.opexPayroll), formatUsd(r.opexTotal - r.opexPayroll), formatUsd(r.opexTotal), formatUsd(r.operatingResult)])}
    />
  );
}

function CashTable({ result }: { result: ModelResult }) {
  return (
    <div style={stack}>
      <DataTable
        caption="Monthly cash and runway. Every row is a Forecast. Collections lag invoices by the payment terms."
        head={['Month', 'Basis', 'Billings', 'Collections', 'Cash out', 'Required obligations', 'Net cash', 'Ending cash', 'Deferred revenue', 'Runway at recent burn']}
        rows={result.months.map((r) => [r.label, basisLabel(r.basis), formatUsd(r.billings), formatUsd(r.collections), formatUsd(r.cashOut), formatUsd(r.obligations), formatUsd(r.netCash), formatUsd(r.endingCash), formatUsd(r.deferredRevenue), r.forwardRunwayMonths === null ? 'not burning' : formatMonths(r.forwardRunwayMonths)])}
      />
      <DataTable
        caption="Delivery capacity. Every row is a Forecast."
        head={['Month', 'Implementation demand (hours)', 'Delivery capacity (hours)', 'Contractor overflow (hours)', 'Basis']}
        rows={result.months.filter((r) => r.implementationDemandHours > 0 || r.deliveryCapacityHours > 0).map((r) => [r.label, formatCount(r.implementationDemandHours), formatCount(r.deliveryCapacityHours), formatCount(r.contractorOverflowHours), basisLabel(r.basis)])}
      />
    </div>
  );
}

function FunnelView({ result }: { result: ModelResult }) {
  return (
    <div style={stack}>
      <Notice style={{ marginBlock: 0 }}>
        Account-based funnel for institutional revenue, attributed to the month each account is contacted. Counts are expected values over 36 months, so they are fractional. Student social channels support activation and proof; they are not a measure of enterprise demand. Forecast.
      </Notice>
      <DataTable
        caption="Funnel conversion, all accounts contacted in 36 months. Forecast."
        head={['Stage', 'Basis', 'Expected count', 'Conversion from previous stage']}
        rows={result.funnel.map((s) => [s.stage, 'Forecast', formatCount(s.count), s.rate === null ? '–' : formatPct(s.rate)])}
      />
      <p style={{ marginBlock: 0 }}>
        Signed within the horizon: {formatCount(result.months.reduce((t, m) => t + m.pilotsSigned + m.directAnnualSigned, 0))}. Annual contracts started within the horizon: {formatCount(result.months.reduce((t, m) => t + m.annualStarts, 0))}. The difference from the cohort funnel above is deals still in the pipeline at month 36. Forecast.
      </p>
    </div>
  );
}

// ── Sensitivity ────────────────────────────────────────────────────────────

const METRIC_LABEL: Record<SensitivityMetric, string> = {
  arrEnd: 'Month-36 ARR',
  endingCash: 'Month-36 cash',
  grossMarginYear3: 'Year-3 gross margin',
  aiNet: 'AI overage revenue less AI cost, 36 months',
};

function Sensitivity({ assumptions }: { assumptions: Assumptions }) {
  const [m1, setM1] = useState<SensitivityMetric>('arrEnd');
  const [m2, setM2] = useState<SensitivityMetric>('aiNet');
  const g1 = useMemo(() => conversionVsCycle(assumptions, m1), [assumptions, m1]);
  const g2 = useMemo(() => aiCostVsOverage(assumptions, m2), [assumptions, m2]);
  return (
    <div style={stack}>
      <Notice style={{ marginBlock: 0 }}>Each cell re-runs the whole model with two inputs changed and the rest as currently set. Forecast, on unvalidated assumptions.</Notice>
      <SectionLabel>Pilot conversion rate vs sales-cycle length</SectionLabel>
      <MetricPick label="Show" value={m1} onChange={setM1} options={['arrEnd', 'endingCash']} />
      <Grid grid={g1} fmtRow={(v) => formatPct(v)} fmtCol={(v) => `${v} mo`} metric={m1} />
      <SectionLabel>AI cost vs AI overage price</SectionLabel>
      <MetricPick label="Show" value={m2} onChange={setM2} options={['aiNet', 'grossMarginYear3']} />
      <Grid grid={g2} fmtRow={(v) => formatPrice(v)} fmtCol={(v) => formatPrice(v)} metric={m2} />
    </div>
  );
}

function MetricPick({ label, value, onChange, options }: { label: string; value: SensitivityMetric; onChange: (m: SensitivityMetric) => void; options: SensitivityMetric[] }) {
  return (
    <label style={{ display: 'grid', gap: 'var(--sp-2)', maxWidth: '24rem' }}>
      {label}
      <select className="input" value={value} onChange={(e) => onChange(e.target.value as SensitivityMetric)}>
        {options.map((o) => (
          <option key={o} value={o}>{METRIC_LABEL[o]}</option>
        ))}
      </select>
    </label>
  );
}

function Grid({ grid, fmtRow, fmtCol, metric }: { grid: SensitivityGrid; fmtRow: (v: number) => string; fmtCol: (v: number) => string; metric: SensitivityMetric }) {
  const fmt = (v: number | null) => (metric === 'grossMarginYear3' ? formatPct(v) : formatUsd(v));
  return (
    <DataTable
      caption={`${METRIC_LABEL[metric]}. Rows: ${grid.rowLabel}. Columns: ${grid.colLabel}. Forecast.`}
      head={[`${grid.rowLabel} / ${grid.colLabel}`, ...grid.cols.map(fmtCol)]}
      rows={grid.rows.map((rv, i) => [fmtRow(rv), ...grid.cells[i].map(fmt)])}
    />
  );
}

// ── Assumptions editor ─────────────────────────────────────────────────────

function AssumptionsEditor({ assumptions, edits, onEdit, onClear }: { assumptions: Assumptions; edits: Partial<Assumptions>; onEdit: (k: AssumptionKey, v: number) => void; onClear: (k: AssumptionKey) => void }) {
  const [drafts, setDrafts] = useState<Partial<Record<AssumptionKey, string>>>({});
  const [errors, setErrors] = useState<Partial<Record<AssumptionKey, string>>>({});

  const change = (spec: FieldSpec, text: string) => {
    setDrafts((d) => ({ ...d, [spec.key]: text }));
    const parsed = text.trim() === '' ? Number.NaN : Number(text);
    const issues = validate({ [spec.key]: parsed });
    if (hasErrors(issues)) {
      setErrors((e) => ({ ...e, [spec.key]: issues.find((i) => i.severity === 'error')?.message ?? 'Invalid value.' }));
      return;
    }
    setErrors(({ [spec.key]: _gone, ...rest }) => rest);
    onEdit(spec.key, parsed);
  };

  return (
    <div style={stack}>
      <Notice style={{ marginBlock: 0 }}>
        Every input is a planning assumption, labelled with where its default came from: <strong>brief</strong> (the founder's), <strong>repo</strong> (a repository figure that needs confirmation), <strong>placeholder</strong> (replace with an actual) or <strong>assumption</strong> (a modelling choice). An invalid value is refused and the model keeps the last valid one. Percentages are entered as decimals: 0.15 is 15%.
      </Notice>
      {GROUPS.map((g) => (
        <fieldset key={g} style={{ border: '1px solid var(--app-line)', borderRadius: 'var(--r-md)', padding: 'var(--sp-4)', display: 'grid', gap: 'var(--sp-4)' }}>
          <legend><strong>{g}</strong></legend>
          {FIELDS.filter((f) => f.group === g).map((spec) => {
            const err = errors[spec.key];
            const edited = spec.key in edits;
            const warnings = validate({ [spec.key]: assumptions[spec.key] }).filter((i) => i.severity === 'warning');
            const boxId = `finance-input-${spec.key}`;
            const hintId = `${boxId}-hint`;
            const hint = [spec.note, ...warnings.map((w) => w.message)].filter(Boolean).join(' ');
            return (
              <div key={spec.key} style={{ display: 'grid', gap: 'var(--sp-2)' }}>
                <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
                  <span>{spec.label} <small style={{ color: 'var(--app-dim)' }}>({unitText(spec)}; {spec.source}{edited ? '; edited' : ''})</small></span>
                  <input
                    className="input"
                    inputMode="decimal"
                    value={drafts[spec.key] ?? String(assumptions[spec.key])}
                    onChange={(e) => change(spec, e.target.value)}
                    {...fieldProps(boxId, err, hint ? hintId : undefined)}
                  />
                </label>
                {hint && <small id={hintId} style={{ color: 'var(--app-dim)' }}>{hint}</small>}
                <FieldMessage id={boxId} error={err} />
                {edited && (
                  <button type="button" className="btn" style={{ justifySelf: 'start' }} onClick={() => { setDrafts(({ [spec.key]: _d, ...r }) => r); setErrors(({ [spec.key]: _e, ...r }) => r); onClear(spec.key); }}>
                    Undo edit to {spec.label}
                  </button>
                )}
              </div>
            );
          })}
        </fieldset>
      ))}
    </div>
  );
}

const unitText = (s: FieldSpec) => `${s.unit === 'pct' ? 'decimal, ' : ''}${s.unit}, ${s.min} to ${s.max}`;

// ── Exports ────────────────────────────────────────────────────────────────

function download(name: string, text: string, type: string): boolean {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return false;
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  // Revoke on a timer rather than immediately: Safari starts the download asynchronously, and a URL revoked in
  // the same tick produces a failed download with no error anywhere.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return true;
}

function Exports({ result, scenarioId, edits, onStatus }: { result: ModelResult; scenarioId: ScenarioId; edits: Partial<Assumptions>; onStatus: (s: string) => void }) {
  const stamp = () => new Date().toISOString();
  const all = () => summariseAll(edits);
  const save = (name: string, text: string, type: string) => onStatus(download(name, text, type) ? `Downloaded ${name}.` : `Could not start a download for ${name} in this browser.`);
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onStatus(`Copied ${what}.`);
    } catch {
      onStatus(`Could not copy ${what}: the browser refused clipboard access.`);
    }
  };
  const id = scenarioId;
  const actions: { label: string; run: () => void }[] = [
    { label: 'Download monthly table (CSV)', run: () => save(`semester-gtm-${id}-monthly.csv`, monthlyCsv(result, id), 'text/csv') },
    { label: 'Download assumptions (CSV)', run: () => save(`semester-gtm-${id}-assumptions.csv`, assumptionsCsv(result, id), 'text/csv') },
    { label: 'Download scenario (JSON)', run: () => save(`semester-gtm-${id}.json`, scenarioJson(result, id, stamp()), 'application/json') },
    { label: 'Download scenario (Markdown)', run: () => save(`semester-gtm-${id}.md`, scenarioMarkdown(result, id), 'text/markdown') },
    { label: 'Download board summary (Markdown)', run: () => save(`semester-gtm-${id}-board-summary.md`, boardSummary(result, id, all()), 'text/markdown') },
    { label: 'Copy assumptions as a prompt', run: () => void copy(assumptionsPrompt(result, id), 'the assumptions prompt') },
  ];
  return (
    <div style={stack}>
      <Notice style={{ marginBlock: 0 }}>Exports carry the current scenario and edits, the Forecast label and the disclaimer. They are internal planning files, not for a customer or investor without the professional reviews they name.</Notice>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
        {actions.map((a) => (
          <button key={a.label} type="button" className="btn" onClick={a.run}>{a.label}</button>
        ))}
      </div>
    </div>
  );
}
