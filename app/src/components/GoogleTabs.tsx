import { useCallback, useEffect, useRef, useState } from 'react';
import {hasOpenModal} from '../a11y/modal';
import { useStore } from '../state/store';
import { closeTab, openTab, openInNew, pickTab, useStrip, known, lastClosed, reopenClosed } from '../lib/browser.hook';
import { MAX_TABS, type AppTab } from '../lib/browser';
import { GROUP_COLORS, readOrganizer, samePlace } from '../lib/taborganizer';
import { TabGlyph } from './TabIcon';
import { Plus, Search, StarIcon } from './Icons';
const KEY='semester.google.tab-organizer.v1';

export function GoogleTabs({onNavigate,menuOpen,onMenuChange}: {onNavigate:()=>void;menuOpen?:boolean;onMenuChange?:(open:boolean)=>void}) {
  const {dispatch} = useStore();
  const strip = useStrip();
  const [organizer,setOrganizer]=useState(()=>{try{return readOrganizer(localStorage.getItem(KEY),known);}catch{return readOrganizer(null,known);}});
  const [localMenu,setLocalMenu]=useState(false);
  const menu=menuOpen??localMenu;
  const setMenu=useCallback((open:boolean)=>{if(onMenuChange)onMenuChange(open);else setLocalMenu(open);},[onMenuChange]);
  const [name,setName]=useState('');
  const [color,setColor]=useState(GROUP_COLORS[0]);
  const [notice,setNotice]=useState('');
  const panel=useRef<HTMLDivElement>(null);
  const current=strip.tabs[strip.at];
  const tabRow=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const reveal=()=>tabRow.current?.querySelector('.g-browser-tab.active')?.scrollIntoView?.({block:'nearest',inline:'nearest'});
    reveal();window.addEventListener('resize',reveal);
    return()=>window.removeEventListener('resize',reveal);
  },[strip.at,strip.tabs.length,organizer.groups,organizer.membership]);
  useEffect(()=>{setOrganizer(old=>old.bookmarks.some(b=>samePlace(b,current)&&b.title!==current.title)?{...old,bookmarks:old.bookmarks.map(b=>samePlace(b,current)?{...b,title:current.title}:b)}:old);},[current]);
  const closedTab=lastClosed();
  const restoreClosed=()=>{const tab=reopenClosed();if(tab)land(tab);};
  const starred=organizer.bookmarks.some(b=>samePlace(b,current));
  useEffect(()=>{try{localStorage.setItem(KEY,JSON.stringify(organizer));}catch{setNotice('Tab organization is available for this visit; browser storage is unavailable.');}},[organizer]);
  const land = (tab: AppTab) => {
    onNavigate();setMenu(false);
    if(tab.screen && tab.place.length) for(const action of tab.place) dispatch(action);
    else dispatch({type:'go',screen:'search'});
  };
  const create = () => { if(strip.tabs.length>=MAX_TABS)return; openTab();setMenu(false); onNavigate(); dispatch({type:'go',screen:'search'}); };
  const bookmark=()=>setOrganizer(old=>({...old,bookmarks:starred?old.bookmarks.filter(b=>!samePlace(b,current)):[...old.bookmarks,{...current,id:crypto.randomUUID()}]}));
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{if(hasOpenModal() || (e.target as HTMLElement)?.closest?.('input,textarea,select,[contenteditable="true"]'))return;if(e.altKey && e.shiftKey && e.code==='KeyT'){e.preventDefault();restoreClosed();return;}if(e.altKey && !e.shiftKey && (e.code==='KeyT'||e.key.toLowerCase()==='t')){e.preventDefault();create();}if(e.altKey && !e.shiftKey && (e.code==='KeyB'||e.key.toLowerCase()==='b')){e.preventDefault();setMenu(!menu);}};
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  });
  useEffect(()=>{
    if(!menu)return;
    const close=(e:PointerEvent)=>{if(!panel.current?.contains(e.target as Node))setMenu(false);};
    const esc=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();setMenu(false);}};
    document.addEventListener('pointerdown',close);document.addEventListener('keydown',esc,true);
    return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',esc,true);};
  },[menu,setMenu]);
  const drawn=new Set<string>();
  const tabNode=(tab:AppTab,i:number,groupColor?:string)=>{
    const title=tab.screen==='search'?'New tab':tab.title||'New tab';
    return <div className={`g-browser-tab ${i===strip.at?'active':''}`} style={groupColor?{borderBottom:`3px solid ${groupColor}`}:undefined} key={tab.id}><button className="g-tab-select" aria-current={i===strip.at?'page':undefined} onClick={()=>land(pickTab(i))} title={title}>{tab.screen&&tab.screen!=='search'?<TabGlyph screen={tab.screen} size={16}/>:<Search size={16}/>}<span>{title}</span></button><button className="g-tab-close" aria-label={`Close tab: ${title}`} onClick={()=>{const next=closeTab(i);if(i===strip.at)land(next);}}>×</button></div>;
  };
  return <><nav className="g-browser-tabs" aria-label="Open app tabs"><div className="g-tab-scroll" ref={tabRow}>{strip.tabs.map((tab,i)=>{
    const group=organizer.groups.find(g=>g.id===organizer.membership[tab.id]);
    if(!group)return tabNode(tab,i);
    if(drawn.has(group.id))return null;drawn.add(group.id);
    const members=strip.tabs.map((t,n)=>({t,n})).filter(({t})=>organizer.membership[t.id]===group.id);
    return <div className="g-tab-group" key={group.id}><button className="g-group-label" style={{background:group.color}} aria-label={`${group.collapsed?'Expand':'Collapse'} group ${group.name}`} aria-expanded={!group.collapsed} onClick={()=>setOrganizer(o=>({...o,groups:o.groups.map(g=>g.id===group.id?{...g,collapsed:!g.collapsed}:g)}))}>{group.name} <small>{members.length}</small></button>{members.filter(({n})=>!group.collapsed||n===strip.at).map(({t,n})=>tabNode(t,n,group.color))}</div>;
  })}</div><button className="g-add-tab" aria-label="Add new tab" title={strip.tabs.length>=MAX_TABS?`Close a tab before opening another (${MAX_TABS} open)`:'New tab (Alt+T)'} disabled={strip.tabs.length>=MAX_TABS} onClick={create}><Plus size={20}/></button>
  <div className="g-tab-organizer" ref={panel}><button className="g-add-tab" aria-label="Bookmarks and tab groups" aria-expanded={menu} title="Bookmarks and tab groups (Alt+B)" onClick={()=>setMenu(!menu)}><StarIcon size={19} on={starred}/></button>{menu&&<section className="g-organizer-panel" aria-label="Bookmarks and tab groups"><h2>Bookmarks & tab groups</h2><button className="g-organizer-save" onClick={bookmark}>{starred?'★ Remove this bookmark':'☆ Bookmark this tab'}</button><label>Group for this tab<select value={organizer.membership[current.id]||''} onChange={e=>setOrganizer(o=>({...o,membership:{...o.membership,[current.id]:e.target.value}}))}><option value="">Ungrouped</option>{organizer.groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label><form onSubmit={e=>{e.preventDefault();if(!name.trim())return;const id=crypto.randomUUID();setOrganizer(o=>({...o,groups:[...o.groups,{id,name:name.trim(),color,collapsed:false}],membership:{...o.membership,[current.id]:id}}));setName('');}}><label>New group<input aria-label="New tab group name" maxLength={40} placeholder="e.g. Fall semester" value={name} onChange={e=>setName(e.target.value)}/></label><div className="g-group-colors">{GROUP_COLORS.map(c=><button key={c} type="button" style={{background:c}} aria-label={`Group color ${c}`} aria-pressed={color===c} onClick={()=>setColor(c)}/>)}</div><button type="submit" disabled={!name.trim()}>Create group</button></form>{organizer.groups.length>0&&<details><summary>Manage groups</summary>{organizer.groups.map(g=><div className="g-bookmark-row" key={g.id}><input aria-label={`Rename group ${g.name}`} value={g.name} maxLength={40} onBlur={()=>setOrganizer(o=>({...o,groups:o.groups.map(x=>x.id===g.id&&!x.name.trim()?{...x,name:'Untitled group'}:x)}))} onChange={e=>setOrganizer(o=>({...o,groups:o.groups.map(x=>x.id===g.id?{...x,name:e.target.value}:x)}))}/><button aria-label={`Remove group ${g.name}`} onClick={()=>setOrganizer(o=>({...o,groups:o.groups.filter(x=>x.id!==g.id),membership:Object.fromEntries(Object.entries(o.membership).filter(([,v])=>v!==g.id))}))}>×</button></div>)}</details>}<h3>Recently closed</h3><button className="g-organizer-save" disabled={!closedTab||strip.tabs.length>=MAX_TABS} onClick={restoreClosed}>{closedTab?`Reopen ${closedTab.title||'New tab'}`:'No closed tabs this visit'}</button><p>Reopen last closed: Alt + Shift + T. New tab: Alt + T.</p>{strip.tabs.length>=MAX_TABS&&<p role="status">All {MAX_TABS} tabs are in use. Close one to open or restore another.</p>}<h3>Saved bookmarks</h3>{!organizer.bookmarks.length&&<p>Bookmark a course, document, or any screen to reopen it later.</p>}{organizer.bookmarks.map(b=><div className="g-bookmark-row" key={b.id}><button disabled={strip.tabs.length>=MAX_TABS} onClick={()=>{if(openInNew(b.screen||'search',b.title,b.place,b.query))land(b);}}>{b.title || 'New tab'} <small>↗</small></button><button aria-label={`Remove bookmark ${b.title}`} onClick={()=>setOrganizer(o=>({...o,bookmarks:o.bookmarks.filter(x=>x.id!==b.id)}))}>×</button></div>)}<p>Bookmarks open in a new tab. Groups organize tabs on this device.</p>{notice&&<p role="status">{notice}</p>}</section>}</div></nav></>;
}
