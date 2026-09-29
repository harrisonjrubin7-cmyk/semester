import type { ReactNode } from 'react';
import type { SiteConfig } from './config';
import { href } from './Layout';
import { Hero, Section } from './pages';
import {
  AREAS, COMPARISON, DESTINATIONS_MAP, FINAL_TEST, HEADLINE, MESSAGES, POINT_SOLUTIONS, PRINCIPLES, STATEMENT, STATUSES, STATUS_MEANING, STATUS_WORD, row, weakest, weakestRow, type Status,
} from '../lib/oneos';

/*
 * The two pages the second brief asked for: the product architecture — one
 * operating system, every student moment — and the comparison with the
 * traditional approach.
 *
 * The rules in `pages.tsx` hold here word for word, and one more from the
 * brief these pages come from: the positioning is printed as the brief wrote
 * it, and under it the register's word for every area — held by a test, being
 * built, designed, not started — so the page cannot say "fully built" where
 * the tree says "building". The words come from `lib/oneos.ts`, whose test
 * holds every area to rows that exist and rates it at the weakest of them.
 *
 * These four words are this register's, not the claims register's six: a
 * capability a buyer might buy on still carries a `data-claim` word from
 * `lib/ops/claims.ts`, and neither page prints one of those six words, so the
 * two vocabularies cannot be confused (the test holds that). What keeps a word
 * here honest is the same thing that keeps the Semester Standard honest: the
 * gap is on the page. Every area lists the rows it rests on with each row's
 * word and gap, and every comparison row prints the gap of its weakest row.
 * Each badge carries `data-oneos`, so a test can find every one on the site.
 *
 * Script-free, like every content page: an area opens as a disclosure.
 */

type Page = (props: { config: SiteConfig }) => ReactNode;

function Word({ status }: { status: Status }) {
  return <span data-oneos={status} className={`site-badge site-oneos site-oneos-${status}`}>{STATUS_WORD[status]}</span>;
}

function Legend() {
  return (
    <dl className="site-legend">
      {STATUSES.map((s) => (
        <div key={s}>
          <dt><Word status={s} /></dt>
          <dd>{STATUS_MEANING[s]}.</dd>
        </div>
      ))}
    </dl>
  );
}

// ── /platform/one-operating-system/ ─────────────────────────────────────────

export const OneOperatingSystem: Page = ({ config }) => (
  <>
    <Hero title={HEADLINE} lead="Every student moment. One identity, one action layer, one data model, one shared understanding of the student journey — and, beside every area, where it stands today." />
    <Section title="The positioning" id="os-position">
      <p>{STATEMENT}</p>
      {MESSAGES.map((m) => (
        <p key={m.audience}><strong>{m.audience}.</strong> {m.text}</p>
      ))}
    </Section>
    <Section title="Most edtech products solve one isolated problem" id="os-point">
      <ul>
        {POINT_SOLUTIONS.map((p) => <li key={p}>{p}</li>)}
      </ul>
      <p>
        Semester is designed as the system that connects those moments. Whether it does yet, area by area, is what the rest of this page says: each area carries the register’s word, and the word is the weakest of the pieces it rests on.
      </p>
      <Legend />
    </Section>
    <Section title="The student at the centre, nine areas around them" id="os-areas">
      <p className="site-small">Open an area for the student problem, the Semester workflow, who benefits, what connects, what stays official, and how it connects back to Today, the Action Center, Search, Plan, the Workspace and Semester Intelligence.</p>
      <ul className="site-areas">
        {AREAS.map((a) => {
          const status = weakest(a.rests);
          return (
            <li key={a.id}>
              <details>
                <summary><span className="site-area-name">{a.name}</span> <Word status={status} /></summary>
                <dl className="site-area">
                  <div><dt>The student problem</dt><dd>{a.problem}</dd></div>
                  <div><dt>The Semester workflow</dt><dd>{a.workflow}</dd></div>
                  <div><dt>Who benefits</dt><dd>{a.benefits}</dd></div>
                  <div><dt>What connects</dt><dd>{a.connects}</dd></div>
                  <div><dt>What stays official</dt><dd>{a.official}</dd></div>
                  <div><dt>Connects back to</dt><dd>{a.backTo.join(', ')}</dd></div>
                  <div><dt>Where it stands</dt><dd><Word status={status} /> — the weakest of {a.rests.length} rows in the register, each with its gap:</dd></div>
                </dl>
                <ul className="site-plain site-rests">
                  {a.rests.map((id) => {
                    const r = row(id);
                    return <li key={id}><Word status={r.status} /> {r.what}. <span className="site-small">{r.gap}</span></li>;
                  })}
                </ul>
              </details>
            </li>
          );
        })}
      </ul>
    </Section>
    <Section title="Five principles" id="os-principles">
      <ul className="site-plain">
        {PRINCIPLES.map((p) => (
          <li key={p.id}><Word status={p.status} /> {p.what}. <span className="site-small">{p.gap}</span></li>
        ))}
      </ul>
    </Section>
    <Section title="Five destinations" id="os-five">
      <p>Everything else opens within these as a contextual mode, not as a twenty-first tab.</p>
      <ul className="site-plain">
        {DESTINATIONS_MAP.map((d) => <li key={d.screen}><strong>{d.label}</strong> — {d.note}</li>)}
      </ul>
    </Section>
    <Section title="The final test" id="os-test">
      <p>Semester feels like one system when a student can begin anywhere — an assignment, a deadline, a course, a campus resource, an advising appointment, a financial reminder, a career opportunity — and immediately see:</p>
      <ol>
        {FINAL_TEST.map((t) => (
          <li key={t.id}>{t.what.replace(/^\d+\. /, '')} <Word status={t.status} /></li>
        ))}
      </ol>
      <p className="site-small">
        <a href={href(config, '/platform/why-not-another-tool/')}>Why not another tool?</a> · <a href={href(config, '/product/')}>How Semester works</a> · <a href={href(config, '/platform/system-boundaries/')}>System boundaries</a> · <a href={href(config, '/launch-readiness/')}>Are we ready?</a>
      </p>
    </Section>
  </>
);

// ── /platform/why-not-another-tool/ ─────────────────────────────────────────

export const WhyNotAnotherTool: Page = ({ config }) => (
  <>
    <Hero title="Why not another tool?" lead="The traditional approach beside the Semester approach, and beside each row the word the register gives it today." />
    <Section title="The comparison" id="why-table">
      <div className="site-scroll">
        <table className="site-table">
          <caption>Traditional approach, Semester approach, where Semester stands, and the gap of the weakest row</caption>
          <thead>
            <tr><th scope="col">Traditional approach</th><th scope="col">Semester approach</th><th scope="col">Where it stands</th><th scope="col">The gap</th></tr>
          </thead>
          <tbody>
            {COMPARISON.map((c) => (
              <tr key={c.id}>
                <th scope="row">{c.traditional}</th>
                <td>{c.semester}</td>
                <td><Word status={weakestRow(c.rests).status} /></td>
                <td>{weakestRow(c.rests).gap}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Legend />
    </Section>
    <Section title="What the words mean here" id="why-words">
      <p>
        A row says <strong>Held by a test</strong> only when every piece it rests on has a test that runs on every change. One piece still being built makes the whole row <strong>Being built</strong>: a connected platform is only as connected as its weakest join, and this page is where a buyer should find that out, not in a pilot.
      </p>
      <p>
        What stays official — registration, the degree audit, grades, financial aid, housing — is on the <a href={href(config, '/platform/system-boundaries/')}>system boundaries</a> page. What each capability is called, with the six status words the site uses, is on <a href={href(config, '/platform/availability/')}>what is available</a>.
      </p>
      <p className="site-small">
        <a href={href(config, '/platform/one-operating-system/')}>One Operating System. Every Student Moment.</a> · <a href={href(config, '/institutions/')}>For institutions</a>
      </p>
    </Section>
  </>
);
