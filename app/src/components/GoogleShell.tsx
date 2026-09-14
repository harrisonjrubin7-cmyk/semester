import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useStore } from '../state/store';
import { currentLook } from '../state/shape';
import { appShelves } from '../lib/apps';
import { destination, GROUPS, lately, type Destination } from '../lib/nav';
import { readFavourites, toggleFavourite } from '../lib/desk';
import { ground, resolveGround } from '../lib/look';
import { usePrefersDark } from '../lib/prefers';
import type { Screen } from '../lib/types';
import { TabGlyph } from './TabIcon';
import { AppsIcon, Search, Plus, Check, ChevronLeft, Bell } from './Icons';
import './google-shell.css';
/* The audited tree also imported its `workspace.css` here. Those rules live
   in `styles/features.css` in this app, loaded once from `main.tsx` — they
   are the ported screens' own styling and are not this shell's to carry. */
import { hasOpenModal, useModal } from '../a11y/modal';
import { WIDE, useMedia } from '../lib/media';
import { GoogleTabs } from './GoogleTabs';
import { findEverything, type Hit } from '../lib/find';
import { actionsFor, hitKey, landingOf } from '../lib/openhit';
import { recordSearch, here, openInNew, useStrip } from '../lib/browser.hook';
import {MAX_TABS} from '../lib/browser';
import {ModernShellContext} from './shell-context';
import {GlobalSearchResults} from './GlobalSearchResults';

const COLORS = ['#4285f4', '#34a853', '#ea4335', '#f9ab00', '#8e63ce', '#00a6a6', '#e871b3'];

/*
 * The two grounds this shell's Appearance switch moves between, which are the
 * app's own rather than a theme of this file's invention. Same pair, same
 * reasoning, as `components/desk/Customize.tsx`: somebody who has chosen
 * Oxide or Fog keeps it, and pressing the side they are already on is not a
 * move. See the note over the panel below.
 */
const DARK = 'ink';
const LIGHT = 'paper';
function label(app: Destination) { return app.screen === 'ask' ? 'AI Tutor' : app.screen === 'import' ? 'Add a course' : app.short ?? app.label; }
export function AppBadge({ app, small = false }: { app: Destination; small?: boolean }) {
  const color = COLORS[GROUPS.indexOf(app.group)] ?? COLORS[0];
  return <span className={`g-app-badge ${small ? 'small' : ''}`} style={{ '--badge-color': color } as React.CSSProperties}><TabGlyph screen={app.screen} size={small ? 22 : 29} /></span>;
}

export function GoogleShell({ children, title }: { children: ReactNode; title: string }) {
  const { state, dispatch, school, catalog, now } = useStore();
  /*
   * Every preference on this shell is a look key, read and written the way
   * every other surface reads and writes it.
   *
   * It used to keep its own: four values under `semester.google.*` in
   * `localStorage`, with a private `usePreference` hook to hold them. That is
   * the failure `components/desk/Customize.tsx` names in its own opening
   * paragraph — a panel grown until it is a second settings screen, at which
   * point there are two that disagree — and here it had already happened four
   * times over. Shortcuts pinned in this shell were invisible to the search
   * home, to the launcher and to the sidebar on every other navigation; the
   * Appearance switch moved a CSS class on one `<div>` and left the app's
   * actual ground alone, so Settings → Look and this panel each believed they
   * owned light and dark; and none of it reached the account, because a look
   * key syncs and a private `localStorage` key does not.
   *
   * The shell is one of the navigations in `lib/chrome.ts`, not a second app.
   * Choosing it is a setting, so what a student arranges inside it has to be
   * the same arrangement they left everywhere else.
   */
  const look = currentLook(state);
  const caps = school.capabilities;
  // `groupOrder` and the role for the same reason: this grid must not hold a
  // different set of apps, in a different order, from the launcher's.
  const apps = useMemo(
    () => appShelves(caps, look.groupOrder, state.role).flatMap(s => s.apps),
    [caps, look.groupOrder, state.role],
  );
  /*
   * Resolved, because "Match my device" is an instruction rather than a
   * palette and the switch below has to show which side it currently lands
   * on. Exactly what `desk/Customize.tsx` does with the same three calls.
   */
  const prefersDark = usePrefersDark();
  const lightHome = ground(resolveGround(look.ground, prefersDark)).light;
  const setLightHome = (on: boolean) =>
    dispatch({ type: 'setLook', look: { ground: on ? LIGHT : DARK } });
  // Resolved against the registry and both gates, so a stale name, a screen
  // this school has switched off and a screen this role is not offered all
  // drop out rather than drawing a dead tile. `lib/desk.ts` owns that rule.
  const favoriteApps = readFavourites(look.favourites, caps, state.role);
  const pinned = new Set<Screen>(favoriteApps.map(d => d.screen));
  const showFavorites = look.shortcuts !== 'off';
  const setShowFavorites = (on: boolean) =>
    dispatch({ type: 'setLook', look: { shortcuts: on ? 'on' : 'off' } });
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [activeSearch, setActiveSearch] = useState<'top'|'home'>('top');
  const [selected, setSelected] = useState(-1);
  const tabs=useStrip();
  const canOpenTab=tabs.tabs.length<MAX_TABS;
  const [launcher, setLauncher] = useState(false);
  const [organizerOpen,setOrganizerOpen]=useState(false);
  const [customize, setCustomize] = useState(false);
  const [editing, setEditing] = useState(false);
  const [directory, setDirectory] = useState(false);
  const [group, setGroup] = useState('All apps');
  const [grid, setGrid] = useState(false);
  const [classic, setClassic] = useState(false);
  /* The top field is about 200px on a phone, where the long prompt is cut
     off mid-word. 760px is the shell's own breakpoint — see the media
     query in `google-shell.css` — so the two agree about what narrow is. */
  const roomy = useMedia(WIDE);
  const searchRef = useRef<HTMLInputElement>(null);
  const homeSearchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setLauncher(false); setFocused(false); setCustomize(false); setOrganizerOpen(false); setQuery('');
  }, [state.screen]);
  const customizeModal = useModal<HTMLElement>({ on: customize, onClose: () => setCustomize(false) });
  const launcherRef = useRef<HTMLDivElement>(null);
  const home = state.screen === 'search';
  const homePage = home && !directory && !state.finder;
  useEffect(()=>{if(!classic && state.finder){setOrganizerOpen(false);setQuery(here().query??'');setDirectory(false);setFocused(false);setLauncher(false);setCustomize(false);setActiveSearch('top');searchRef.current?.focus();}},[state.finder,classic]);
  useEffect(()=>{if(!classic && state.apps){dispatch({type:'apps',open:false});setLauncher(true);setOrganizerOpen(false);setFocused(false);setCustomize(false);}},[state.apps,classic,dispatch]);
  useEffect(()=>{if(state.quickAdd){setFocused(false);setLauncher(false);setOrganizerOpen(false);setCustomize(false);}},[state.quickAdd]);
  const productivity = ['write','sheet','deck','mine','mail','classmates','call','draw','courses','course','study','degree','yes','housing','meals','maps','activities','work','university','create','athletics','career','family','pathway'].includes(state.screen);
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = apps.filter(a => terms.every(t => `${a.label} ${a.short ?? ''} ${a.blurb} ${a.keywords} ${a.group}`.toLowerCase().includes(t))).sort((a,b) => Number(b.label.toLowerCase().startsWith(query.toLowerCase())) - Number(a.label.toLowerCase().startsWith(query.toLowerCase())));
  /*
   * Where you have actually been, which this shell used to guess at.
   *
   * It kept its own list, appended inside its own `go` — so anything that
   * moved the app another way (the tab strip, a link, Back, opening a search
   * result) was missed, and "Recently opened" was really "recently opened
   * from this one menu". `state.recent` is maintained in `push`, the single
   * funnel every route in the app goes through, and `lately` filters it
   * through the same gates as everything else. The comment over `remember`
   * in `state/slices/navigate.ts` already warned against exactly this.
   */
  const recent = lately(state.recent, [], caps, [], 6, state.role);
  const suggested = (recent.length ? recent : favoriteApps).slice(0,6);
  const found = useMemo(()=>query.trim()?findEverything(catalog,now,query,state.notes,state.tasks,school.capabilities,state.updates,state.reviews,state.appointments,{documents:state.documents,sheets:state.sheets,decks:state.decks},state.role):[],[catalog,now,query,state.notes,state.tasks,school.capabilities,state.updates,state.reviews,state.appointments,state.documents,state.sheets,state.decks,state.role]);
  const records = found.flatMap(g=>g.hits).filter(h=>h.kind!=='screen').sort((a,b)=>b.score-a.score).slice(0,5);
  const options = query.trim() ? matches.slice(0,records.length?3:6) : suggested;
  const optionCount=options.length+records.length;
  const current = destination(state.screen);
  const go = (screen: Screen) => {
    dispatch({type:'finder',open:false}); dispatch({ type: 'go', screen }); setDirectory(false); setQuery(''); setFocused(false); setLauncher(false); setCustomize(false); setSelected(-1);
    // Nothing to remember here: `go` dispatches, and the reducer's `push` is
    // what records where you have been, for every route rather than this one.
  };
  const openRecord=(hit:Hit)=>{dispatch({type:'finder',open:false});setDirectory(false);setFocused(false);setLauncher(false);setQuery('');for(const action of actionsFor(hit))dispatch(action);};
  const openRecordInNew=(hit:Hit)=>{if(openInNew(landingOf(hit),hit.title,actionsFor(hit),query))openRecord(hit);};
  const searchAll=()=>{recordSearch(query);setFocused(false);setLauncher(false);dispatch({type:'finder',open:true});};
  const toggleFavorite = (screen: Screen) =>
    dispatch({
      type: 'setLook',
      look: { favourites: toggleFavourite(look.favourites, screen, caps, state.role) },
    });
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if(classic || hasOpenModal())return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); e.stopImmediatePropagation(); dispatch({type:'finder',open:false}); setLauncher(false);setOrganizerOpen(false);setActiveSearch('top'); searchRef.current?.focus(); setFocused(true); }
      if (e.key === 'Escape' && (focused || launcher || customize || state.finder)) { e.preventDefault(); e.stopImmediatePropagation(); dispatch({type:'finder',open:false}); setFocused(false); setLauncher(false); setCustomize(false); }
    };
    document.addEventListener('keydown',key,true);
    return () => document.removeEventListener('keydown',key,true);
  }, [focused, launcher, customize, state.finder, dispatch,classic]);
  useEffect(() => { if (home) document.title = directory ? 'Apps · Semester' : 'Semester'; }, [home, directory]);
  useEffect(() => {
    const click = (e: PointerEvent) => { if (launcherRef.current && !launcherRef.current.contains(e.target as Node)) setLauncher(false); };
    document.addEventListener('pointerdown',click); return () => document.removeEventListener('pointerdown',click);
  },[]);
  useEffect(() => {
    type Tool = { name: string; title: string; description: string; inputSchema: object; annotations: {readOnlyHint: boolean}; execute: (input: unknown) => unknown };
    const context = (document as Document & { modelContext?: {registerTool: (tool: Tool, options: {signal: AbortSignal}) => void | Promise<void>} }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: Tool) => { try { Promise.resolve(context.registerTool(tool, {signal:lifecycle.signal})).catch(() => {}); } catch { /* Optional browser API. */ } };
    register({name:'search_semester_apps',title:'Search Semester apps',description:'Find apps by name, category, or capability.',inputSchema:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false},annotations:{readOnlyHint:true},execute(input){
      if(!input || typeof input!=='object' || !('query' in input) || typeof input.query!=='string') throw new Error('A text query is required.');
      const terms = input.query.toLowerCase().trim().split(/\s+/).filter(Boolean);
      return apps.filter(a=>terms.every(t=>`${a.label} ${a.short??''} ${a.blurb} ${a.keywords} ${a.group}`.toLowerCase().includes(t))).map(a=>({screen:a.screen,name:label(a),category:a.group,description:a.blurb}));
    }});
    register({name:'open_semester_app',title:'Open a Semester app',description:'Navigate to an app found in the Semester directory. This opens the tool without submitting forms or changing academic records.',inputSchema:{type:'object',properties:{screen:{type:'string'}},required:['screen'],additionalProperties:false},annotations:{readOnlyHint:false},async execute(input){
      if(!input || typeof input!=='object' || !('screen' in input) || typeof input.screen!=='string') throw new Error('An app screen is required.');
      const app=apps.find(a=>a.screen===input.screen); if(!app) throw new Error('Unknown Semester app.');
      go(app.screen); await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))); return {opened:app.screen,name:label(app)};
    }});
    return ()=>lifecycle.abort();
  // Registration follows the actual app registry. Navigation uses stable store actions.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[apps,dispatch]);
  const showDirectory = () => { dispatch({type:'finder',open:false}); dispatch({type:'go',screen:'search'}); setDirectory(true); setFocused(false); setLauncher(false); setGroup('All apps'); };
  const searchBox = (placement: 'top'|'home') => <div className={`g-search-wrap ${placement==='top'?'g-omnibox':'g-central-search'} ${placement==='home' && (launcher || customize || state.finder || state.quickAdd || (focused && activeSearch==='top'))?'is-suppressed':''} ${focused && activeSearch===placement ? 'is-open' : ''}`}>
    <form className="g-search" onSubmit={e => {e.preventDefault(); query.trim()?searchAll():showDirectory();}} role="search">
      {placement==='home' ? <button type="button" className="g-icon g-plus" aria-label="Add a task or appointment" onClick={() => {dispatch({type:'finder',open:false});dispatch({type:'quickAdd',open:true});}}><Plus size={24}/></button> : <Search size={23}/>}
      <input ref={placement==='top'?searchRef:homeSearchRef} aria-label={placement==='top'?'Search Semester':'Search your semester'} aria-expanded={focused && activeSearch===placement} aria-controls={`semester-search-results-${placement}`} aria-activedescendant={focused && activeSearch===placement && selected>=0 && selected<optionCount ? `g-option-${placement}-${selected}` : undefined} role="combobox" autoComplete="off" placeholder={placement==='home' ? 'Search your semester' : roomy ? 'Search apps, courses, assignments and files' : 'Search Semester'} value={query} onFocus={() => {setLauncher(false);setOrganizerOpen(false);setActiveSearch(placement);setSelected(-1);setFocused(!state.finder);}} onChange={e=>{setQuery(e.target.value);if(state.finder)recordSearch(e.target.value);setSelected(-1);setFocused(!state.finder);}} onKeyDown={e=>{
        if(e.key==='ArrowDown'){e.preventDefault();setSelected(n=>optionCount?Math.min(n+1,optionCount-1):-1);}
        if(e.key==='ArrowUp'){e.preventDefault();setSelected(n=>optionCount?(n<=0?optionCount-1:n-1):-1);}
        if(e.key==='Enter' && focused && selected>=0 && selected<optionCount){e.preventDefault();if(options[selected])go(options[selected].screen);else openRecord(records[selected-options.length]);}
      }}/>
      {query && <button type="button" className="g-icon" aria-label="Clear search" onClick={()=>{setQuery('');setSelected(-1);recordSearch('');(placement==='top'?searchRef:homeSearchRef).current?.focus();}}>×</button>}
      <span className="g-key-hint">⌘ K</span>
      <button type="button" className="g-ask" onClick={()=>go('ask')}><span className="g-spark">✦</span> AI Tutor</button>
    </form>
    {focused && activeSearch===placement && <div className="g-suggestions" id={`semester-search-results-${placement}`} role="listbox" aria-label="Search suggestions">
      <div className="g-suggest-title">{query.trim() ? `${matches.length} matching ${matches.length===1?'app':'apps'}` : recent.length ? 'Recently opened' : 'Suggested apps'}</div>
      {options.map((app,i)=><button id={`g-option-${placement}-${i}`} type="button" role="option" aria-selected={i===selected} className={`g-suggestion ${i===selected?'selected':''}`} key={app.screen} onMouseDown={e=>e.preventDefault()} onClick={()=>go(app.screen)}><AppBadge app={app} small/><span><strong>{label(app)}</strong><small>{app.blurb}</small></span><span className="g-result-group">{app.group}</span></button>)}
      {!!records.length&&<div className="g-suggest-title">Your semester</div>}
      {records.map((hit,i)=><button id={`g-option-${placement}-${options.length+i}`} type="button" role="option" aria-selected={selected===options.length+i} className={`g-suggestion ${selected===options.length+i?'selected':''}`} key={hitKey(hit)} onMouseDown={e=>e.preventDefault()} onClick={()=>openRecord(hit)}><Search size={22}/><span><strong>{hit.title}</strong><small>{hit.sub}</small></span><span className="g-result-group">{hit.tag}</span></button>)}
      {!optionCount && <div className="g-no-results">No matching apps or saved records. Try a course, document title, or “deadlines”.</div>}
      {query.trim()&&<button className="g-search-all" type="button" onClick={searchAll}>Search all my information <span>→</span></button>}
      <button className="g-search-all" type="button" onClick={showDirectory}>Browse {query.trim() ? 'all results' : `all ${apps.length} apps`} <span>→</span></button>
    </div>}
  </div>;

  if(classic) return <><button className="g-classic-back" onClick={()=>setClassic(false)}>← Return to search layout</button>{children}</>;
  return <ModernShellContext.Provider value={true}><div className={`semester-google ${homePage?'g-home':'g-workspace'} ${lightHome?'g-home-light':''} ${productivity && !directory ? 'g-productivity' : ''}`} data-workspace-screen={state.screen}>
    <GoogleTabs menuOpen={organizerOpen} onMenuChange={open=>{setOrganizerOpen(open);if(open){setFocused(false);setLauncher(false);setCustomize(false);}}} onNavigate={()=>{dispatch({type:'finder',open:false});setDirectory(false);setQuery('');setFocused(false);setLauncher(false);setCustomize(false);}}/>
    {focused && <div className="g-dismiss-search" onClick={()=>setFocused(false)} />}
    <header className="g-topbar">
      {<button className={`g-brand ${home&&!directory?'g-home-brand':''}`} onClick={()=>go('search')} aria-label="Semester home"><span className="g-brand-mark">S</span><span>Semester</span></button>}
      {searchBox('top')}
      <nav className="g-top-actions" aria-label="Quick navigation">
        
        {(!home || directory) && <><button className="g-icon" aria-label="Alerts" onClick={()=>go('notifs')}><Bell size={21}/></button><button className="g-icon g-settings-icon" aria-label="Settings" onClick={()=>go('settings')}>⚙</button></>}
        <div ref={launcherRef} className="g-launcher-anchor"><button className={`g-icon ${launcher?'active':''}`} aria-label="Open all apps" aria-expanded={launcher} onClick={()=>{dispatch({type:'finder',open:false});setLauncher(!launcher);setOrganizerOpen(false);setCustomize(false);setFocused(false);}}><AppsIcon size={24}/></button>
        {launcher && <section className="g-launcher" aria-label="Semester app launcher"><div className="g-launcher-favorites"><div className="g-panel-heading"><h2>Your favorites</h2><button className="g-icon" aria-label="Edit favorites" onClick={()=>setEditing(!editing)}>{editing?<Check size={20}/>:'✎'}</button></div><div className="g-launcher-grid">{(editing?apps:favoriteApps).map(a=><button key={a.screen} aria-label={editing ? `${pinned.has(a.screen)?'Unpin':'Pin'} ${label(a)}` : `Open ${label(a)}`} className="g-launcher-app" onClick={()=>editing?toggleFavorite(a.screen):go(a.screen)}><AppBadge app={a}/><span>{label(a)}</span>{editing&&pinned.has(a.screen)&&<span className="g-pin-check">✓</span>}</button>)}</div>{editing&&<button className="g-blue-button" onClick={()=>setEditing(false)}>Done</button>}</div>{!editing&&<><div className="g-panel-heading"><h2>More from Semester</h2></div><div className="g-launcher-grid">{apps.filter(a=>!pinned.has(a.screen)).map(a=><button key={a.screen} className="g-launcher-app" onClick={()=>go(a.screen)}><AppBadge app={a}/><span>{label(a)}</span></button>)}</div></>}</section>}
        </div>
        <button className="g-avatar" aria-label="Your profile" onClick={()=>go('profile')}>{state.myName?.[0]?.toUpperCase() || 'H'}</button>
      </nav>
    </header>
    {!home && <nav className="semester-primary-nav" aria-label="Main navigation">{([['home','Home'],['courses','Courses'],['study','Study'],['calendar','Calendar'],['work','Assignments'],['classmates','Messages'],['university','Campus'],['career','Career'],['create','Create']] as [Screen,string][]).map(([screen,name])=><button key={screen} aria-current={state.screen===screen?'page':undefined} onClick={()=>go(screen)}>{name}</button>)}<button onClick={showDirectory}>More</button><button className="semester-search-records" onClick={()=>dispatch({type:'finder',open:true})}>Search my information</button></nav>}
    {homePage ? <section className="g-search-home" id="search-home" aria-label="Semester home">
      <div className="g-home-center"><h1 className="g-wordmark">Semester</h1>{searchBox('home')}
      {showFavorites && <div className="g-shortcuts">{favoriteApps.map(a=><button className="g-shortcut" onClick={()=>go(a.screen)} key={a.screen}><span className="g-shortcut-circle"><AppBadge app={a}/></span><span>{label(a)}</span></button>)}<button className="g-shortcut" onClick={()=>{setLauncher(true);setEditing(true);}}><span className="g-shortcut-circle"><Plus size={27}/></span><span>Add shortcut</span></button></div>}
      <button className="g-browse-home" onClick={showDirectory}><AppsIcon size={17}/> Explore all {apps.length} apps <span>→</span></button>
      </div>
      <footer className="g-home-footer"><div className="g-footer-info"><span>{now.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</span><span>{state.sample ? 'Sample semester · ' : ''}{catalog.courses.length} courses this semester</span></div><button className="g-customize" onClick={()=>setCustomize(true)}><span>✎</span> Customize Semester</button></footer>
    </section> : <div className="g-workspace-body"><aside className="g-sidebar"><button className={home?'selected':''} onClick={()=>{setQuery('');showDirectory();}}><AppsIcon size={21}/> All apps</button><button onClick={()=>go('search')}><Search size={21}/> Search home</button><div className="g-nav-caption">Your favorites</div>{favoriteApps.map(a=><button className={state.screen===a.screen?'selected':''} key={a.screen} onClick={()=>go(a.screen)}><TabGlyph screen={a.screen} size={21}/>{label(a)}</button>)}<div className="g-sidebar-bottom"><button onClick={()=>go('connect')}><TabGlyph screen="connect" size={21}/> Connections</button><button onClick={()=>go('settings')}><TabGlyph screen="settings" size={21}/> Settings</button><p>{school.name || 'Your semester'}<span>{catalog.courses.length} courses · {apps.length} apps</span></p></div></aside>
    {directory && !state.finder ? <section className="g-directory" aria-label="All applications"><div className="g-directory-title"><h1>{query.trim()?`Results for “${query}”`:'Welcome to Semester'}</h1><span>{apps.length} apps, one semester</span></div><h2 className="g-section-title">Your favorites</h2><div className="g-favorite-cards">{favoriteApps.slice(0,4).map(a=><button key={a.screen} onClick={()=>go(a.screen)}><AppBadge app={a} small/><span><strong>{label(a)}</strong><small>{a.group}</small></span><span>↗</span></button>)}</div><div className="g-directory-toolbar"><h2>All applications</h2><div className="g-view-toggle"><button aria-label="List view" aria-pressed={!grid} onClick={()=>setGrid(false)}>☰</button><button aria-label="Grid view" aria-pressed={grid} onClick={()=>setGrid(true)}><AppsIcon size={20}/></button></div></div><div className="g-filters">{['All apps',...GROUPS].map(g=><button key={g} className={group===g?'selected':''} onClick={()=>setGroup(g)}>{g}</button>)}</div><div className={grid?'g-directory-grid':'g-app-table'}>{!grid&&<div className="g-table-head"><span>Name</span><span>What you can do</span><span>Category</span><span>Favorite</span></div>}{matches.filter(a=>group==='All apps'||a.group===group).map(a=><div className="g-directory-app" key={a.screen}><button onClick={()=>go(a.screen)}><AppBadge app={a} small/><strong>{label(a)}</strong><p>{a.blurb}</p><span className="g-table-category">{a.group}</span></button><button className="g-star" aria-label={`${pinned.has(a.screen)?'Unpin':'Pin'} ${label(a)}`} aria-pressed={pinned.has(a.screen)} onClick={()=>toggleFavorite(a.screen)}>{pinned.has(a.screen)?'★':'☆'}</button></div>)}{!matches.filter(a=>group==='All apps'||a.group===group).length&&<p className="g-no-results">No apps match this search and category. Choose another category or clear the search.</p>}</div></section> : <section className="g-app-content" aria-label={current?.label ?? 'Semester workspace'}><div className="g-workspace-heading"><button className="g-icon" onClick={()=>{if(state.finder)dispatch({type:'finder',open:false});else if(state.history.length)window.history.back();else go('search');}} aria-label="Go back"><ChevronLeft size={23}/></button><h1>{state.finder?'Search results':title}</h1>{state.finder?<button className="g-icon" aria-label="Close search results" onClick={()=>dispatch({type:'finder',open:false})}>×</button>:<button className="g-icon" aria-label="Search everything in your semester" onClick={()=>dispatch({type:'finder',open:true})}><Search size={21}/></button>}</div>{state.finder&&<section className="g-global-results" aria-label="Semester search results"><GlobalSearchResults query={query} groups={found} canOpenTab={canOpenTab} onOpen={openRecord} onNewTab={openRecordInNew}/></section>}<div className="g-legacy-mount" hidden={state.finder}>{children}</div></section>}
    </div>}
    {home && !state.finder && <div className="g-home-legacy">{children}</div>}
    {customize&&<><div className="g-drawer-wash" onClick={()=>setCustomize(false)}/><aside className="g-customize-panel" aria-label="Customize Semester" role="dialog" aria-modal="true" ref={customizeModal.ref} onKeyDown={customizeModal.onKeyDown} tabIndex={-1}><div className="g-panel-heading"><h2>Customize Semester</h2><button className="g-icon" aria-label="Close customization" onClick={()=>setCustomize(false)}>×</button></div><p>Make a little room for your semester.</p><h3>Appearance</h3><div className="g-theme-options"><button className={!lightHome?'selected':''} aria-pressed={!lightHome} onClick={()=>{if(lightHome)setLightHome(false);}}><span className="g-theme-dark">Aa</span>Dark</button><button className={lightHome?'selected':''} aria-pressed={lightHome} onClick={()=>{if(!lightHome)setLightHome(true);}}><span className="g-theme-light">Aa</span>Light</button></div><label className="g-toggle-label">Show shortcuts<input type="checkbox" checked={showFavorites} onChange={e=>setShowFavorites(e.target.checked)}/></label><button className="g-outline-button" onClick={()=>{setCustomize(false);setLauncher(true);setEditing(true);}}>Choose favorite apps</button><button className="g-outline-button" onClick={()=>go('onboarding')}>Set up your semester</button><button className="g-text-button" onClick={()=>{setCustomize(false);setClassic(true);go('home');}}>Open original layout</button></aside></>}
  </div></ModernShellContext.Provider>;
}
