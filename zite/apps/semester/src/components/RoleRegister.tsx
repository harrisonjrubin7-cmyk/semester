import { useState } from 'react';
import { Input } from '@project/components/ui/input';
import { FAMILIES, LAYOUTS, RoleState } from '../lib/roleCatalog';

const GLYPH: Record<RoleState, string> = { Built: '✓', Partial: '…', 'Not built': '○' };

export default function RoleRegister() {
  const [q, setQ] = useState('');
  const all = FAMILIES.flatMap((f) => f.roles);
  const count = (s: RoleState) => all.filter((x) => x.state === s).length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-muted-foreground">✓ {count('Built')} built · … {count('Partial')} partial · ○ {count('Not built')} not built. Labels describe experiences; access always comes from memberships and server checks.</p>
        <Input className="w-64" placeholder="Filter roles" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {FAMILIES.map((f) => {
        const rows = f.roles.filter((x) => x.role.toLowerCase().includes(q.toLowerCase()));
        if (!rows.length) return null;
        return (
          <section key={f.id} className="rounded-md border border-border bg-card p-4">
            <p className="eyebrow">{f.id} · {f.label}</p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-widest text-muted-foreground"><th className="py-1">Role</th><th>Layout</th><th>Where</th><th>Access from</th><th>State</th></tr></thead>
                <tbody>{rows.map((x) => (
                  <tr key={x.role} className="border-t border-border align-top">
                    <td className="py-2 pr-3">{x.role}{x.gap && <span className="block text-xs text-muted-foreground">{x.gap}</span>}</td>
                    <td className="pr-3 font-mono text-xs">{x.layout}<span className="block font-sans text-muted-foreground">{LAYOUTS[x.layout.split(/[/→]/)[0]] ?? ''}</span></td>
                    <td className="pr-3 font-mono text-xs">{x.destination ?? '—'}</td>
                    <td className="pr-3 text-xs">{x.grant}</td>
                    <td className="whitespace-nowrap text-xs">{GLYPH[x.state]} {x.state}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
