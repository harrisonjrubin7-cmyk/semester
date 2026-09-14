// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeAll,beforeEach,afterEach,expect,it,vi} from 'vitest';
import {StoreProvider} from '../state/store';
import {AIProvider} from '../ai/store';
import {loadSeed} from '../data/seed';
import {Calendar} from './Calendar';

(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let host:HTMLDivElement;let root:Root;
beforeAll(()=>loadSeed());
beforeEach(async()=>{
  localStorage.clear();vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date(2026,0,31,12));
  window.matchMedia=(()=>({matches:false,addEventListener(){},removeEventListener(){}})) as unknown as typeof window.matchMedia;
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
  await act(async()=>root.render(<StoreProvider><AIProvider><Calendar/></AIProvider></StoreProvider>));
});
afterEach(()=>{act(()=>root.unmount());host.remove();localStorage.clear();vi.useRealTimers();});
function selected(){return host.querySelector<HTMLButtonElement>('[role="gridcell"][aria-selected="true"]')!;}
function page(key:string){act(()=>{selected().focus();selected().dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));});}
it('keeps keyboard focus and the selected date together when paging into a shorter month',()=>{
  expect(selected()?.getAttribute('aria-label')).toContain('31 January');
  page('PageDown');expect(selected().getAttribute('aria-label')).toContain('28 February');expect(document.activeElement).toBe(selected());
  page('PageDown');expect(selected().getAttribute('aria-label')).toContain('28 March');expect(document.activeElement).toBe(selected());
  page('ArrowRight');expect(selected().getAttribute('aria-label')).toContain('29 March');expect(document.activeElement).toBe(selected());
});
it('preserves the selected day across a year boundary and returns to today',()=>{
  page('PageUp');expect(selected().getAttribute('aria-label')).toContain('31 December');
  expect(host.querySelector('[role="grid"]')?.getAttribute('aria-label')).toContain('December 2025');
  expect(document.activeElement).toBe(selected());
  const today=[...host.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.trim()==='Back to today')!;
  act(()=>today.click());expect(selected().getAttribute('aria-label')).toContain('31 January');
  expect(selected().getAttribute('aria-current')).toBe('date');
});
