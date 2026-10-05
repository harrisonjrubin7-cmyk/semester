import type { ReactNode } from 'react';
import { CONTACT_EMAIL, type SiteConfig } from './config';
import { href } from './Layout';
import { Cards, Hero, Section } from './pages';
import { CHANNELS, DOES_NOT_REPLACE, LEADS_WITH, MODULES, MOTION, NOT_A_SEGMENT, PILOT, POSITIONING, SEGMENTS, mayTakeDistrictData } from '../lib/k12/edition';
import { BASELINE, districtReady } from '../lib/k12/requirements';
import { MINIMUM_AGE } from '../lib/age';

/*
 * /k-12/: the K–12 edition, described and not offered.
 *
 * The rules in `pages.tsx` hold here word for word, and one more: nothing on
 * this page says a district is served, a pilot is running or a school uses
 * Semester. The answer to "can a district's student data be taken?" is
 * printed from `mayTakeDistrictData()`, not written as prose, so it changes
 * only when the baseline in `lib/k12/requirements.ts` does.
 */

type Page = (props: { config: SiteConfig }) => ReactNode;

const mail = (subject: string) => `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;

export const K12: Page = ({ config }) => {
  const gate = districtReady();
  return (
    <>
      <Hero title="Semester for high school" lead={POSITIONING}>
        <p>
          <strong>No district or school uses Semester today.</strong>{' '}
          {mayTakeDistrictData()
            ? 'The district baseline is met, and a first pilot can be planned.'
            : `A district’s student data is not accepted yet: ${gate.short.length} of the ${BASELINE.length} things it waits on are not done.`}{' '}
          Nobody under {MINIMUM_AGE} may hold an account.
        </p>
        <p className="site-actions">
          <a className="site-button" href={mail('Semester for high school')}>Talk about a future pilot</a>
          <a href={href(config, '/privacy/')}>Privacy</a>
        </p>
      </Hero>
      <Section title="What it leads with" id="k12-leads">
        <ul>
          {LEADS_WITH.map((l) => <li key={l}>{l}</li>)}
        </ul>
        <p className="site-small">It does not replace {DOES_NOT_REPLACE.map((d) => d.toLowerCase()).join(', ')}.</p>
      </Section>
      <Section title="Where it would start" id="k12-segments">
        <Cards items={SEGMENTS.map((s) => [s.segment, s.offer] as [string, string])} />
        <p className="site-small">{NOT_A_SEGMENT}</p>
      </Section>
      <Section title="The same platform, configured for a school" id="k12-modules">
        <div className="site-scroll">
          <table className="site-table">
            <caption>Each module, what it would do for a high school, and what that still needs</caption>
            <thead>
              <tr><th scope="col">Module</th><th scope="col">For a high school</th><th scope="col">Still needs</th></tr>
            </thead>
            <tbody>
              {MODULES.map((m) => (
                <tr key={m.module}><th scope="row">{m.module}</th><td>{m.k12}</td><td>{m.needs}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title="The first pilot, when it can be offered" id="k12-pilot">
        <p>
          <strong>{PILOT.name}.</strong> {PILOT.cohort}, for {PILOT.weeks} weeks.
        </p>
        <h3>What it includes</h3>
        <ul>
          {PILOT.includes.map((i) => <li key={i}>{i}</li>)}
        </ul>
        <h3>What it leaves out</h3>
        <ul>
          {PILOT.excludes.map((i) => <li key={i}>{i}</li>)}
        </ul>
        <h3>How it would be measured</h3>
        <ul>
          {PILOT.measures.map((i) => <li key={i}>{i}</li>)}
        </ul>
      </Section>
      <Section title="What a district’s data waits on" id="k12-baseline">
        <ul>
          {BASELINE.map((b) => (
            <li key={b.id}>
              {b.item} — {b.status === 'tested' && b.gap === ''
                ? 'held by a test'
                : b.status === 'tested'
                  ? `held by a test, not yet done: ${b.gap}`
                  : b.status === 'not-started'
                    ? 'not started'
                    : 'not yet held'}
            </li>
          ))}
        </ul>
      </Section>
      <Section title="How a district would be reached" id="k12-motion">
        <ol>
          {MOTION.map((m) => <li key={m}>{m}</li>)}
        </ol>
        <p className="site-small">Through {CHANNELS.map((c) => c.toLowerCase()).join(', ')}.</p>
      </Section>
    </>
  );
};
