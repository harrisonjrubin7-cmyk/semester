import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { COMPANY_TENANT, ensureFinSchema, pg } from '../lib/fin';

// Read-only company workspaces. Every figure is a live count from Company OS tables; synthetic (isSample) rows are
// excluded and reported separately. No student records are queried here.
const Fig = z.object({ label: z.string(), value: z.string(), note: z.string().optional() });
const Item = z.object({ title: z.string(), detail: z.string(), to: z.string() });
const WS = z.object({ key: z.string(), title: z.string(), purpose: z.string(), figures: z.array(Fig), attention: z.array(Item), links: z.array(z.tuple([z.string(), z.string()])), gaps: z.array(z.string()) });

const usd = (minor: number) => `$${Math.round(minor / 100).toLocaleString('en-US')}`;
const real = `coalesce("isSample", false) = false`;

export default createEndpoint({
  description: 'Builds live summaries for each company workspace (Executive, Sales, Success, Support, People, Legal, Trust, Engineering, Ops, Board)',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({ workspaces: z.array(WS), sampleRows: z.number(), generatedAt: z.string() }),
  execute: async () => {
    const q = async <T = Record<string, unknown>>(query: string) => (await zite.sql({ query })).rows as T[];
    const one = async (query: string) => Number(Object.values((await q(query))[0] ?? { n: 0 })[0] ?? 0);

    const [deals, openDeals, contracts, projects, tickets, risks, inbound, gates, findings, caps, users, samples, pubs] = await Promise.all([
      q<{ stage: string; n: number; amt: number }>(`SELECT "stage", count(*)::int n, coalesce(sum("amountMinor"),0)::bigint amt FROM "Deals" WHERE ${real} GROUP BY "stage"`),
      q<{ id: string; name: string; stage: string; closeDate: string | null; nextStep: string | null }>(`SELECT id, "name", "stage", "closeDate", "nextStep" FROM "Deals" WHERE ${real} AND "stage" NOT IN ('Won','Lost') ORDER BY "closeDate" NULLS LAST LIMIT 8`),
      q<{ id: string; title: string; state: string; endsOn: string | null; annualValueMinor: number | null }>(`SELECT id, "title", "state", "endsOn", "annualValueMinor" FROM "Contracts" WHERE ${real}`),
      q<{ id: string; name: string; state: string; targetLaunch: string | null }>(`SELECT id, "name", "state", "targetLaunch" FROM "ImplementationProjects" WHERE ${real}`),
      q<{ id: string; subject: string; severity: string; state: string; openedAt: string | null }>(`SELECT id, "subject", "severity", "state", "openedAt" FROM "SupportTickets" WHERE ${real} AND "state" NOT IN ('Resolved','Closed') ORDER BY "severity", "openedAt" LIMIT 50`),
      q<{ id: string; risk: string; likelihood: string; impact: string; status: string }>(`SELECT id, "risk", "likelihood", "impact", "status" FROM "CompanyRisks" WHERE "status" IN ('Open','Mitigating')`),
      q<{ id: string; name: string; kind: string; institution: string; receivedAt: string | null }>(`SELECT id, "name", "kind", "institution", "receivedAt" FROM "InboundRequests" WHERE "status" = 'New' ORDER BY "receivedAt" DESC LIMIT 20`),
      q<{ status: string; n: number }>(`SELECT "status", count(*)::int n FROM "ReleaseGates" GROUP BY "status"`),
      q<{ objectName: string; severity: string; check: string }>(`SELECT "objectName", "severity", "check" FROM "AuditFindings" WHERE "remediation" = 'open' ORDER BY "severity" LIMIT 20`),
      q<{ status: string; n: number }>(`SELECT "status", count(*)::int n FROM "CapabilityRegister" GROUP BY "status"`),
      zite.auth.findAllUsers({ limit: 1 }),
      one(`SELECT (SELECT count(*) FROM "Deals" WHERE "isSample") + (SELECT count(*) FROM "Contracts" WHERE "isSample") + (SELECT count(*) FROM "SupportTickets" WHERE "isSample") + (SELECT count(*) FROM "ImplementationProjects" WHERE "isSample") + (SELECT count(*) FROM "CustomerAccounts" WHERE "isSample") AS n`),
      q<{ status: string; n: number }>(`SELECT "status", count(*)::int n FROM "SitePublications" GROUP BY "status"`),
    ]);

    const by = <T extends { n: number }>(rows: (T & Record<string, unknown>)[], key: string, v: string) => rows.find((r) => r[key] === v)?.n ?? 0;
    // Entitlements live in the finance backend; only reconciled invoices create them.
    await ensureFinSchema();
    const ent = (await pg().query(`SELECT DISTINCT contract_id FROM fin_entitlements WHERE tenant_id = $1 AND status = 'Active'`, [COMPANY_TENANT])) as { contract_id: string }[];
    const entitled = new Set(ent.map((e) => e.contract_id));
    const won = deals.find((d) => d.stage === 'Won');
    const pipeline = deals.filter((d) => !['Won', 'Lost'].includes(d.stage)).reduce((s, d) => s + Number(d.amt), 0);
    const active = contracts.filter((c) => c.state === 'Active');
    const arr = active.reduce((s, c) => s + Number(c.annualValueMinor ?? 0), 0);
    const in90 = Date.now() + 90 * 864e5;
    const renewals = active.filter((c) => c.endsOn && new Date(c.endsOn).getTime() < in90);
    const legalQueue = contracts.filter((c) => ['In Legal Review', 'Out for Signature'].includes(c.state));
    const sev12 = tickets.filter((t) => t.severity === 'Sev 1' || t.severity === 'Sev 2');
    const highRisks = risks.filter((r) => r.likelihood === 'High' || r.impact === 'Critical');
    const stuck = projects.filter((p) => p.state === 'On Hold' || (p.targetLaunch && new Date(p.targetLaunch).getTime() < Date.now() && !['Accepted', 'Activated'].includes(p.state)));
    const gatePending = by(gates, 'status', 'pending'), gateOk = by(gates, 'status', 'satisfied');
    const capTotal = caps.reduce((s, c) => s + c.n, 0);
    const capVerified = caps.filter((c) => /verified|production|pilot/i.test(c.status) && !/unverified/i.test(c.status)).reduce((s, c) => s + c.n, 0);
    const d = (s?: string | null) => (s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'no date');

    const workspaces: z.infer<typeof WS>[] = [
      { key: 'executive', title: 'Executive', purpose: 'One page on revenue, delivery, customers and risk.',
        figures: [{ label: 'Annual contract value', value: usd(arr), note: `${active.length} active contracts` }, { label: 'Open pipeline', value: usd(pipeline) },
          { label: 'Sev 1–2 tickets open', value: String(sev12.length) }, { label: 'High/critical risks', value: String(highRisks.length) }],
        attention: [...highRisks.slice(0, 3).map((r) => ({ title: r.risk, detail: `${r.likelihood} likelihood · ${r.impact} impact · ${r.status}`, to: '/risks' })),
          ...stuck.slice(0, 3).map((p) => ({ title: p.name, detail: `Implementation ${p.state} · target ${d(p.targetLaunch)}`, to: '/implementation' }))],
        links: [['/overview', 'Operations overview'], ['/crm', 'Pipeline'], ['/risks', 'Risk register']], gaps: ['No forecast model or targets yet: figures are counts, not projections.'] },
      { key: 'sales', title: 'Sales & RevOps', purpose: 'Pipeline by stage, deals closing next, inbound leads.',
        figures: [{ label: 'Open pipeline', value: usd(pipeline) }, { label: 'Won', value: usd(Number(won?.amt ?? 0)), note: `${won?.n ?? 0} deals` },
          { label: 'In commercial approval', value: String(by(deals, 'stage', 'Commercial Approval')) }, { label: 'New inbound requests', value: String(inbound.length) }],
        attention: [...openDeals.map((x) => ({ title: x.name, detail: `${x.stage} · closes ${d(x.closeDate)}${x.nextStep ? ` · next: ${x.nextStep}` : ''}`, to: '/deals' })),
          ...inbound.slice(0, 4).map((r) => ({ title: `${r.kind}: ${r.institution || r.name}`, detail: `Received ${d(r.receivedAt)}`, to: '/requests' }))],
        links: [['/deals', 'Deals'], ['/accounts', 'Accounts'], ['/requests', 'Inbound requests']], gaps: [] },
      { key: 'success', title: 'Customer Success', purpose: 'Renewals, launches and customer health.',
        figures: [{ label: 'Active customers', value: String(active.length) }, { label: 'Renewals in 90 days', value: String(renewals.length) },
          { label: 'Launches in progress', value: String(projects.filter((p) => !['Accepted', 'Activated'].includes(p.state)).length) }, { label: 'Activated', value: String(projects.filter((p) => p.state === 'Activated').length) },
          { label: 'Contracts with entitlement', value: `${active.filter((c) => entitled.has(c.id)).length}/${active.length}`, note: 'From reconciled invoices' }],
        attention: [...active.filter((c) => !entitled.has(c.id)).map((c) => ({ title: c.title, detail: 'Active contract with no reconciled invoice — no entitlement yet', to: '/finance' })),
          ...renewals.map((c) => ({ title: c.title, detail: `Ends ${d(c.endsOn)} · ${usd(Number(c.annualValueMinor ?? 0))}/yr${entitled.has(c.id) ? '' : ' · no entitlement'}`, to: '/contracts' })),
          ...stuck.map((p) => ({ title: p.name, detail: `${p.state} · target ${d(p.targetLaunch)}`, to: '/implementation' }))],
        links: [['/implementation', 'Implementation'], ['/contracts', 'Contracts'], ['/support', 'Support']], gaps: ['No health score: needs agreed usage signals, which would come from aggregate, not student-level, data.'] },
      { key: 'support', title: 'Support', purpose: 'Open tickets by severity. Support staff get no standing student access.',
        figures: [{ label: 'Open tickets', value: String(tickets.length) }, { label: 'Sev 1', value: String(tickets.filter((t) => t.severity === 'Sev 1').length) },
          { label: 'Sev 2', value: String(tickets.filter((t) => t.severity === 'Sev 2').length) }, { label: 'Waiting on customer', value: String(tickets.filter((t) => t.state === 'Waiting on Customer').length) }],
        attention: tickets.slice(0, 8).map((t) => ({ title: t.subject, detail: `${t.severity} · ${t.state} · opened ${d(t.openedAt)}`, to: '/support' })),
        links: [['/support', 'All tickets']], gaps: ['Time-limited support elevation into a tenant is not built (workbook review REV-008).'] },
      { key: 'people', title: 'People', purpose: 'Who works in the workspace and which company roles they hold.',
        figures: [{ label: 'Workspace users', value: String(users.total) }, { label: 'Finance roles', value: 'Server-held', note: 'Granted only with founder approval' }],
        attention: [], links: [['/finance', 'Invoices & approvals']], gaps: ['No HR records (hiring, compensation, reviews) are stored. That data needs its own restricted area and your approval before it exists.'] },
      { key: 'legal', title: 'Legal & Privacy', purpose: 'Contracts in review or out for signature, and expiring terms.',
        figures: [{ label: 'In legal review', value: String(contracts.filter((c) => c.state === 'In Legal Review').length) },
          { label: 'Out for signature', value: String(contracts.filter((c) => c.state === 'Out for Signature').length) }, { label: 'Expiring in 90 days', value: String(renewals.length) }],
        attention: legalQueue.map((c) => ({ title: c.title, detail: c.state, to: '/contracts' })),
        links: [['/contracts', 'Contracts']], gaps: ['Terms of Service, Privacy Policy and DPA are drafts under counsel review.'] },
      { key: 'trust', title: 'Trust', purpose: 'Capabilities by verified status, open risks and public claims.',
        figures: [{ label: 'Capabilities tracked', value: String(capTotal) }, { label: 'Verified or beyond', value: String(capVerified) },
          { label: 'Open risks', value: String(risks.length) }, { label: 'Published posts', value: String(by(pubs, 'status', 'Published')), note: `${by(pubs, 'status', 'In review')} in review` }],
        attention: highRisks.map((r) => ({ title: r.risk, detail: `${r.impact} impact · ${r.status}`, to: '/risks' })),
        links: [['/evidence', 'Release evidence'], ['/publications', 'Site publications'], ['/risks', 'Risk register']], gaps: [] },
      { key: 'engineering', title: 'Engineering & Platform', purpose: 'Release gates and open security findings from the Security Lab.',
        figures: [{ label: 'Release gates satisfied', value: `${gateOk}/${gateOk + gatePending + by(gates, 'status', 'rejected')}` }, { label: 'Gates pending', value: String(gatePending) },
          { label: 'Open findings', value: String(findings.length) }, { label: 'Critical findings', value: String(findings.filter((f) => f.severity === 'critical').length) }],
        attention: findings.slice(0, 8).map((f) => ({ title: f.objectName, detail: `${f.severity} · ${f.check}`, to: '/evidence' })),
        links: [['/evidence', 'Release evidence'], ['/simulator', 'Simulator']], gaps: ['No deploy controls here: releases need your explicit approval.'] },
      { key: 'ops', title: 'Operations', purpose: 'Inbound requests and work waiting on someone.',
        figures: [{ label: 'New requests', value: String(inbound.length) }, { label: 'Posts awaiting review', value: String(by(pubs, 'status', 'In review')) },
          { label: 'Contracts awaiting signature', value: String(contracts.filter((c) => c.state === 'Out for Signature').length) }],
        attention: inbound.map((r) => ({ title: `${r.kind}: ${r.name}`, detail: `${r.institution || 'no institution'} · ${d(r.receivedAt)}`, to: '/requests' })),
        links: [['/requests', 'Inbound requests'], ['/publications', 'Site publications']], gaps: [] },
      { key: 'board', title: 'Board', purpose: 'Read-only snapshot for board members. Nothing here can be changed.',
        figures: [{ label: 'Annual contract value', value: usd(arr) }, { label: 'Customers', value: String(active.length) },
          { label: 'Capabilities verified', value: `${capVerified}/${capTotal}` }, { label: 'High/critical risks', value: String(highRisks.length) }],
        attention: highRisks.map((r) => ({ title: r.risk, detail: `${r.impact} impact · ${r.status}`, to: '/risks' })),
        links: [], gaps: ['Approved board snapshots (period close → reviewed statements) are not built.'] },
    ];
    return { workspaces, sampleRows: samples, generatedAt: new Date().toISOString() };
  },
});
