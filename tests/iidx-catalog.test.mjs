import assert from 'node:assert/strict';
import test from 'node:test';
import {loadSource} from './load-source.mjs';
const {parseCatalog,mergeCatalog,migrateLegacyState,fetchCatalog}=await loadSource('../lib/iidx-catalog.ts');
const {initialState,blankNote}=await loadSource('../lib/iidx-data.ts');

const payload=()=>({
 titles:{1258:'冥',310:'era(nostalmix)',9000:'Synthetic fixture'},
 info:{1258:{artist:'Amuro vs Killer',version:12},310:{artist:'TaQ',version:3},9000:{artist:'Test artist',version:34}},
 charts:{
  1258:{bpm:[66,200],in_ac:true,in_inf:true,level:{sp:[0,5,10,12,0],dp:[0,5,11,12,0]}},
  310:{bpm:[90,180],in_ac:false,in_inf:false,level:{sp:[0,5,8,9,0],dp:[0,5,10,11,0]}},
  9000:{bpm:{sp:[150,0,152,[100,180],150],dp:[150,150,170,176,150]},in_ac:true,in_inf:false,level:{sp:[0,5,8,11,0],dp:[0,5,9,11,0]},notes:{sp:[0,321,678,1000,0],dp:[0,444,888,0,0]}},
 },versions:['1st style','substream','2nd style'],
});

test('Chart note counts use the exact SP/DP difficulty, survive storage and refresh without changing notes',()=>{
 const catalog=parseCatalog(payload()),find=id=>catalog.charts.find(c=>c.id===id);
 assert.equal(find('idt-9000:SP:NORMAL').noteCount,321);
 assert.equal(find('idt-9000:SP:HYPER').noteCount,678);
 assert.equal(find('idt-9000:SP:ANOTHER').noteCount,1000);
 assert.equal(find('idt-9000:DP:HYPER').noteCount,888);
 assert.equal(find('idt-9000:DP:ANOTHER').noteCount,null);
 assert.equal(find('idt-1258:SP:ANOTHER').noteCount,null);
 const stored=JSON.parse(JSON.stringify(catalog)),state=initialState();
 state.notes['idt-9000:SP:ANOTHER:1P']=blankNote();
 const before=structuredClone(state),changed=payload();changed.charts[9000].notes.sp[3]=1100;
 const merged=mergeCatalog(stored,parseCatalog(changed),state);
 assert.equal(merged.catalog.charts.find(c=>c.id==='idt-9000:SP:ANOTHER').noteCount,1100);
 assert.deepEqual(state,before);
 for(const notes of [{sp:[0,1,2,3],dp:[0,1,2,3,4]},{sp:[0,1,-1,3,4],dp:[0,1,2,3,4]},{sp:[0,1,2.5,3,4],dp:[0,1,2,3,4]}]){
  const bad=payload();bad.charts[9000].notes=notes;assert.throws(()=>parseCatalog(bad));
 }
});

test('Convert stable IDs, removed songs, newer series and chart-specific BPM correctly',()=>{
 const c=parseCatalog(payload());
 assert.equal(c.songs.length,3);assert.equal(c.charts.length,18);
 assert.equal(c.songs.find(s=>s.id==='idt-310').removed,true);
 assert.equal(c.seriesNames[34],'ZINRAI');
 const find=id=>c.charts.find(c=>c.id===id);
 assert.equal(find('idt-1258:SP:ANOTHER').bpm,'66–200');
 assert.equal(find('idt-9000:SP:NORMAL').bpm,'—');
 assert.equal(find('idt-9000:SP:HYPER').soflan,false);
 assert.equal(find('idt-9000:DP:HYPER').bpm,'170');
 assert.equal(find('idt-9000:SP:ANOTHER').soflan,true);
});

test('Source IDs keep SP 1P/2P, DP comments and all favorite memberships through migration',()=>{
 const c=parseCatalog(payload()),state=initialState();
 for(const key of ['mei:SP:ANOTHER:1P','mei:SP:ANOTHER:2P','mei:DP:ANOTHER','era:DP:HYPER']){state.notes[key]={...blankNote(),left:{...blankNote().left,comment:key}};}
 state.folders[0].songIds=['mei','era'];state.folders[3].songIds=['mei'];
 const original=structuredClone(state),m=migrateLegacyState(state,c);
 assert.equal(m.moved,4);assert.equal(m.conflicts,0);assert.deepEqual(state,original);
 assert.equal(m.state.notes['idt-1258:SP:ANOTHER:2P'].left.comment,'mei:SP:ANOTHER:2P');
 assert.equal(m.state.notes['idt-1258:DP:ANOTHER'].left.comment,'mei:DP:ANOTHER');
 assert.deepEqual(m.state.folders[0].songIds,['idt-1258','idt-310']);
 assert.deepEqual(m.state.folders[3].songIds,['idt-1258']);
 assert.deepEqual(migrateLegacyState(m.state,c).state,m.state);
});

test('Later omissions retain old songs/charts, and repeated updates do not duplicate them',()=>{
 const old=parseCatalog(payload()),next=parseCatalog(payload()),state=initialState();
 next.songs=next.songs.filter(s=>s.id!=='idt-310');next.charts=next.charts.filter(c=>c.songId!=='idt-310'&&c.id!=='idt-1258:DP:ANOTHER');
 const merged=mergeCatalog(old,next,state);
 assert.equal(merged.catalog.songs.length,old.songs.length);assert.equal(merged.catalog.charts.length,old.charts.length);
 assert.equal(merged.catalog.charts.find(c=>c.id==='idt-1258:DP:ANOTHER').retained,true);
 assert.equal(merged.catalog.songs.find(s=>s.id==='idt-310').retained,true);
 assert.equal(mergeCatalog(merged.catalog,next,state).catalog.charts.length,old.charts.length);
 const reappeared=mergeCatalog(merged.catalog,old,state).catalog;
 assert.equal(reappeared.charts.find(c=>c.id==='idt-1258:DP:ANOTHER').retained,undefined);
});

test('An existing canonical note is never overwritten by a conflicting old sample note',()=>{
 const state=initialState();state.notes['mei:SP:ANOTHER:1P']=blankNote();
 state.notes['idt-1258:SP:ANOTHER:1P']={...blankNote(),flip:true};
 const m=migrateLegacyState(state,parseCatalog(payload()));
 assert.equal(m.conflicts,1);assert.equal(Object.keys(m.state.notes).length,2);
 assert.equal(m.state.notes['idt-1258:SP:ANOTHER:1P'].flip,true);
});

test('Empty, mismatched or invalid payloads and failed network requests are rejected',async()=>{
 for(const change of [p=>{p.titles={};},p=>{delete p.info[310];},p=>{p.charts[1258].level.sp[3]=13;},p=>{p.charts[9000].bpm.sp.pop();}]){const p=payload();change(p);assert.throws(()=>parseCatalog(p));}
 await assert.rejects(fetchCatalog(()=>{},async()=>new Response('',{status:503})),/503/);
 await assert.rejects(fetchCatalog(()=>{},async()=>new Response('<html>unavailable<\/html>')),/JSON/);
 await assert.rejects(fetchCatalog(()=>{},async()=>{throw new TypeError('Network error');}),/接続/);
});
