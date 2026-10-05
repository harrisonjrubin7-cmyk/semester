import type { ReactNode } from 'react';
import { COUNCIL } from '../lib/launchreadiness';
import { AUDIENCES, CLAIMS, POLICIES, POLICY_MEANING, STATUS_LABEL, STATUS_MEANING, claim, type Audience, type Claim } from '../lib/ops/claims';

/*
 * The status label the public site prints beside a capability.
 *
 * The wording and the status come from the claims register, never from the
 * page, so a page cannot say "available" about something the register calls
 * planned, and `claims.test.ts` reads the rendered site to check that every
 * registered claim is printed with its label and nothing unregistered is.
 * The `data-claim` attribute is what the test looks for.
 */

export function StatusBadge({ c }: { c: Claim }) {
  return <span className={`site-badge site-status site-status-${c.status}`}>{STATUS_LABEL[c.status]}</span>;
}

/** One claim as a list item: the label, the wording, the scope. */
export function ClaimItem({ id }: { id: string }) {
  const c = claim(id);
  return (
    <li data-claim={c.id} className="site-claim">
      <StatusBadge c={c} /> <span className="site-claim-text">{c.claim}</span>
      <span className="site-small site-claim-scope">{c.scope}</span>
    </li>
  );
}

export function ClaimList({ ids }: { ids: readonly string[] }) {
  return (
    <ul className="site-claims">
      {ids.map((id) => <ClaimItem key={id} id={id} />)}
    </ul>
  );
}

const seatTitle = (seat: string) => COUNCIL.find((s) => s.seat === seat)?.title ?? seat;

/** Claims as an evidence table: what, its status, how it is checked, its known limitation, who owns it. */
export function ClaimTable({ ids, caption }: { ids: readonly string[]; caption: string }) {
  return (
    <div className="site-scroll">
      <table className="site-table">
        <caption>{caption}</caption>
        <thead>
          <tr><th scope="col">Area</th><th scope="col">Status</th><th scope="col">Checked</th><th scope="col">Known limitation</th><th scope="col">Owner</th></tr>
        </thead>
        <tbody>
          {ids.map((id) => {
            const c = claim(id);
            return (
              <tr key={id} data-claim={c.id}>
                <th scope="row">{c.claim}</th>
                <td><StatusBadge c={c} /></td>
                <td>{c.status === 'available' ? 'Every change, by test' : c.evidence.some((e) => /\.test\.|\.check\./.test(e.path)) ? 'By test, not yet deployed' : 'Not yet'}</td>
                <td>{c.scope}</td>
                <td>{seatTitle(c.owner)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** The six words and what each means. */
export function StatusLegend() {
  return (
    <dl className="site-legend">
      {(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((s) => (
        <div key={s}>
          <dt><span className={`site-badge site-status site-status-${s}`}>{STATUS_LABEL[s]}</span></dt>
          <dd>{STATUS_MEANING[s]}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Every claim for one audience, in register order. */
export function AudienceClaims({ audience }: { audience: Audience }) {
  return <ClaimList ids={CLAIMS.filter((c) => c.audiences.includes(audience)).map((c) => c.id)} />;
}

export function audienceTitle(id: Audience): { title: string; question: string } {
  const a = AUDIENCES.find((x) => x.id === id);
  if (!a) throw new Error(`No audience ${id}`);
  return a;
}

/** The policies and where each stands. */
export function PolicyTable({ children }: { children?: ReactNode }) {
  return (
    <div className="site-scroll">
      <table className="site-table">
        <caption>Every policy, its status, version and effective date{children}</caption>
        <thead>
          <tr><th scope="col">Policy</th><th scope="col">Status</th><th scope="col">Version</th><th scope="col">Effective</th><th scope="col">Owner</th></tr>
        </thead>
        <tbody>
          {POLICIES.map((p) => (
            <tr key={p.id}>
              <th scope="row">{p.policy}{p.note ? <span className="site-small site-claim-scope">{p.note}</span> : null}</th>
              <td><span className="site-badge">{POLICY_MEANING[p.status].split(';')[0]}</span></td>
              <td>{p.version === '0' ? 'None' : p.version}</td>
              <td>{p.effective ?? 'Not in force'}</td>
              <td>{seatTitle(p.owner)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
