import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleDashed, PlugZap } from "lucide-react";
import { PlatformShell } from "@/components/platform-shell";
import { capabilityCounts, platformDomains } from "@/lib/platform-registry";

const stateMeta = {
  live: { label: "Live in repository", icon: CheckCircle2 },
  connected: { label: "Interface connected", icon: PlugZap },
  foundation: { label: "Foundation defined", icon: CircleDashed },
};

export default function PlatformHome() {
  return (
    <PlatformShell>
      <header className="os-page-header">
        <div>
          <p className="kicker">System home</p>
          <h1>One operating system for the entire semester.</h1>
          <p className="os-lede">Learning, institutional operations, people, governance, and the company itself share one platform contract. Every capability has an owner, state, and route—nothing disappears into a deck.</p>
        </div>
        <div className="readiness-panel" aria-label="Platform implementation status">
          <span><strong>{capabilityCounts.live}</strong> live</span>
          <span><strong>{capabilityCounts.connected}</strong> connected</span>
          <span><strong>{capabilityCounts.foundation}</strong> foundations</span>
        </div>
      </header>

      <section className="domain-grid" aria-labelledby="domains-title">
        <div className="section-heading"><div><p className="kicker">Platform map</p><h2 id="domains-title">Connected domains</h2></div><p>{platformDomains.length} domains · {platformDomains.flatMap((domain) => domain.capabilities).length} registered capabilities</p></div>
        {platformDomains.map((domain, index) => {
          const Icon = domain.icon;
          const liveCount = domain.capabilities.filter((capability) => capability.state === "live").length;
          const connectedCount = domain.capabilities.filter((capability) => capability.state === "connected").length;
          return (
            <Link className="domain-card" href={`/os/${domain.slug}`} key={domain.slug}>
              <div className="domain-card-top"><span className="domain-number nums">{String(index + 1).padStart(2, "0")}</span><Icon size={20} aria-hidden="true" /></div>
              <div><p className="kicker">{domain.audience}</p><h3>{domain.name}</h3><p>{domain.description}</p></div>
              <div className="domain-card-footer"><span>{liveCount ? `${liveCount} live` : connectedCount ? `${connectedCount} connected` : "Foundation mapped"}</span><ArrowRight size={17} aria-hidden="true" /></div>
            </Link>
          );
        })}
      </section>

      <section className="status-legend" aria-label="Capability state definitions">
        {Object.entries(stateMeta).map(([state, meta]) => {
          const Icon = meta.icon;
          return <div key={state}><Icon size={18} /><span><strong>{meta.label}</strong><small>{state === "live" ? "Implemented and routed in this repository." : state === "connected" ? "Represented in the shared shell; service integration remains." : "Design and contract exist; implementation remains."}</small></span></div>;
        })}
      </section>
    </PlatformShell>
  );
}
