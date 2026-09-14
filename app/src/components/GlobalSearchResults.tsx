import {useState} from 'react';
import {spelled, type Hit, type HitGroup} from '../lib/find';
import {hitKey} from '../lib/openhit';

export function GlobalSearchResults({query,groups,onOpen,onNewTab,canOpenTab=true}:{query:string;groups:HitGroup[];canOpenTab?:boolean;onOpen:(hit:Hit)=>void;onNewTab:(hit:Hit)=>void}) {
  const [filter,setFilter]=useState('All');
  const active=groups.some(g=>g.label===filter)?filter:'All';
  const shown=active==='All'?groups:groups.filter(g=>g.label===active);
  const total=shown.reduce((n,g)=>n+g.hits.length,0);
  return <>
    {!query.trim()?<p>Use the search bar above to find courses, assignments, study materials, notes, files and apps.</p>:<>
      <div className="g-filters" role="group" aria-label="Filter search results">
        {['All',...groups.map(g=>g.label)].map(label=><button key={label} aria-pressed={active===label} className={active===label?'selected':''} onClick={()=>setFilter(label)}>{label}</button>)}
      </div>
      {!canOpenTab&&<p role="status">Your tab bar is full. Close a tab to open a result separately, or select the result to use this tab.</p>}
      <p className="g-results-count" role="status">{total} {total===1?'result':'results'} for “{query}”{spelled(groups)?' · includes spelling suggestions':''}</p>
      {shown.map(group=><section key={group.label} aria-label={group.label}>
        <h2>{group.label}</h2>
        {group.hits.map(hit=><article key={hitKey(hit)} className="g-full-result">
          <button className="g-result-open" onClick={()=>onOpen(hit)}><strong>{hit.title}</strong><span>{hit.sub}</span><small>{hit.tag}</small></button>
          <button className="g-result-new" disabled={!canOpenTab} title={canOpenTab?'Open in a new tab':'Close a tab before opening another'} aria-label={`Open ${hit.title} in a new tab`} onClick={()=>onNewTab(hit)}>↗</button>
        </article>)}
      </section>)}
      {!total&&<p>No matches found. Try a course code, file title or another keyword.</p>}
    </>}
  </>;
}
