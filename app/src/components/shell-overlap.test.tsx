// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeAll,beforeEach,afterEach,expect,it} from 'vitest';
import {AIProvider} from '../ai/store';
import {StoreProvider,useStore} from '../state/store';
import {loadSeed} from '../data/seed';
import {GoogleShell} from './GoogleShell';
import {TabStrip,TabsFollow} from './Tabs';
import {Command} from './Command';
import {AllApps} from './nav/AllApps';
import {QuickAdd} from './QuickAdd';
import {forgetStrip,here,strip} from '../lib/browser.hook';
import {MAX_TABS} from '../lib/browser';
import {type State,DEFAULT_PERSISTED,initialEphemeral} from '../state/shape';
import {reducer} from '../state/reducer';

(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let host:HTMLDivElement;let root:Root;
function Screen(){const {state,dispatch}=useStore();return <div className="device"><TabStrip/><main data-work={state.screen} data-unit={state.openUnit} data-room={state.callCode}><button onClick={()=>dispatch({type:"openGuide",id:"econ",mode:"cards",unit:3})}>Study unit three</button><button onClick={()=>dispatch({type:"openGuide",id:"econ",mode:"cards",unit:1})}>Study unit one</button><input aria-label="Keep my draft" defaultValue="Keep this work"/><button onClick={()=>dispatch({type:'finder',open:true})}>Legacy search entry</button><button onClick={()=>dispatch({type:'apps',open:true})}>Legacy apps entry</button><button onClick={()=>dispatch({type:'quickAdd',open:true})}>Open the capture box</button></main>{state.finder&&<Command onClose={()=>dispatch({type:'finder',open:false})}/>} {state.apps&&<AllApps onClose={()=>dispatch({type:'apps',open:false})}/>} {state.quickAdd&&<QuickAdd onClose={()=>dispatch({type:'quickAdd',open:false})}/>}</div>;}
function App(){const {state}=useStore();return <><TabsFollow/><GoogleShell title={state.screen}><Screen/></GoogleShell></>;}
/* The arrangement `BrowserShell` used to have: the follower handed to the
   shell as a child, where the shell's two mount points remount it on every
   navigation into and out of the search home. See the test that uses it. */
function Remounting(){const {state}=useStore();return <GoogleShell title={state.screen}><TabsFollow/><Screen/></GoogleShell>;}
function button(name:string){const el=[...host.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')??b.textContent?.trim())===name);if(!el)throw new Error('Missing button '+name);return el;}
function click(name:string){act(()=>button(name).click());}
function type(text:string){const el=host.querySelector<HTMLInputElement>('[aria-label="Search Semester"]')!;act(()=>{el.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,text);el.dispatchEvent(new Event('input',{bubbles:true}));});}
beforeAll(()=>loadSeed());
beforeEach(async()=>{localStorage.clear();forgetStrip();/* This app opens on onboarding until it has been seen once; these tests are about the shell's search and tabs, so start past it. */localStorage.setItem('semester.v1',JSON.stringify({seenOnboarding:true}));window.history.replaceState(null,'','#/home');window.matchMedia=(()=>({matches:false,addEventListener(){},removeEventListener(){}})) as unknown as typeof window.matchMedia;host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(async()=>root.render(<StoreProvider><AIProvider><App/></AIProvider></StoreProvider>));});
afterEach(()=>{act(()=>root.unmount());host.remove();localStorage.clear();forgetStrip();});

it('keeps one browser strip and one search field when a legacy entry opens full results',()=>{
  click('Add new tab');click('Your profile');click('Legacy search entry');
  expect(host.querySelectorAll('[aria-label="Open app tabs"]')).toHaveLength(1);
  expect(host.querySelectorAll('[aria-label="Open tabs"]')).toHaveLength(0);
  expect(host.querySelectorAll('[role="combobox"]')).toHaveLength(1);
  expect(host.querySelectorAll('.g-global-results')).toHaveLength(1);
  expect(host.textContent).not.toContain('This tab is on');
  const draft=host.querySelector('[aria-label="Keep my draft"]');
  expect(draft?.closest('[hidden]')).not.toBeNull();
  click('Close search results');
  expect(host.querySelector('[aria-label="Keep my draft"]')).toBe(draft);
  expect(draft?.closest('[hidden]')).toBeNull();
});
it('opens a result in a named new tab and closes search on tab selection',()=>{
  click('Legacy search entry');type('calendar');
  const open=[...host.querySelectorAll<HTMLButtonElement>('.g-result-new')].find(b=>b.getAttribute('aria-label')?.includes('Calendar'))!;
  expect(open).toBeTruthy();act(()=>open.click());
  expect(strip().tabs).toHaveLength(2);expect(here().screen).toBe('calendar');expect(host.querySelector('.g-global-results')).toBeNull();
  click('Search everything in your semester');
  act(()=>host.querySelector<HTMLButtonElement>('.g-tab-select')!.click());
  expect(host.querySelector('.g-global-results')).toBeNull();
});
it('routes old app-launcher entry points to one modern launcher and keeps popovers exclusive',()=>{
  click('Legacy apps entry');expect(host.querySelectorAll('.g-launcher')).toHaveLength(1);expect(host.querySelector('[role="dialog"][aria-label="All apps"]')).toBeNull();
  click('Bookmarks and tab groups');expect(host.querySelector('.g-launcher')).toBeNull();expect(host.querySelector('.g-organizer-panel')).not.toBeNull();
  type('calendar');expect(host.querySelector('.g-organizer-panel')).toBeNull();expect(host.querySelectorAll('.g-suggestions')).toHaveLength(1);
  click('Open all apps');expect(host.querySelector('.g-suggestions')).toBeNull();expect(host.querySelectorAll('.g-launcher')).toHaveLength(1);
});
it('opens Quick Add visibly from search results and lets its own Escape close it',()=>{
  click('Legacy search entry');click('Open the capture box');
  expect(host.querySelector('.g-global-results')).toBeNull();
  const modal=host.querySelector<HTMLElement>('[aria-label="Add something quickly"]')!;
  expect(modal.closest('[hidden]')).toBeNull();expect(modal.style.position).toBe('fixed');
  act(()=>modal.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
  expect(host.querySelector('[aria-label="Add something quickly"]')).toBeNull();
});
it('keeps the original layout search available when explicitly selected',()=>{
  click('Semester home');act(()=>host.querySelector<HTMLButtonElement>('.g-customize')!.click());click('Open original layout');click('Legacy search entry');
  expect(host.querySelector('.semester-google')).toBeNull();expect(host.querySelector('[role="dialog"]')).not.toBeNull();expect(host.querySelector('[aria-label="Open tabs"]')).not.toBeNull();
});
it('dismisses navigation overlays on browser landings, back, and same-screen navigation',()=>{
  const state={...DEFAULT_PERSISTED,...initialEphemeral(new Date()),screen:'home',finder:true,apps:true} as State;
  for(const action of [{type:'go',screen:'home'},{type:'landed',screen:'home'},{type:'back'}] as const){const next=reducer(state,action);expect(next.finder).toBe(false);expect(next.apps).toBe(false);}
});

it('lets Enter search all results until a suggestion is explicitly selected',()=>{
  type('calendar');const input=host.querySelector<HTMLInputElement>('[aria-label="Search Semester"]')!;
  expect(input.getAttribute('aria-activedescendant')).toBeNull();
  const enter=new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});
  act(()=>input.dispatchEvent(enter));expect(enter.defaultPrevented).toBe(false);
  act(()=>input.closest('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(host.querySelector('.g-global-results')).not.toBeNull();expect(here().screen).toBe('home');
  click('Close search results');act(()=>input.blur());type('calendar');
  act(()=>input.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true})));
  expect(input.getAttribute('aria-activedescendant')).toBe('g-option-top-0');
  act(()=>input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})));
  expect(here().screen).toBe('calendar');
});
it('offers recovery of the closed tab in the organizer',()=>{
  click('Add new tab');click('Your profile');const profile=here();
  click('Close tab: Profile');click('Bookmarks and tab groups');click('Reopen Profile');
  expect(here()).toEqual(profile);expect(host.querySelector('.g-organizer-panel')).toBeNull();
  expect(host.querySelector('[data-work="profile"]')).not.toBeNull();
});
it('disables new-result tabs at capacity while keeping normal search usable',()=>{
  // To the cap, whatever it is — this used to say 10 and stopped reaching
  // capacity the day the cap moved.
  for(let i=1;i<MAX_TABS;i++)click('Add new tab');
  click('Your profile');click('Legacy search entry');type('calendar');const before=strip();
  const newButtons=[...host.querySelectorAll<HTMLButtonElement>('.g-result-new')];
  expect(newButtons.length).toBeGreaterThan(0);expect(newButtons.every(b=>b.disabled)).toBe(true);
  act(()=>newButtons[0].click());expect(strip()).toBe(before);
  expect(host.textContent).toContain('Your tab bar is full');
});
it('does not use tab shortcuts inside a draft field or modal',()=>{
  const draft=host.querySelector<HTMLInputElement>('[aria-label="Keep my draft"]')!;
  act(()=>draft.dispatchEvent(new KeyboardEvent('keydown',{key:'t',code:'KeyT',altKey:true,bubbles:true})));
  expect(strip().tabs).toHaveLength(1);
  click('Open the capture box');const modal=host.querySelector<HTMLElement>('[aria-modal="true"]')!;
  act(()=>modal.dispatchEvent(new KeyboardEvent('keydown',{key:'t',code:'KeyT',altKey:true,bubbles:true})));
  expect(strip().tabs).toHaveLength(1);
});
it('clears remembered search text along with the visible search',()=>{
  click('Legacy search entry');type('calendar');expect(here().query).toBe('calendar');
  click('Clear search');expect(here().query).toBeUndefined();
});

/*
 * The strip follows the app after a second tab exists.
 *
 * `GoogleShell` mounts its children in two places — the workspace body on a
 * screen, `.g-home-legacy` on the search home — so anything given to it as a
 * child was remounted on every navigation between the two. `TabsFollow` read
 * "first render" as "the app has just reloaded", so every remount looked like
 * a reload and its guard against adopting a screen into a blank tab fired on
 * every navigation instead of once. Tabs stayed New tab whatever you opened,
 * and a reload put you on the search page rather than where you were.
 */
it('follows the app even where a shell remounts the follower on every navigation',async()=>{
  // The fault was not the mounting but the guard: "nothing is recorded on the
  // first render" was read off a ref, so a remount looked like a page load and
  // the guard against adopting a screen into a deliberately blank tab fired
  // every time instead of once. Held against the arrangement that exposed it,
  // so the guard stays a fact about the page rather than about a component.
  act(()=>root.unmount());host.remove();forgetStrip();
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
  await act(async()=>root.render(<StoreProvider><AIProvider><Remounting/></AIProvider></StoreProvider>));
  click('Add new tab');click('Semester home');click('Add new tab');click('Your profile');
  expect(here().screen).toBe('profile');
});

it('records where a newly opened tab was taken, not only where the first one was',()=>{
  click('Add new tab');click('Your profile');
  expect(here().screen).toBe('profile');
  // And again after a trip through the search home, which is the navigation
  // that used to remount the follower and silence it for the rest of the
  // session: the second tab would have stayed on the search page for good.
  click('Semester home');
  expect(here().screen).toBe('search');
  click('Add new tab');click('Your profile');
  expect(here().screen).toBe('profile');
  expect(strip().tabs.map(t=>t.screen)).toEqual(['home','search','profile']);
});

it('keeps each study tab on its own unit when switching and reopening',()=>{
  click('Study unit three');const third=here();expect(third.place).toContainEqual({type:'openGuide',id:'econ',mode:'cards',unit:3});
  click('Add new tab');click('Study unit one');const first=here();
  act(()=>host.querySelectorAll<HTMLButtonElement>('.g-tab-select')[0].click());
  expect(here().id).toBe(third.id);expect(host.querySelector('[data-work="guide"]')?.getAttribute('data-unit')).toBe('3');
  act(()=>host.querySelectorAll<HTMLButtonElement>('.g-tab-select')[1].click());
  expect(here().id).toBe(first.id);expect(host.querySelector('[data-work="guide"]')?.getAttribute('data-unit')).toBe('1');
  act(()=>host.querySelectorAll<HTMLButtonElement>('.g-tab-close')[1].click());
  click('Bookmarks and tab groups');click(`Reopen ${first.title}`);
  expect(here().id).toBe(first.id);expect(host.querySelector('[data-work="guide"]')?.getAttribute('data-unit')).toBe('1');
});
