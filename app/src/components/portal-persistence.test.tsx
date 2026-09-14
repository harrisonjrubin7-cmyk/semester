// @vitest-environment jsdom
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {CampusDirectory,HousingPlanner,MealPlanner} from './CampusDirectory';
import {RegistrationPortal} from './RegistrationPortal';
import {GoogleTabs} from './GoogleTabs';
import {forgetStrip,here,strip} from '../lib/browser.hook';
import {EMPTY_HOUSING,EMPTY_MEALS} from '../lib/portal-storage';

vi.mock('../state/store',()=>({useStore:()=>({dispatch:vi.fn()})}));
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root;let host:HTMLDivElement;
beforeEach(()=>{localStorage.clear();forgetStrip();host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(()=>{act(()=>root.unmount());host.remove();localStorage.clear();forgetStrip();});

it('does not erase an unreadable registration catalog or campus directory on mount',()=>{
  localStorage.setItem('semester.registration.v1','recoverable invalid catalog');
  localStorage.setItem('semester.directory.clubs','recoverable invalid directory');
  act(()=>root.render(<><RegistrationPortal/><CampusDirectory kind="clubs"/></>));
  expect(localStorage.getItem('semester.registration.v1')).toBe('recoverable invalid catalog');
  expect(localStorage.getItem('semester.directory.clubs')).toBe('recoverable invalid directory');
  expect(host.querySelectorAll('[role=alert]')).toHaveLength(2);
  expect(host.textContent).toContain('Download recovery copy');
});

it('loads each term’s housing and meal preferences without overwriting the other term',()=>{
  for(const [term,residence,name] of [['2026FA','North','Fall meals'],['2027SP','South','Spring meals']]){
    localStorage.setItem(`semester.housing-plan.${term}`,JSON.stringify({...EMPTY_HOUSING,residence}));
    localStorage.setItem(`semester.meal-plan.${term}`,JSON.stringify({...EMPTY_MEALS,name}));
  }
  const show=(term:string)=>act(()=>root.render(<><HousingPlanner choice="" term={term}/><MealPlanner choice="" term={term}/></>));
  show('2026FA');expect([...host.querySelectorAll('input')].map(i=>i.value)).toContain('North');
  show('2027SP');const inputs=[...host.querySelectorAll('input')].map(i=>i.value);expect(inputs).toContain('South');expect(inputs).toContain('Spring meals');expect(inputs).not.toContain('North');
  expect(JSON.parse(localStorage.getItem('semester.housing-plan.2026FA')!).residence).toBe('North');
});

it('opens a bookmarked current file in a fully named new tab even without a screen change',()=>{
  const bookmark={id:'bookmarked',screen:'sheet',title:'My marks',place:[{type:'openSheet',id:'s1'}],query:''};
  localStorage.setItem('semester.google.tab-organizer.v1',JSON.stringify({groups:[],membership:{},bookmarks:[bookmark]}));
  act(()=>root.render(<GoogleTabs onNavigate={()=>{}}/>));
  act(()=>host.querySelector<HTMLButtonElement>('[aria-label="Bookmarks and tab groups"]')!.click());
  const open=[...host.querySelectorAll('button')].find(b=>b.textContent?.includes('My marks'))!;
  act(()=>open.click());
  expect(strip().tabs).toHaveLength(2);
  expect(here()).toMatchObject({screen:'sheet',title:'My marks',place:bookmark.place});
});
