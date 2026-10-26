import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleDashed, PlugZap } from "lucide-react";
import { PlatformShell } from "@/components/platform-shell";
import { getPlatformDomain, platformDomains } from "@/lib/platform-registry";

const stateMeta = {
  live: { label: "Live", icon: CheckCircle2 },
  connected: { label: "Connected interface", icon: PlugZap },
  foundation: { label: "Foundation", icon: CircleDashed },
};

export function generateStaticParams() {
  return platformDomains.map((domain) => ({ domain: domain.slug }));
}

export default async function DomainPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain: slug } = await params;
  const domain = getPlatformDomain(slug);
  if (!domain) notFound();
  const Icon = domain.icon;

  return (
    <PlatformShell current={domain.slug}>
      <Link href="/os" className="back-link"><ArrowLeft size={16} /> All domains</Link>
      <header className="domain-header">
        <div className="domain-icon"><Icon size={28} aria-hidden="true" /></div>
        <div><p className="kicker">{domain.audience}</p><h1>{domain.name}</h1><p className="os-lede">{domain.description}</p></div>
      </header>
      <section className="capability-list" aria-labelledby="capability-title">
        <div className="section-heading"><div><p className="kicker">Domain registry</p><h2 id="capability-title">Capabilities</h2></div><p>Implementation state is evidence-based, not aspirational.</p></div>
        {domain.capabilities.map((capability) => {
          const meta = stateMeta[capability.state];
          const StateIcon = meta.icon;
          const content = (
            <>
              <div><h3>{capability.name}</h3><p>{capability.description}</p></div>
              <span className={`capability-state state-${capability.state}`}><StateIcon size={15} /> {meta.label}</span>
              {capability.href && <ArrowRight size={18} aria-hidden="true" />}
            </>
          );
          return capability.href ? <Link className="capability-row" href={capability.href} key={capability.name}>{content}</Link> : <article className="capability-row" key={capability.name}>{content}</article>;
        })}
      </section>
    </PlatformShell>
  );
}
