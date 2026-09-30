import type { ReactNode } from 'react';
import { CONTACT_EMAIL, type SiteConfig } from './config';
import { href } from './Layout';
import { Hero, Section } from './pages';
import { NOT_BUILT, NOTHING_IS_LIVE, PARTS, POSITIONING, PRICE, TODAY, WAITS_ON } from '../lib/advancement/edition';

/*
 * /solutions/advancement/ and /alumni/: alumni relations and fundraising,
 * described and not built.
 *
 * The rules in `pages.tsx` hold here word for word, and one more: nothing on
 * either page says a school uses this, a gift has been taken or a receipt has
 * been issued. Each part's status is printed from `lib/advancement/edition.ts`,
 * where every row is "planned" until a test holds the thing.
 */

type Page = (props: { config: SiteConfig }) => ReactNode;

const mail = (subject: string) => `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;

export const Advancement: Page = ({ config }) => (
  <>
    <Hero title="Alumni relations and fundraising" lead={POSITIONING}>
      <p>
        <strong>{NOTHING_IS_LIVE}</strong> {PRICE}
      </p>
      <p className="site-actions">
        <a className="site-button" href={mail('Semester for alumni relations and fundraising')}>Tell us what your office needs</a>
        <a href={href(config, '/alumni/')}>For graduates</a>
      </p>
    </Hero>
    <Section title="What it would do" id="advancement-parts">
      {PARTS.map((p) => (
        <div key={p.id} id={`advancement-${p.id}`}>
          <h3>{p.title}</h3>
          <p><strong>Status: planned.</strong> Not built.</p>
          <ul>
            {p.would.map((w) => <li key={w}>{w}</li>)}
          </ul>
          <p><strong>Still needs:</strong> {p.needs}</p>
        </div>
      ))}
    </Section>
    <Section title="What is not planned" id="advancement-refused">
      <ul>
        {NOT_BUILT.map((n) => <li key={n.what}><strong>{n.what}.</strong> {n.why}</li>)}
      </ul>
    </Section>
    <Section title="What it waits on before it is offered" id="advancement-waits">
      <ul>
        {WAITS_ON.map((w) => <li key={w}>{w}</li>)}
      </ul>
    </Section>
  </>
);

export const Alumni: Page = ({ config }) => (
  <>
    <Hero title="For graduates" lead="What a graduate can do in Semester today, and what a school’s alumni office might one day do with it.">
      <p>
        <strong>{NOTHING_IS_LIVE}</strong> Nothing on this page asks you for a gift.
      </p>
    </Hero>
    <Section title="What you can do today" id="alumni-today">
      <ul>
        {TODAY.map((t) => <li key={t}>{t}</li>)}
      </ul>
      <p className="site-small">Both are your choice, and both can be withdrawn.</p>
    </Section>
    <Section title="What a school might add" id="alumni-planned">
      <ul>
        {PARTS.filter((p) => p.id === 'constituents').flatMap((p) => p.would).map((w) => <li key={w}>{w}</li>)}
      </ul>
      <p className="site-small">
        Planned, not built. An alumni directory would show only the people who opted in. For how a school’s office
        would use it, see <a href={href(config, '/solutions/advancement/')}>alumni relations and fundraising</a>.
      </p>
    </Section>
  </>
);
