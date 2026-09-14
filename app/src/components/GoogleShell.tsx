import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useStore } from '../state/store';
import { appShelves } from '../lib/apps';
import { destination, GROUPS, type Destination } from '../lib/nav';
import type { Screen } from '../lib/types';
import { TabGlyph } from './TabIcon';
import { AppsIcon, Search, Plus, Check, ChevronLeft, Bell } from './Icons';
import './google-shell.css';
/* The audited tree also imported its `workspace.css` here. Those rules live
   in `styles/features.css` in this app, loaded once from `main.tsx` — they
   are the ported screens' own styling and are not this shell's to carry. */
import { hasOpenModal, useModal } from '../a11y/modal';
import { currentLook } from '../state/shape';
import { DEFAULT_FAVOURITES, readFavourites, toggleFavourite } from '../lib/desk';
import { ground, groundName, resolveGround } from '../lib/look';
import { usePrefersDark } from '../lib/prefers';
import { WIDE, useMedia } from '../lib/media';
import { GoogleTabs } from './GoogleTabs';
import { findEverything, type Hit } from '../lib/find';
import { actionsFor, hitKey, landingOf } from '../lib/openhit';
import { recordSearch, here, openInNew, useStrip } from '../lib/browser.hook';
import {MAX_TABS} from '../lib/browser';
import {ModernShellContext} from './shell-context';
import {FocusBarProvider} from './desk/barfocus';
import {GlobalSearchResults} from './GlobalSearchResults';

const COLORS = ['#4285f4', '#34a853', '#ea4335', '#f9ab00', '#8e63ce', '#00a6a6', '#e871b3'];
/*
 * There was a `DARK`/`LIGHT` pair here, and the Appearance switch that used it.
 *
 * It arrived citing `components/desk/Customize.tsx` as the precedent — and it
 * was the right instinct, taken from a version of that file that had already
 * been found wrong. That pair read the ground through `resolveGround`, whose
 * job is to turn the `device` instruction into a palette, so somebody on
 * **Match my device** was shown Dark, lit, as a choice they had made; pressing
 * Light then wrote a fixed `paper` over the instruction, silently, one way,
 * with no route back — and `paper` is not even the ground Match my device
 * resolves light to (`parchment`, `DEVICE_LIGHT` in `lib/look.ts`). All three
 * verified against the real functions.
 *
 * So the precedent is the other way now: that panel links to Colour and type
 * and *reports* the ground through `groundName`, the function that does not
 * erase `device`. This one does the same, a few lines down. `lightHome` below
 * still resolves, because painting a page does need a palette — reporting a
 * setting and painting from it are different jobs, which is why the two
 * functions are named apart.
 */
function label(app: Destination) { return app.screen === 'ask' ? 'AI Tutor' : app.screen === 'import' ? 'Add a course' : app.short ?? app.label; }
export function AppBadge({ app, small = false }: { app: Destination; small?: boolean }) {
  const color = COLORS[GROUPS.indexOf(app.group)] ?? COLORS[0];
  return <span className={`g-app-badge ${small ? 'small' : ''}`} style={{ '--badge-color': color } as React.CSSProperties}><TabGlyph screen={app.screen} size={small ? 22 : 29} /></span>;
}

export function GoogleShell({ children, title }: { children: ReactNode; title: string }) {
  const { state, dispatch, school, catalog, now } = useStore();
  /*
   * Pinned apps, the shortcut row's switch, light and dark, and where you
   * have been: four preferences this shell used to keep for itself under
   * `semester.google.*`, and four the app already had.
   *
   * They are the app's now. Two copies of one preference do not drift
   * quietly — they disagree in front of the student: a star pressed here left
   * the workspace sidebar, the search home and Settings on the old five, and
   * a switch under the heading Appearance moved this shell's home and not the
   * app's ground. They were also outside the store, so a backup carried
   * neither and a restore brought neither back.
   */
  const look = currentLook(state);
  const caps = school.capabilities;
  const prefersDark = usePrefersDark();
  /* Resolved, because "Match my device" is an instruction rather than a
     palette and the pair has to show which side it currently lands on. */
  const lightHome = ground(resolveGround(look.ground, prefersDark)).light;
  const showFavorites = look.shortcuts !== 'off';
  const recent = state.recent;
  /*
   * `groupOrder` and the role, rather than `undefined` and the default.
   *
   * Without the first this grid holds the apps in a different order from the
   * launcher's, against the promise `appShelves` makes in its own comment;
   * without the second it asks what a *student* may open, which is a
   * different set from what the search field beside it offers a teacher. See
   * the note over `appShelves` in `lib/apps.ts`.
   */
  const apps = useMemo(
    () => appShelves(school.capabilities, look.groupOrder, state.role).flatMap(s => s.apps),
    [school.capabilities, look.groupOrder, state.role],
  );
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
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
  /* What `/` reaches, through `components/desk/barfocus.ts`. Stable, so a
     keystroke does not re-subscribe the listener that reads it. */
  const focusBar = useCallback(() => searchRef.current?.focus(), []);
  useEffect(() => {
    setLauncher(false); setFocused(false); setCustomize(false); setOrganizerOpen(false); setQuery('');
  }, [state.screen]);
  const customizeModal = useModal<HTMLElement>({ on: customize, onClose: () => setCustomize(false) });
  const launcherRef = useRef<HTMLDivElement>(null);
  const home = state.screen === 'search';
  const homePage = home && !directory && !state.finder;
  useEffect(()=>{if(!classic && state.finder){setOrganizerOpen(false);setQuery(here().query??'');setDirectory(false);setFocused(false);setLauncher(false);setCustomize(false);searchRef.current?.focus();}},[state.finder,classic]);
  useEffect(()=>{if(!classic && state.apps){dispatch({type:'apps',open:false});setLauncher(true);setOrganizerOpen(false);setFocused(false);setCustomize(false);}},[state.apps,classic,dispatch]);
  useEffect(()=>{if(state.quickAdd){setFocused(false);setLauncher(false);setOrganizerOpen(false);setCustomize(false);}},[state.quickAdd]);
  const productivity = ['write','sheet','deck','mine','mail','classmates','call','draw','courses','course','study','degree','yes','housing','meals','maps','activities','work','university','create','athletics','career','family','pathway'].includes(state.screen);
  const favourites = readFavourites(look.favourites, caps, state.role).map(d => d.screen);
  const favoriteApps = favourites.map(s => apps.find(a => a.screen === s)).filter((a): a is Destination => !!a);
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = apps.filter(a => terms.every(t => `${a.label} ${a.short ?? ''} ${a.blurb} ${a.keywords} ${a.group}`.toLowerCase().includes(t))).sort((a,b) => Number(b.label.toLowerCase().startsWith(query.toLowerCase())) - Number(a.label.toLowerCase().startsWith(query.toLowerCase())));
  const suggested = (recent.length ? recent : DEFAULT_FAVOURITES).map(s => apps.find(a => a.screen === s)).filter((a): a is Destination => !!a).slice(0,6);
  const found = useMemo(()=>query.trim()?findEverything(catalog,now,query,state.notes,state.tasks,school.capabilities,state.updates,state.reviews,state.appointments,{documents:state.documents,sheets:state.sheets,decks:state.decks},state.role):[],[catalog,now,query,state.notes,state.tasks,school.capabilities,state.updates,state.reviews,state.appointments,state.documents,state.sheets,state.decks,state.role]);
  const records = found.flatMap(g=>g.hits).filter(h=>h.kind!=='screen').sort((a,b)=>b.score-a.score).slice(0,5);
  const options = query.trim() ? matches.slice(0,records.length?3:6) : suggested;
  const optionCount=options.length+records.length;
  const current = destination(state.screen);
  const go = (screen: Screen) => {
    dispatch({type:'finder',open:false}); dispatch({ type: 'go', screen }); setDirectory(false); setQuery(''); setFocused(false); setLauncher(false); setCustomize(false); setSelected(-1);
  };
  const openRecord=(hit:Hit)=>{dispatch({type:'finder',open:false});setDirectory(false);setFocused(false);setLauncher(false);setQuery('');for(const action of actionsFor(hit))dispatch(action);};
  const openRecordInNew=(hit:Hit)=>{if(openInNew(landingOf(hit),hit.title,actionsFor(hit),query))openRecord(hit);};
  const searchAll=()=>{recordSearch(query);setFocused(false);setLauncher(false);dispatch({type:'finder',open:true});};
  const toggleFavorite = (screen: Screen) => dispatch({ type: 'setLook', look: { favourites: toggleFavourite(look.favourites, screen, caps, state.role) } });
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if(classic || hasOpenModal())return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); e.stopImmediatePropagation(); dispatch({type:'finder',open:false}); setLauncher(false);setOrganizerOpen(false); searchRef.current?.focus(); setFocused(true); }
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
  /*
   * One field, in the bar, on every screen.
   *
   * This took a `placement` of 'top' or 'home' and was rendered twice — the
   * omnibox in the header and a second copy in the middle of the home page.
   * They shared `query`, so it was one search behind two comboboxes: two of
   * them for a screen reader, two `⌘ K` hints and two AI Tutor buttons on the
   * one screen this shell opens on.
   *
   * The centre is `homeBox` below now, a button that focuses this field
   * rather than a second one — the idiom this whole shell is borrowed from,
   * where a new tab page's box focuses the omnibox. With the second field
   * went `activeSearch`, which existed only to remember which of the two was
   * being typed in.
   */
  const searchBox = () => <div className={`g-search-wrap g-omnibox ${focused ? 'is-open' : ''}`}>
    <form className="g-search" onSubmit={e => {e.preventDefault(); if (query.trim()) searchAll(); else showDirectory();}} role="search">
      <Search size={23}/>
      <input ref={searchRef} aria-label="Search Semester" aria-expanded={focused} aria-controls="semester-search-results" aria-activedescendant={focused && selected>=0 && selected<optionCount ? `g-option-${selected}` : undefined} role="combobox" autoComplete="off" placeholder={roomy ? 'Search apps, courses, assignments and files' : 'Search Semester'} value={query} onFocus={() => {setLauncher(false);setOrganizerOpen(false);setSelected(-1);setFocused(!state.finder);}} onChange={e=>{setQuery(e.target.value);if(state.finder)recordSearch(e.target.value);setSelected(-1);setFocused(!state.finder);}} onKeyDown={e=>{
        if(e.key==='ArrowDown'){e.preventDefault();setSelected(n=>optionCount?Math.min(n+1,optionCount-1):-1);}
        if(e.key==='ArrowUp'){e.preventDefault();setSelected(n=>optionCount?(n<=0?optionCount-1:n-1):-1);}
        if(e.key==='Enter' && focused && selected>=0 && selected<optionCount){e.preventDefault();if(options[selected])go(options[selected].screen);else openRecord(records[selected-options.length]);}
      }}/>
      {query && <button type="button" className="g-icon" aria-label="Clear search" onClick={()=>{setQuery('');setSelected(-1);recordSearch('');searchRef.current?.focus();}}>×</button>}
      {/* True here, unlike the two chips this pass removed from the other
          shell: this shell's own listener binds ⌘K, in the capture phase, to
          focus this field. Written once because there is one field. */}
      <span className="g-key-hint">⌘ K</span>
      <button type="button" className="g-ask" onClick={()=>go('ask')}><span className="g-spark">✦</span> AI Tutor</button>
    </form>
    {focused && <div className="g-suggestions" id="semester-search-results" role="listbox" aria-label="Search suggestions">
      <div className="g-suggest-title">{query.trim() ? `${matches.length} matching ${matches.length===1?'app':'apps'}` : recent.length ? 'Recently opened' : 'Suggested apps'}</div>
      {options.map((app,i)=><button id={`g-option-${i}`} type="button" role="option" aria-selected={i===selected} className={`g-suggestion ${i===selected?'selected':''}`} key={app.screen} onMouseDown={e=>e.preventDefault()} onClick={()=>go(app.screen)}><AppBadge app={app} small/><span><strong>{label(app)}</strong><small>{app.blurb}</small></span><span className="g-result-group">{app.group}</span></button>)}
      {!!records.length&&<div className="g-suggest-title">Your semester</div>}
      {records.map((hit,i)=><button id={`g-option-${options.length+i}`} type="button" role="option" aria-selected={selected===options.length+i} className={`g-suggestion ${selected===options.length+i?'selected':''}`} key={hitKey(hit)} onMouseDown={e=>e.preventDefault()} onClick={()=>openRecord(hit)}><Search size={22}/><span><strong>{hit.title}</strong><small>{hit.sub}</small></span><span className="g-result-group">{hit.tag}</span></button>)}
      {!optionCount && <div className="g-no-results">No matching apps or saved records. Try a course, document title, or “deadlines”.</div>}
      {query.trim()&&<button className="g-search-all" type="button" onClick={searchAll}>Search all my information <span>→</span></button>}
      <button className="g-search-all" type="button" onClick={showDirectory}>Browse {query.trim() ? 'all results' : `all ${apps.length} apps`} <span>→</span></button>
    </div>}
  </div>;

  /*
   * The home page's centre: a way into the field above, not a second one.
   *
   * A button rather than an input, for the reason the workspace's own centre
   * box gives — a second text box forwarding its keystrokes is the duplicate
   * wearing a disguise. Pressing it puts the cursor in the omnibox, which
   * then drops its suggestions over this row.
   *
   * The `+` stays because on this page it is the only one: the bar's own
   * capture button is drawn everywhere *but* here, so that exactly one is on
   * screen in either case.
   */
  const homeBox = () => <div className={`g-search-wrap g-central-search ${launcher || customize || state.finder || state.quickAdd || focused ? 'is-suppressed' : ''}`}>
    <div className="g-search">
      <button type="button" className="g-icon g-plus" aria-label="Add a task or appointment" onClick={() => {dispatch({type:'finder',open:false});dispatch({type:'quickAdd',open:true});}}><Plus size={24}/></button>
      <button type="button" className="g-central-box" onClick={focusBar}>Search your semester</button>
    </div>
  </div>;

  if(classic) return <><button className="g-classic-back" onClick={()=>setClassic(false)}>← Return to search layout</button>{children}</>;
  /*
   * `/` lands in this shell's field, the way it lands in the workspace's.
   *
   * `components/desk/barfocus.ts` is the channel and `components/Keys.tsx` the
   * one caller: it focuses the bar where a provider says there is one and
   * opens the palette where there is none. Mounting it here is all this
   * navigation needed — the key was already right, it had no way to know this
   * shell draws a field. Inside the provider, because `Keys` is one of the
   * children `BrowserShell` mounts.
   */
  return <ModernShellContext.Provider value={true}><FocusBarProvider value={focusBar}><div className={`semester-google ${homePage?'g-home':'g-workspace'} ${lightHome?'g-home-light':''} ${productivity && !directory ? 'g-productivity' : ''}`} data-workspace-screen={state.screen}>
    <GoogleTabs menuOpen={organizerOpen} onMenuChange={open=>{setOrganizerOpen(open);if(open){setFocused(false);setLauncher(false);setCustomize(false);}}} onNavigate={()=>{dispatch({type:'finder',open:false});setDirectory(false);setQuery('');setFocused(false);setLauncher(false);setCustomize(false);}}/>
    {focused && <div className="g-dismiss-search" onClick={()=>setFocused(false)} />}
    <header className="g-topbar">
      {<button className={`g-brand ${home&&!directory?'g-home-brand':''}`} onClick={()=>go('search')} aria-label="Semester home"><span className="g-brand-mark">S</span><span>Semester</span></button>}
      {searchBox()}
      <nav className="g-top-actions" aria-label="Quick navigation">
        {/*
          The capture box, on every screen that is not this shell's home.

          Its home draws a `+` beside the centre box and that is the only one
          there; everywhere else there was none. The sidebar's New was the
          pointing route on a wide window until `#240` took it off both
          columns, and narrow never had one — `.g-sidebar` is `display:none`
          below 760px. `q` does not cover it: `components/Keys.tsx` returns
          early below `WIDE`. So on a narrow window, on any screen but the
          home, the capture box could not be reached at all.

          The bar is where it belongs, by the rule every survivor in this pass
          has used: it is the one piece of this navigation's chrome drawn on
          every screen at every width, and it is the answer the workspace gives
          with the `+` in its header. Gated as the mirror of the centre box's
          own `+` — one capture control per frame, never two, never none — and
          named as the centre names it.

          `g-capture` as well as `g-icon`, because a narrow window clears every
          `.g-icon` out of this row. The two it drops go safely, being one row
          down in the launcher; the capture box is an overlay, not a screen, so
          the launcher cannot list it. The exemption is in `google-shell.css`,
          beside the rule it answers.
        */}
        {!homePage && <button className="g-icon g-capture" aria-label="Add a task or appointment" onClick={()=>{dispatch({type:'finder',open:false});dispatch({type:'quickAdd',open:true});}}><Plus size={21}/></button>}
        
        {(!home || directory) && <><button className="g-icon" aria-label="Alerts" onClick={()=>go('notifs')}><Bell size={21}/></button><button className="g-icon g-settings-icon" aria-label="Settings" onClick={()=>go('settings')}>⚙</button></>}
        <div ref={launcherRef} className="g-launcher-anchor"><button className={`g-icon ${launcher?'active':''}`} aria-label="Open all apps" aria-expanded={launcher} onClick={()=>{dispatch({type:'finder',open:false});setLauncher(!launcher);setOrganizerOpen(false);setCustomize(false);setFocused(false);}}><AppsIcon size={24}/></button>
        {launcher && <section className="g-launcher" aria-label="Semester app launcher"><div className="g-launcher-favorites"><div className="g-panel-heading"><h2>Your favorites</h2><button className="g-icon" aria-label="Edit favorites" onClick={()=>setEditing(!editing)}>{editing?<Check size={20}/>:'✎'}</button></div><div className="g-launcher-grid">{(editing?apps:favoriteApps).map(a=><button key={a.screen} aria-label={editing ? `${favourites.includes(a.screen)?'Unpin':'Pin'} ${label(a)}` : `Open ${label(a)}`} className="g-launcher-app" onClick={()=>editing?toggleFavorite(a.screen):go(a.screen)}><AppBadge app={a}/><span>{label(a)}</span>{editing&&favourites.includes(a.screen)&&<span className="g-pin-check">✓</span>}</button>)}</div>{editing&&<button className="g-blue-button" onClick={()=>setEditing(false)}>Done</button>}</div>{!editing&&<><div className="g-panel-heading"><h2>More from Semester</h2></div><div className="g-launcher-grid">{apps.filter(a=>!favourites.includes(a.screen)).map(a=><button key={a.screen} className="g-launcher-app" onClick={()=>go(a.screen)}><AppBadge app={a}/><span>{label(a)}</span></button>)}</div></>}</section>}
        </div>
        <button className="g-avatar" aria-label="Your profile" onClick={()=>go('profile')}>{state.myName?.[0]?.toUpperCase() || 'H'}</button>
      </nav>
    </header>
    {!home && <nav className="semester-primary-nav" aria-label="Main navigation">{([['home','Home'],['courses','Courses'],['study','Study'],['calendar','Calendar'],['work','Assignments'],['classmates','Messages'],['university','Campus'],['career','Career'],['create','Create']] as [Screen,string][]).map(([screen,name])=><button key={screen} aria-current={state.screen===screen?'page':undefined} onClick={()=>go(screen)}>{name}</button>)}<button onClick={showDirectory}>More</button><button className="semester-search-records" onClick={()=>dispatch({type:'finder',open:true})}>Search my information</button></nav>}
    {homePage && <section className="g-search-home" id="search-home" aria-label="Semester home">
      <div className="g-home-center"><h1 className="g-wordmark">Semester</h1>{homeBox()}
      {showFavorites && <div className="g-shortcuts">{favoriteApps.slice(0,9).map(a=><button className="g-shortcut" onClick={()=>go(a.screen)} key={a.screen}><span className="g-shortcut-circle"><AppBadge app={a}/></span><span>{label(a)}</span></button>)}<button className="g-shortcut" onClick={()=>{setLauncher(true);setEditing(true);}}><span className="g-shortcut-circle"><Plus size={27}/></span><span>Add shortcut</span></button></div>}
      <button className="g-browse-home" onClick={showDirectory}><AppsIcon size={17}/> Explore all {apps.length} apps <span>→</span></button>
      </div>
      <footer className="g-home-footer"><div className="g-footer-info"><span>{now.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</span><span>{state.sample ? 'Sample semester · ' : ''}{catalog.courses.length} courses this semester</span></div><button className="g-customize" onClick={()=>setCustomize(true)}><span>✎</span> Customize Semester</button></footer>
    </section>}
    {/*
      Always drawn, in every arrangement, because it is what holds the app.

      It used to be the other half of the ternary above, with a second copy of
      `{children}` in a `.g-home-legacy` overlay below for the home screen —
      two positions in the element tree for one app, so React tore it down and
      built it again on every crossing between them, and built none at all
      while the directory was up. What that costs is everything a component
      holds that the store does not: a scroll position, a half-typed reply, a
      running timer, and the strip's own record of where each tab had been.

      So the arrangements are told apart by classes and `hidden` now — the
      idiom this file already used for the search results — and the app has
      one position they all share. On the home screen this body draws nothing:
      it is put away by `g-body-away` (see google-shell.css) and the mount
      inside it goes fixed as the overlay it always was.
    */}
    <div className={`g-workspace-body ${homePage ? 'g-body-away' : ''}`}><aside className="g-sidebar" hidden={homePage}>
      {/* "App directory", not "All apps". The nine dots in the bar above are
          already labelled Open all apps and they open the launcher — a panel
          over the page — rather than this screen. Two controls in one frame
          answering to one name is worse than either being redundant: a screen
          reader read both out identically and pressing one was the only way to
          tell which you had. */}
      <button className={home?'selected':''} onClick={()=>{setQuery('');showDirectory();}}><AppsIcon size={21}/> App directory</button>
      {/* There were two more rows here, and the bar above has both. **Search
          home** went where the wordmark goes and **Settings** where the gear in
          `g-top-actions` goes — each a few inches from the row that repeated
          it, in the same frame. The bar's two survive because they are drawn on
          every screen of this navigation and this column is drawn on none of
          the home page. */}<div className="g-nav-caption">Your favorites</div>{favoriteApps.map(a=><button className={state.screen===a.screen?'selected':''} key={a.screen} onClick={()=>go(a.screen)}><TabGlyph screen={a.screen} size={21}/>{label(a)}</button>)}<div className="g-sidebar-bottom"><button onClick={()=>go('connect')}><TabGlyph screen="connect" size={21}/> Connections</button><p>{school.name || 'Your semester'}<span>{catalog.courses.length} courses · {apps.length} apps</span></p></div></aside>
    {directory && !state.finder && <section className="g-directory" aria-label="All applications"><div className="g-directory-title"><h1>{query.trim()?`Results for “${query}”`:'Welcome to Semester'}</h1><span>{apps.length} apps, one semester</span></div><h2 className="g-section-title">Your favorites</h2><div className="g-favorite-cards">{favoriteApps.slice(0,4).map(a=><button key={a.screen} onClick={()=>go(a.screen)}><AppBadge app={a} small/><span><strong>{label(a)}</strong><small>{a.group}</small></span><span>↗</span></button>)}</div><div className="g-directory-toolbar"><h2>All applications</h2><div className="g-view-toggle"><button aria-label="List view" aria-pressed={!grid} onClick={()=>setGrid(false)}>☰</button><button aria-label="Grid view" aria-pressed={grid} onClick={()=>setGrid(true)}><AppsIcon size={20}/></button></div></div><div className="g-filters">{['All apps',...GROUPS].map(g=><button key={g} className={group===g?'selected':''} onClick={()=>setGroup(g)}>{g}</button>)}</div><div className={grid?'g-directory-grid':'g-app-table'}>{!grid&&<div className="g-table-head"><span>Name</span><span>What you can do</span><span>Category</span><span>Favorite</span></div>}{matches.filter(a=>group==='All apps'||a.group===group).map(a=><div className="g-directory-app" key={a.screen}><button onClick={()=>go(a.screen)}><AppBadge app={a} small/><strong>{label(a)}</strong><p>{a.blurb}</p><span className="g-table-category">{a.group}</span></button><button className="g-star" aria-label={`${favourites.includes(a.screen)?'Unpin':'Pin'} ${label(a)}`} aria-pressed={favourites.includes(a.screen)} onClick={()=>toggleFavorite(a.screen)}>{favourites.includes(a.screen)?'★':'☆'}</button></div>)}{!matches.filter(a=>group==='All apps'||a.group===group).length&&<p className="g-no-results">No apps match this search and category. Choose another category or clear the search.</p>}</div></section>}<section className="g-app-content" hidden={directory && !state.finder} aria-label={homePage ? undefined : (current?.label ?? 'Semester workspace')}><div className="g-workspace-heading" hidden={homePage}><button className="g-icon" onClick={()=>{if(state.finder)dispatch({type:'finder',open:false});else if(state.history.length)window.history.back();else go('search');}} aria-label="Go back"><ChevronLeft size={23}/></button><h1>{state.finder?'Search results':title}</h1>{state.finder?<button className="g-icon" aria-label="Close search results" onClick={()=>dispatch({type:'finder',open:false})}>×</button>:<button className="g-icon" aria-label="Search everything in your semester" onClick={()=>dispatch({type:'finder',open:true})}><Search size={21}/></button>}</div>{state.finder&&<section className="g-global-results" aria-label="Semester search results"><GlobalSearchResults query={query} groups={found} canOpenTab={canOpenTab} onOpen={openRecord} onNewTab={openRecordInNew}/></section>}<div className={homePage ? 'g-home-legacy' : 'g-legacy-mount'} hidden={state.finder}>{children}</div></section>
    </div>
    {customize&&<><div className="g-drawer-wash" onClick={()=>setCustomize(false)}/><aside className="g-customize-panel" aria-label="Customize Semester" role="dialog" aria-modal="true" ref={customizeModal.ref} onKeyDown={customizeModal.onKeyDown} tabIndex={-1}><div className="g-panel-heading"><h2>Customize Semester</h2><button className="g-icon" aria-label="Close customization" onClick={()=>setCustomize(false)}>×</button></div><p>Make a little room for your semester.</p><h3>Appearance</h3><button className="g-outline-button g-says" onClick={()=>go('setLook')}>Colour and type<span>{groundName(look.ground)}</span></button><label className="g-toggle-label">Show shortcuts<input type="checkbox" checked={showFavorites} onChange={e=>dispatch({type:'setLook',look:{shortcuts:e.target.checked?'on':'off'}})}/></label><button className="g-outline-button" onClick={()=>{setCustomize(false);setLauncher(true);setEditing(true);}}>Choose favorite apps</button><button className="g-outline-button" onClick={()=>go('onboarding')}>Set up your semester</button><button className="g-text-button" onClick={()=>{setCustomize(false);setClassic(true);go('home');}}>Open original layout</button></aside></>}
  </div></FocusBarProvider></ModernShellContext.Provider>;
}
