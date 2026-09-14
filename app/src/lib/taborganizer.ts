import { load, type AppTab } from './browser';
export interface TabGroup { id: string; name: string; color: string; collapsed: boolean }
export interface TabOrganizer { groups: TabGroup[]; membership: Record<string,string>; bookmarks: AppTab[] }
export const GROUP_COLORS = ['#4285f4','#34a853','#a142f4','#e8710a','#d93025','#00897b'];
export function readOrganizer(raw: string | null, known: (screen:string)=>boolean): TabOrganizer {
  const empty: TabOrganizer = {groups:[],membership:{},bookmarks:[]};
  try {
    if(!raw) return empty;
    const value = JSON.parse(raw);
    const groups: TabGroup[] = (Array.isArray(value.groups) ? value.groups : []).filter((g:TabGroup) => typeof g?.id === 'string' && typeof g.name === 'string' && g.name.trim()).slice(0,30).map((g:TabGroup) => ({id:g.id,name:g.name.slice(0,40),color:GROUP_COLORS.includes(g.color)?g.color:GROUP_COLORS[0],collapsed:g.collapsed===true}));
    const membership:Record<string,string> = {};
    if(value.membership && typeof value.membership === 'object') for(const [id,group] of Object.entries(value.membership)) if(typeof group === 'string' && groups.some(g=>g.id===group)) membership[id]=group;
    // Reuse the tab loader: bookmarks may replay navigation actions only.
    const bookmarks = (Array.isArray(value.bookmarks) ? value.bookmarks : []).filter((b:AppTab)=>b && (b.screen===null || typeof b.screen==='string' && known(b.screen))).slice(0,100).map((b:AppTab) => load(JSON.stringify({tabs:[b],at:0}),known).tabs[0]);
    return {groups,membership,bookmarks};
  } catch { return empty; }
}
export function samePlace(a:AppTab,b:AppTab):boolean { return a.screen===b.screen && JSON.stringify(a.place)===JSON.stringify(b.place); }
