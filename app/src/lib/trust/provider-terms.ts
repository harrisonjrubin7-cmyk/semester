/**
 * The AI providers' contract terms, as published, read and recorded.
 *
 * The vendor risk register and the DPA checklist both said the providers'
 * training and retention terms were "not yet recorded". This is the record:
 * each document Semester's relationship with an AI provider would rest on,
 * with its version and where it was read, and the clause that answers each
 * question the DPA checklist asks — quoted word for word from the document,
 * checked against the text on the day it was read.
 *
 * ## What this is not
 *
 * **Nothing here is signed.** A published term is what a provider offers; it
 * binds Semester only once Semester accepts it, and whether it has is a fact
 * about an account, not about a web page. `STANDING` says, per party, what
 * would make each document apply and whether that has happened, and the test
 * holds every party to `published` — never `accepted` or `signed` — until an
 * executed copy or a pointer to one is filed under `docs/evidence/vendors/`,
 * which the vendor risk register names as the place and which does not exist.
 *
 * The OpenAI documents are PDFs; each carries the SHA-256 of the copy read,
 * so a later reader can tell whether the text has changed. The Anthropic
 * documents are web pages whose markup changes without the terms changing,
 * so each carries the effective date the page states instead.
 *
 * `docs/trust/PROVIDER-TERMS.md` is rendered from this file by
 * `provider-terms.test.ts`; edit the data, then `npm run registers` from app/.
 */

export const READ_ON = '2026-09-29';

export type Provider = 'Anthropic' | 'OpenAI';

export interface TermsDocument {
  id: string;
  provider: Provider;
  title: string;
  /** As the document states it. */
  version: string;
  url: string;
  /** SHA-256 of the PDF read; null for a web page, whose markup changes without the terms changing. */
  sha256: string | null;
}

export const DOCUMENTS: readonly TermsDocument[] = [
  { id: 'anthropic-commercial', provider: 'Anthropic', title: 'Commercial Terms of Service', version: 'Effective June 17, 2025', url: 'https://www.anthropic.com/legal/commercial-terms', sha256: null },
  { id: 'anthropic-dpa', provider: 'Anthropic', title: 'Data Processing Addendum', version: 'Effective February 24, 2025', url: 'https://www.anthropic.com/legal/data-processing-addendum', sha256: null },
  { id: 'anthropic-retention', provider: 'Anthropic', title: 'How long do you store my organization’s data?', version: 'Privacy center article, undated', url: 'https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data', sha256: null },
  { id: 'openai-osa', provider: 'OpenAI', title: 'OpenAI Services Agreement', version: 'ONLINE v.010126', url: 'https://cdn.openai.com/osa/openai-services-agreement.pdf', sha256: 'b93f17c5be5a4deadca42026195d361353619f49756ab74a7b356877cf7ab341' },
  { id: 'openai-dpa', provider: 'OpenAI', title: 'OpenAI Data Processing Addendum', version: 'v.010126', url: 'https://cdn.openai.com/pdf/openai-data-processing-addendum.pdf', sha256: '42309abe1e586665980ff45a83c813f5d6117c6f4ee0cf28f6cecb56c8426393' },
  { id: 'openai-sdpa', provider: 'OpenAI', title: 'OpenAI Student Data Privacy Agreement', version: 'Undated PDF', url: 'https://cdn.openai.com/osa/openai-sdpa.pdf', sha256: '5af9a58010e2ea2f3643bb9f72e2087b827ca9394735b5627027dc7891a4e762' },
  { id: 'openai-your-data', provider: 'OpenAI', title: 'Data controls in the OpenAI platform', version: 'Developer guide, undated', url: 'https://developers.openai.com/api/docs/guides/your-data', sha256: null },
];

/** The questions the DPA checklist asks of a provider, in its order. */
export const QUESTIONS = ['Training', 'Retention', 'Breach notice', 'Deletion on termination', 'Subprocessors', 'Security', 'Student data'] as const;
export type Question = (typeof QUESTIONS)[number];

export interface Clause {
  provider: Provider;
  question: Question;
  doc: string;
  /** The section the document numbers it as, where it numbers it. */
  section: string;
  /** Word for word from the document. */
  quote: string;
  /** What it means for Semester, in a sentence. */
  reading: string;
}

export const CLAUSES: readonly Clause[] = [
  { provider: 'Anthropic', question: 'Training', doc: 'anthropic-commercial', section: 'B', quote: 'Anthropic may not train models on Customer Content from Services.', reading: 'Contractual, not a policy page: API inputs and outputs are not training data.' },
  { provider: 'Anthropic', question: 'Retention', doc: 'anthropic-retention', section: 'Standard Retention Timeframe', quote: 'For Anthropic API users, we automatically delete inputs and outputs on our backend within 30 days of receipt or generation', reading: 'Thirty days by default; the same article keeps flagged content up to two years, and zero retention is by agreement only.' },
  { provider: 'Anthropic', question: 'Breach notice', doc: 'anthropic-dpa', section: 'G.1', quote: 'Anthropic will notify Customer in writing without undue delay, but in any event within 48 hours, after becoming aware of any Security Breach', reading: 'A fixed 48-hour window Semester could flow down to an institution.' },
  { provider: 'Anthropic', question: 'Deletion on termination', doc: 'anthropic-dpa', section: 'H.1', quote: 'Within thirty (30) days of the date of termination or expiration of the Agreement, Anthropic will: H.1.a. if requested to do so by Customer within that period, return a copy of all Customer Data in its control or possession or provide a self-service functionality allowing Customer to do the same; and H.1.b. delete all copies of Customer Data (including Customer Personal Data) processed by Anthropic or any Subprocessors', reading: 'Return on request, then delete every copy, subprocessors’ included, within 30 days — subject to the exceptions the clause goes on to list for legal retention.' },
  { provider: 'Anthropic', question: 'Subprocessors', doc: 'anthropic-dpa', section: 'C.1', quote: 'Customer grants Anthropic general authorization to engage the Subprocessors listed in Schedule 4', reading: 'General authorization with a published list; objection runs through the DPA’s notice section.' },
  { provider: 'Anthropic', question: 'Security', doc: 'anthropic-dpa', section: 'Schedule 2, E', quote: 'a minimum of AES-256 for data at rest, and TLS1.2+ for data in transit over public networks', reading: 'Encryption stated in the contract’s security schedule, not only on a marketing page.' },
  { provider: 'Anthropic', question: 'Student data', doc: 'anthropic-commercial', section: 'C', quote: 'Data submitted through the Services will be processed in accordance with the Anthropic Data Processing Addendum (“DPA”), which is incorporated into these Terms by reference.', reading: 'The DPA applies with the commercial terms; no FERPA or student-data terms exist for the API.' },
  { provider: 'OpenAI', question: 'Training', doc: 'openai-osa', section: '4.2', quote: 'OpenAI will not use Customer Content to develop or improve the Services, unless Customer explicitly agrees to such use.', reading: 'Contractual: no training on API content without an explicit opt-in.' },
  { provider: 'OpenAI', question: 'Retention', doc: 'openai-your-data', section: 'Types of data stored', quote: 'By default, abuse monitoring logs are generated for all API feature usage and retained for up to 30 days', reading: 'Thirty days by default; zero retention needs OpenAI’s prior approval.' },
  { provider: 'OpenAI', question: 'Breach notice', doc: 'openai-dpa', section: '2.7', quote: 'OpenAI will notify Customer without undue delay after becoming aware of any Personal Data Breach.', reading: 'No fixed window, so nothing shorter than "without undue delay" can be flowed down to an institution.' },
  { provider: 'OpenAI', question: 'Deletion on termination', doc: 'openai-osa', section: '11.3', quote: 'OpenAI will delete all Customer Content from its systems within thirty days', reading: 'Thirty days after termination, unless law requires otherwise or the customer agrees otherwise in writing.' },
  { provider: 'OpenAI', question: 'Subprocessors', doc: 'openai-dpa', section: 'Definitions', quote: '“Sub-Processor List” means the list available at the following address https://platform.openai.com/subprocessors.', reading: 'A published list, named in the contract.' },
  { provider: 'OpenAI', question: 'Security', doc: 'openai-dpa', section: '2.5', quote: 'OpenAI will implement and maintain reasonable and appropriate organizational and technical security measures to protect Customer Data, as set forth in the Agreement.', reading: 'The measures are the Services Agreement’s “Security Measures” (5.1), which OpenAI may update; on written request, once a year, it hands over its latest independent audit reports (5.2). No encryption standard is written into the contract, and whether its listed certifications cover the API is not stated.' },
  { provider: 'OpenAI', question: 'Student data', doc: 'openai-sdpa', section: '1 and 7', quote: 'OpenAI shall be considered a School Official with a legitimate educational interest.', reading: 'A FERPA school-official clause exists, but the agreement takes effect only on "the later of the date OpenAI or Customer sign an Order Form to which this Student DPA is attached", so it does not reach pay-as-you-go API use.' },
];

export type Standing = 'published';

/**
 * Per AI party the subprocessor register names as Semester's or an
 * institution's: what would make the terms apply, and whether it has.
 * Student-directed parties are the student's own contract and are not here.
 */
export const STANDING: readonly { party: string; provider: Provider; standing: Standing; appliesWhen: string; today: string }[] = [
  {
    party: 'Anthropic (Semester’s key)', provider: 'Anthropic', standing: 'published',
    appliesWhen: 'Semester accepts the Commercial Terms by opening an API account under its legal entity; the DPA then applies with them, by reference.',
    today: 'Not in force. The key answered production on 29 September (the kill-switch drill, docs/evidence/ai/) under an account no record names a Customer for, and Semester has no legal entity yet. From its next deploy the claude function serves nobody until docs/trust/SHARED-PROVIDER-ACTIVATION.md is complete.',
  },
  {
    party: 'OpenAI (institution-approved)', provider: 'OpenAI', standing: 'published',
    appliesWhen: 'The institution contracts with OpenAI under the Services Agreement, which carries the DPA; the Student DPA only with a signed Order Form.',
    today: 'Not in force. No institution has enabled the provider, and Semester’s flow-down terms are not written.',
  },
];

/** What only the owner can do, in order. */
export const OWNER_STEPS: readonly string[] = [
  'Form the legal entity that will be the Customer in each agreement.',
  'Before the shared key serves anybody, accept Anthropic’s Commercial Terms under that entity, file the acceptance (or a pointer to it) under docs/evidence/vendors/, and record it in the shared-provider activation record (docs/trust/SHARED-PROVIDER-ACTIVATION.md).',
  'Ask Anthropic whether a FERPA or student-data addendum is available for the API, since none is published.',
  'Before an institution enables OpenAI, ask OpenAI in writing whether its certifications and the Student DPA cover the API, and what an Order Form requires.',
  'Decide whether to request zero data retention from either provider; both grant it by approval only.',
];
