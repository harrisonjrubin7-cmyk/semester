import {describe, expect, it} from 'vitest';
import {backupOf, readBackup} from './export';
import {blankDoc} from './document';
import {blankSheet, evaluate} from './sheet';
import {blankDeck} from './decks';
import {fromHash, toHash} from './route';
import {reducer} from '../state/reducer';
import {DEFAULT_PERSISTED, initialEphemeral, type State} from '../state/shape';
import {CATALOG_TEMPLATE, parseCatalog} from './registration';
import {readRegistration, readHousingDraft, readMealDraft} from './portal-storage';

const blank = (): State => ({...DEFAULT_PERSISTED, ...initialEphemeral(new Date('2026-09-13T12:00:00Z'))});

describe('saved work continuity', () => {
  it('restores authored files and formulas through the actual backup and reducer path', () => {
    const source: State = {...blank(),
      documents: [{...blankDoc('Essay'), id:'doc', blocks:[{kind:'text',text:'A saved paragraph.'}]}],
      sheets: [{...blankSheet('Marks'), id:'sheet', cells:{A1:'12',A2:'8',A3:'=SUM(A1:A2)'}}],
      decks: [{...blankDeck('Seminar'), id:'deck'}],
      term:'2026F', accessLeadDays:7,
    };
    const copy = readBackup(JSON.stringify(backupOf(source)));
    const restored = reducer(blank(), {type:'restore', persisted:copy.data});
    expect(restored.documents).toEqual(source.documents);
    expect(restored.sheets).toEqual(source.sheets);
    expect(restored.decks).toEqual(source.decks);
    expect(evaluate(restored.sheets[0].cells,'A3')).toBe(20);
    expect(restored.term).toBe(source.term);
    expect(restored.accessLeadDays).toBe(7);
  });

  it.each(['write','sheet','deck'] as const)('keeps %s file identity in deep links and returns to its library', screen => {
    const field = {write:'documentId',sheet:'sheetId',deck:'deckId'}[screen] as 'documentId'|'sheetId'|'deckId';
    const route = fromHash(toHash({screen,id:'saved / file'}))!;
    const opened = reducer(blank(), {type:'landed',...route});
    expect(opened[field]).toBe('saved / file');
    const library = reducer(opened,{type:'landed',screen,id:''});
    expect(library[field]).toBeNull();
    const again = reducer(library,{type:'landed',...route});
    expect(again[field]).toBe('saved / file');
  });
});

describe('saved portal records', () => {
  it('reopens normalized catalog times and saved alternative schedules without changing them', () => {
    const catalog = parseCatalog(JSON.stringify(CATALOG_TEMPLATE));
    const stored = {catalog,cart:[catalog.courses[0].id],plans:[{id:'p1',name:'Morning classes',courses:catalog.courses}]};
    expect(readRegistration(JSON.parse(JSON.stringify(stored)))).toEqual(stored);
  });
  it('refuses malformed plans and preferences instead of replacing them with empty defaults', () => {
    expect(()=>readRegistration({catalog:null,cart:[],plans:[{id:'p',name:'Plan',courses:[{title:'Incomplete'}]}]})).toThrow();
    expect(()=>readHousingDraft({residence:'Hall',checks:'wrong'})).toThrow();
    expect(()=>readMealDraft({name:'Meals',weekly:NaN,weeks:'14',cost:'200'})).toThrow();
  });
});
