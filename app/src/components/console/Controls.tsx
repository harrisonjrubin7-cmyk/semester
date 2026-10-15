import { Notice, SectionLabel } from '../ui';
import { Table, type Column } from '../unity/Table';
import { COUNCIL } from '../../lib/launchreadiness';
import { CONTROLS, FAMILIES, FAMILY_TITLE, STATES, type Control, type State } from '../../lib/ops/trustcontrols';
import { Prose, matches, type ViewProps } from './Fields';

/**
 * The integrated control register, read-only: what protects a student and an
 * institution, and whether anything in the repository fails when a control is
 * removed.
 *
 * The four words are the register's own, and they are claims about the tree and
 * CI, not about production. "Enforced" means a test, a database check or a
 * workflow goes red without the control; nothing here says it is operating, so
 * the page leads with that. No control is editable: a switch that turned a
 * "documented" row into "enforced" would be the false assurance the register
 * exists to prevent. The state is whatever `lib/ops/trustcontrols.ts` says.
 */

const STATE_WORD: Record<State, string> = {
  enforced: 'Enforced',
  partial: 'Partial',
  documented: 'Documented only',
  absent: 'Absent',
};

const seatTitle = (seat: string): string => COUNCIL.find((s) => s.seat === seat)?.title ?? seat;

export function Controls({ filter, controls = CONTROLS }: Pick<ViewProps, 'filter'> & { controls?: readonly Control[] }) {
  const rows = controls.filter((c) => matches(filter, c.id, FAMILY_TITLE[c.family], c.does, STATE_WORD[c.state], c.mechanism, seatTitle(c.owner), c.gap));
  const count = (s: State) => controls.filter((c) => c.state === s).length;

  const columns: Column<Control>[] = [
    { id: 'control', header: 'Control', rowHeader: true, cell: (c) => <Prose><strong>{c.id}</strong> — {c.does}</Prose> },
    { id: 'family', header: 'Family', cell: (c) => FAMILY_TITLE[c.family] },
    { id: 'state', header: 'State', cell: (c) => <strong>{STATE_WORD[c.state]}</strong> },
    { id: 'mechanism', header: 'Mechanism', cell: (c) => c.mechanism },
    {
      id: 'proof',
      header: 'Fails without it',
      cell: (c) =>
        c.proof.length === 0 ? (
          'Nothing'
        ) : (
          <Prose>
            <details>
              <summary>{c.proof.length === 1 ? '1 file' : `${c.proof.length} files`}</summary>
              <ul style={{ margin: 'var(--sp-2) 0 0', paddingInlineStart: 'var(--sp-5)' }}>
                {c.proof.map((p) => (
                  <li key={p}>
                    <code>{p}</code>
                  </li>
                ))}
              </ul>
            </details>
          </Prose>
        ),
    },
    { id: 'gap', header: 'Still missing', cell: (c) => <Prose>{c.gap ?? 'Nothing recorded as missing.'}</Prose> },
    { id: 'owner', header: 'Owner', cell: (c) => seatTitle(c.owner) },
  ];

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-5)' }}>
      <Notice>
        Read-only, and a claim about the repository and its CI, not about production. “Enforced” means a test, a database check or a workflow fails without the control;
        it does not mean the control is operating for any institution. Nothing on this page can change a state.
      </Notice>
      <SectionLabel aside={`${controls.length} controls`}>Controls</SectionLabel>
      <p style={{ marginBlock: 0 }}>
        {STATES.map((s) => `${count(s)} ${STATE_WORD[s].toLowerCase()}`).join(' · ')} across {FAMILIES.length} families.
      </p>
      <Table
        caption="Integrated controls, their state, and what fails without each"
        captionHidden
        columns={columns}
        rows={rows}
        rowKey={(c) => c.id}
        compact="stack"
        empty={<p style={{ marginBlock: 0, color: 'var(--app-dim)' }}>No controls match.</p>}
      />
    </div>
  );
}
