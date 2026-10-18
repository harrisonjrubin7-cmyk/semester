# AI provider terms, as published

<!-- Rendered from app/src/lib/trust/provider-terms.ts by provider-terms.test.ts. Edit the data, then run `npm run registers` from app/. -->

**Nothing on this page is signed.** These are the terms each AI provider publishes, read on 2026-09-29 and quoted word for word, so the [DPA checklist](DPA-CHECKLIST.md) and the [vendor risk register](VENDOR-RISK-REGISTER.md) can say what the terms are rather than that nobody has read them. A published term binds Semester only once Semester accepts it; *Standing* below says what that would take and whether it has happened. The test holds every party to *published* until an executed agreement, or a pointer to one, is filed under `docs/evidence/vendors/`.

## Standing

| Party | Terms apply when | Today |
| --- | --- | --- |
| Anthropic (Semester’s key) | Semester accepts the Commercial Terms by opening an API account under its legal entity; the DPA then applies with them, by reference. | Not in force. The key answered production on 29 September (the kill-switch drill, docs/evidence/ai/) under an account no record names a Customer for, and Semester has no legal entity yet. From its next deploy the claude function serves nobody until docs/trust/SHARED-PROVIDER-ACTIVATION.md is complete. |
| OpenAI (institution-approved) | The institution contracts with OpenAI under the Services Agreement, which carries the DPA; the Student DPA only with a signed Order Form. | Not in force. No institution has enabled the provider, and Semester’s flow-down terms are not written. |

Student-directed parties (a student’s own key) run under the student’s own agreement with the provider and are not recorded here.

## The documents

| Provider | Document | Version | SHA-256 of the copy read |
| --- | --- | --- | --- |
| Anthropic | [Commercial Terms of Service](https://www.anthropic.com/legal/commercial-terms) | Effective June 17, 2025 | web page — effective date instead |
| Anthropic | [Data Processing Addendum](https://www.anthropic.com/legal/data-processing-addendum) | Effective February 24, 2025 | web page — effective date instead |
| Anthropic | [How long do you store my organization’s data?](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data) | Privacy center article, undated | web page — effective date instead |
| OpenAI | [OpenAI Services Agreement](https://cdn.openai.com/osa/openai-services-agreement.pdf) | ONLINE v.010126 | `b93f17c5be5a4deadca42026195d361353619f49756ab74a7b356877cf7ab341` |
| OpenAI | [OpenAI Data Processing Addendum](https://cdn.openai.com/pdf/openai-data-processing-addendum.pdf) | v.010126 | `42309abe1e586665980ff45a83c813f5d6117c6f4ee0cf28f6cecb56c8426393` |
| OpenAI | [OpenAI Student Data Privacy Agreement](https://cdn.openai.com/osa/openai-sdpa.pdf) | Undated PDF | `5af9a58010e2ea2f3643bb9f72e2087b827ca9394735b5627027dc7891a4e762` |
| OpenAI | [Data controls in the OpenAI platform](https://developers.openai.com/api/docs/guides/your-data) | Developer guide, undated | web page — effective date instead |

## Anthropic

| Question | Section | The clause, verbatim | What it means for Semester |
| --- | --- | --- | --- |
| Training | [Commercial Terms of Service](https://www.anthropic.com/legal/commercial-terms) B | “Anthropic may not train models on Customer Content from Services.” | Contractual, not a policy page: API inputs and outputs are not training data. |
| Retention | [How long do you store my organization’s data?](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data) Standard Retention Timeframe | “For Anthropic API users, we automatically delete inputs and outputs on our backend within 30 days of receipt or generation” | Thirty days by default; the same article keeps flagged content up to two years, and zero retention is by agreement only. |
| Breach notice | [Data Processing Addendum](https://www.anthropic.com/legal/data-processing-addendum) G.1 | “Anthropic will notify Customer in writing without undue delay, but in any event within 48 hours, after becoming aware of any Security Breach” | A fixed 48-hour window Semester could flow down to an institution. |
| Deletion on termination | [Data Processing Addendum](https://www.anthropic.com/legal/data-processing-addendum) H.1 | “Within thirty (30) days of the date of termination or expiration of the Agreement, Anthropic will: H.1.a. if requested to do so by Customer within that period, return a copy of all Customer Data in its control or possession or provide a self-service functionality allowing Customer to do the same; and H.1.b. delete all copies of Customer Data (including Customer Personal Data) processed by Anthropic or any Subprocessors” | Return on request, then delete every copy, subprocessors’ included, within 30 days — subject to the exceptions the clause goes on to list for legal retention. |
| Subprocessors | [Data Processing Addendum](https://www.anthropic.com/legal/data-processing-addendum) C.1 | “Customer grants Anthropic general authorization to engage the Subprocessors listed in Schedule 4” | General authorization with a published list; objection runs through the DPA’s notice section. |
| Security | [Data Processing Addendum](https://www.anthropic.com/legal/data-processing-addendum) Schedule 2, E | “a minimum of AES-256 for data at rest, and TLS1.2+ for data in transit over public networks” | Encryption stated in the contract’s security schedule, not only on a marketing page. |
| Student data | [Commercial Terms of Service](https://www.anthropic.com/legal/commercial-terms) C | “Data submitted through the Services will be processed in accordance with the Anthropic Data Processing Addendum (“DPA”), which is incorporated into these Terms by reference.” | The DPA applies with the commercial terms; no FERPA or student-data terms exist for the API. |

## OpenAI

| Question | Section | The clause, verbatim | What it means for Semester |
| --- | --- | --- | --- |
| Training | [OpenAI Services Agreement](https://cdn.openai.com/osa/openai-services-agreement.pdf) 4.2 | “OpenAI will not use Customer Content to develop or improve the Services, unless Customer explicitly agrees to such use.” | Contractual: no training on API content without an explicit opt-in. |
| Retention | [Data controls in the OpenAI platform](https://developers.openai.com/api/docs/guides/your-data) Types of data stored | “By default, abuse monitoring logs are generated for all API feature usage and retained for up to 30 days” | Thirty days by default; zero retention needs OpenAI’s prior approval. |
| Breach notice | [OpenAI Data Processing Addendum](https://cdn.openai.com/pdf/openai-data-processing-addendum.pdf) 2.7 | “OpenAI will notify Customer without undue delay after becoming aware of any Personal Data Breach.” | No fixed window, so nothing shorter than "without undue delay" can be flowed down to an institution. |
| Deletion on termination | [OpenAI Services Agreement](https://cdn.openai.com/osa/openai-services-agreement.pdf) 11.3 | “OpenAI will delete all Customer Content from its systems within thirty days” | Thirty days after termination, unless law requires otherwise or the customer agrees otherwise in writing. |
| Subprocessors | [OpenAI Data Processing Addendum](https://cdn.openai.com/pdf/openai-data-processing-addendum.pdf) Definitions | ““Sub-Processor List” means the list available at the following address https://platform.openai.com/subprocessors.” | A published list, named in the contract. |
| Security | [OpenAI Data Processing Addendum](https://cdn.openai.com/pdf/openai-data-processing-addendum.pdf) 2.5 | “OpenAI will implement and maintain reasonable and appropriate organizational and technical security measures to protect Customer Data, as set forth in the Agreement.” | The measures are the Services Agreement’s “Security Measures” (5.1), which OpenAI may update; on written request, once a year, it hands over its latest independent audit reports (5.2). No encryption standard is written into the contract, and whether its listed certifications cover the API is not stated. |
| Student data | [OpenAI Student Data Privacy Agreement](https://cdn.openai.com/osa/openai-sdpa.pdf) 1 and 7 | “OpenAI shall be considered a School Official with a legitimate educational interest.” | A FERPA school-official clause exists, but the agreement takes effect only on "the later of the date OpenAI or Customer sign an Order Form to which this Student DPA is attached", so it does not reach pay-as-you-go API use. |

## What only the owner can do

1. Form the legal entity that will be the Customer in each agreement.
2. Before the shared key serves anybody, accept Anthropic’s Commercial Terms under that entity, file the acceptance (or a pointer to it) under docs/evidence/vendors/, and record it in the shared-provider activation record (docs/trust/SHARED-PROVIDER-ACTIVATION.md).
3. Ask Anthropic whether a FERPA or student-data addendum is available for the API, since none is published.
4. Before an institution enables OpenAI, ask OpenAI in writing whether its certifications and the Student DPA cover the API, and what an Order Form requires.
5. Decide whether to request zero data retention from either provider; both grant it by approval only.
