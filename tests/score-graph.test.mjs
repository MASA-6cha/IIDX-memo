import assert from 'node:assert/strict';
import test from 'node:test';
import {loadSource} from './load-source.mjs';
const {buildScoreGraph}=await loadSource('../lib/score-graph.ts');
const {initialLibraryView,parseLibraryView,serializeLibraryView,clearLibraryFilters}=await loadSource('../lib/iidx-view.ts');
const {makeBackup,parseBackup}=await loadSource('../lib/iidx-backup.ts');
const {initialState}=await loadSource('../lib/iidx-data.ts');
const score=(gameVersion,exScore,extra={})=>({gameVersion,exScore,djLevel:'AA',lamp:'CLEAR',pgreat:null,great:null,missCount:null,fetchedAt:'2026-09-28T00:00:00Z',importedAt:'2026-09-28T00:00:00Z',...extra});
test('Chronological series, global current series, missing records and unknown history stay distinct',()=>{
 const scores={'30':score(30,1500),'31':score(31,1600),unknown:score(null,1700)};
 const before=JSON.stringify(scores),g=buildScoreGraph(scores,[33,31,30],true,1000);
 assert.deepEqual(g.rows.map(r=>r.key),['unknown','30','31','33']);
 assert.equal(g.currentVersion,33);assert.equal(g.current.value,null);assert.equal(g.delta,null);
 assert.equal(g.best,1700);assert.equal(g.maxExScore,2000);assert.equal(g.ceiling,2000);
 assert.equal(g.rows[0].current,false);assert.equal(JSON.stringify(scores),before);
 const next=buildScoreGraph({...scores,'33':score(33,1550)},[33,31,30],true,1000);
 assert.equal(next.delta,-50);assert.equal(next.current.rate.percent,77.5);
});
test('Missing notes never invent a MAX; invalid and unrecorded zeros never become bars',()=>{
 const scores={'30':score(30,0,{djLevel:null}),'31':score(31,0,{djLevel:'F'}),'32':score(32,2100),'33':score(33,1700)};
 const g=buildScoreGraph(scores,[30,31,32,33],false,1000);
 assert.equal(g.rows[0].value,null);assert.equal(g.rows[1].value,0);assert.equal(g.rows[2].invalid,true);assert.equal(g.rows[2].value,null);
 assert.equal(g.best,1700);assert.equal(g.delta,1700);
 const unknown=buildScoreGraph(scores,[30,31,32,33],false,null);
 assert.equal(unknown.maxExScore,null);assert.equal(unknown.ceiling,2100);assert.equal(unknown.current.rate.percent,null);
 assert.equal(buildScoreGraph(undefined,[],false,null).best,null);
});
test('Score bar rank and signed nearest boundary use the chart note count',()=>{
 const scores={'30':score(30,1200),'31':score(31,1500),'32':score(32,1540),'33':score(33,1580),'34':score(34,1620),'35':score(35,2000)};
 const rows=buildScoreGraph(scores,[30,31,32,33,34,35],false,1000).rows;
 assert.deepEqual(rows.map(row=>[row.rank,row.nearest?.label,row.nearest?.difference]),[
  ['B','B',88],['A','AA',-56],['A','AA',-16],['AA','AA',24],['AA','AA',64],['MAX','MAX',0]
 ]);
 assert.equal(buildScoreGraph(scores,[30],false,null).rows[0].nearest,null);
});
test('Graph colors and mode round-trip through local preferences and backups; old preferences get defaults',()=>{
 const view={...initialLibraryView(),scoreGraphMode:true,scoreGraphColors:{current:'#123456',past:'#abcdef'}};
 assert.deepEqual(parseLibraryView(serializeLibraryView(view)),view);
 const backup=parseBackup(makeBackup(initialState(),view));assert.deepEqual(backup.view,view);
 assert.deepEqual(clearLibraryFilters(view).scoreGraphColors,view.scoreGraphColors);
 const old={...view,radarMode:true};delete old.scoreGraphColors;delete old.scoreGraphMode;
 const migrated=parseLibraryView(JSON.stringify({version:1,view:old}));
 assert.equal(migrated.radarMode,true);assert.equal(migrated.scoreGraphMode,false);assert.equal(migrated.scoreGraphColors.current,'#39adff');
});
