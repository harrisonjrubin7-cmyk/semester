import { Notice, SectionLabel } from '../ui';
import { Table, type Column } from '../unity/Table';
import { CURRENT, decide, type Gate, type GateStatus, type LaunchState, type SeatDefinition, type Verdict } from '../../lib/launchreadiness';
import { Prose, matches, type ViewProps } from './Fields';

/**
 * Where the launch go/no-go stands: the twelve gates, the council that signs,
 * and the verdict `decide()` derives from them.
 *
 * Read-only, and it says so, because the model it shows is built to refuse
 * being ticked by whoever holds the pen (`lib/launchreadiness.ts`). A gate is
 * `met` only when the files it cites exist and the seats have signed; the
 * state is data in the repository, with a date, and nothing here reads the
 * network or a clock. So this is the repository's record as of that date, not
 * a live check, and the tab leads with the date for exactly that reason. A
 * control that appeared to clear a gate would be the false "approved" the
 * model exists to prevent.
 *
 * The verdict is `decide(state)` and nothing else: this file never decides.
 * The words below are the model's own (`Verdict`, `GateStatus`) said plainly.
 */

const VERDICT_WORD: Record<Verdict['verdict'], string> = {
  go: 'Go',
  'go-with-conditions': 'Go with conditions',
  'no-go': 'No-go',
};

const STATUS_WORD: Record<GateStatus, string> = {
  met: 'Met',
  partial: 'Partial',
  unmet: 'Unmet',
};

const seatTitle = (council: readonly SeatDefinition[], seat: string): string => council.find((s) => s.seat === seat)?.title ?? seat;

export function Launch({ filter, state = CURRENT }: Pick<ViewProps, 'filter'> & { state?: LaunchState }) {
  const verdict = decide(state);
  const gates = state.gates.filter((g) => matches(filter, g.id, g.requirement, STATUS_WORD[g.status], seatTitle(state.council, g.owner), g.gap));
  const seats = state.council.filter((s) => matches(filter, s.seat, s.title, s.decides, s.holder ?? 'Vacant'));
  const met = state.gates.filter((g) => g.status === 'met').length;

  const gateColumns: Column<Gate>[] = [
    { id: 'gate', header: 'Requirement', rowHeader: true, cell: (g) => <Prose>{g.requirement}</Prose> },
    { id: 'status', header: 'Status', cell: (g) => <strong>{STATUS_WORD[g.status]}</strong> },
    { id: 'owner', header: 'Owner', cell: (g) => seatTitle(state.council, g.owner) },
    {
      id: 'evidence',
      header: 'Evidence',
      cell: (g) =>
        g.evidence.length === 0 ? (
          'None yet'
        ) : (
          <Prose>
          <details>
            <summary>{g.evidence.length === 1 ? '1 file' : `${g.evidence.length} files`}</summary>
            <ul style={{ margin: 'var(--sp-2) 0 0', paddingInlineStart: 'var(--sp-5)' }}>
              {g.evidence.map((e) => (
                <li key={e.path}>
                  <code>{e.path}</code> — {e.shows}
                </li>
              ))}
            </ul>
          </details>
          </Prose>
        ),
    },
    { id: 'gap', header: 'Still missing', cell: (g) => <Prose>{g.gap ?? 'Nothing recorded as missing.'}</Prose> },
  ];

  const seatColumns: Column<SeatDefinition>[] = [
    { id: 'seat', header: 'Seat', rowHeader: true, cell: (s) => s.title },
    { id: 'decides', header: 'Decides', cell: (s) => <Prose>{s.decides}</Prose> },
    { id: 'holder', header: 'Held by', cell: (s) => s.holder ?? 'Vacant' },
    { id: 'signed', header: 'Signed', cell: (s) => <strong>{state.signoffs.includes(s.seat) ? 'Signed' : 'Not signed'}</strong> },
  ];

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-5)' }}>
      <Notice>
        Read-only, and the repository’s record as of <strong>{state.on}</strong>, not a live check. A gate is met only when the files it cites exist and the council has signed;
        nothing on this page can clear one. The verdict is worked out from that record and never set by hand.
      </Notice>

      <section aria-labelledby="launch-verdict" style={{ display: 'grid', gap: 'var(--sp-2)' }}>
        <SectionLabel aside={`${met} of ${state.gates.length} gates met`}>Verdict</SectionLabel>
        <p id="launch-verdict" role="status" style={{ marginBlock: 0, fontSize: 'var(--type-lg)' }}>
          <strong>{VERDICT_WORD[verdict.verdict]}</strong>
          {verdict.verdict === 'no-go' ? ` — ${verdict.reasons.length} open ${verdict.reasons.length === 1 ? 'reason' : 'reasons'}.` : '.'}
        </p>
        {verdict.conditions.length > 0 && (
          <ul aria-label="Conditions this launch proceeds under" style={{ margin: 0, paddingInlineStart: 'var(--sp-5)' }}>
            {verdict.conditions.map((c) => (
              <li key={c.blocker}>
                <strong>{c.blocker}</strong> ({c.severity}) accepted by {seatTitle(state.council, c.by)} until {c.expires}: {c.reason} Pilot users are told: {c.disclosure}
              </li>
            ))}
          </ul>
        )}
        {verdict.reasons.length > 0 && (
          <details>
            <summary>Why: the {verdict.reasons.length === 1 ? 'reason' : `${verdict.reasons.length} reasons`}, in the order the model lists them</summary>
            <ol style={{ margin: 'var(--sp-2) 0 0', paddingInlineStart: 'var(--sp-5)' }}>
              {verdict.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ol>
          </details>
        )}
      </section>

      <SectionLabel aside={`${gates.length}`}>Gates</SectionLabel>
      <Table
        caption="Launch gates, their status and what is still missing"
        captionHidden
        columns={gateColumns}
        rows={gates}
        rowKey={(g) => g.id}
        compact="stack"
        empty={<p style={{ marginBlock: 0, color: 'var(--app-dim)' }}>No gates match.</p>}
      />

      <SectionLabel aside={`${seats.length}`}>Council</SectionLabel>
      <Table
        caption="The launch council: who holds each seat and whether it has signed"
        captionHidden
        columns={seatColumns}
        rows={seats}
        rowKey={(s) => s.seat}
        compact="stack"
        empty={<p style={{ marginBlock: 0, color: 'var(--app-dim)' }}>No seats match.</p>}
      />
    </div>
  );
}
