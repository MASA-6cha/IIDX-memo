import assert from 'node:assert/strict';
import test from 'node:test';
import {loadSource} from './load-source.mjs';
const {collectPlayHistory,applyPlayImport,matchPlayImport,playDataSchema}=await loadSource('../lib/play-data.ts');
const {bestPlayScore,resolvePlayRecords,chartPlayHistory,storedPlayVersions}=await loadSource('../lib/play-history.ts');
const {initialState}=await loadSource('../lib/iidx-data.ts');
const {makeBackup,parseBackup}=await loadSource('../lib/iidx-backup.ts');
const {initialLibraryView,serializeLibraryView,parseLibraryView,clearLibraryFilters}=await loadSource('../lib/iidx-view.ts');
const {migrateLegacyState,canonicalChartId,mergeCatalog}=await loadSource('../lib/iidx-catalog.ts');
const at='2026-09-23T00:00:00.000Z';
const id='mei:SP:ANOTHER';
const chart={id,songId:'mei',mode:'SP',difficulty:'ANOTHER',level:12,unofficialRatings:{}};
const song={id:'mei',title:'冥',artist:'Amuro vs Killer',series:12,bpm:'66-200',soflan:true,removed:false};
const score=(gameVersion,exScore,extra={})=>({gameVersion,exScore,pgreat:null,great:null,missCount:null,djLevel:exScore===null?null:'AA',lamp:'HARD CLEAR',fetchedAt:at,importedAt:at,...extra});
const entry=value=>({mode:'SP',title:'冥',difficulty:'ANOTHER',level:12,score:value});
const matches=entries=>matchPlayImport({entries:entries.map(entry),legacy:false,duplicates:0},[song],[chart]);

test('Legacy records survive imports of new series; re-import updates only its own series',()=>{
 const original={...initialState(),playData:{records:{[id]:score(32,2300)},imports:{}}};
 const before=JSON.stringify(original);
 const next=applyPlayImport(original,matches([score(33,2100)]),at);
 assert.equal(JSON.stringify(original),before);
 assert.equal(next.playData.history[id]['32'].exScore,2300);
 assert.equal(next.playData.history[id]['33'].exScore,2100);
 const updated=applyPlayImport(next,matches([score(33,2400)]),at);
 assert.equal(updated.playData.history[id]['32'].exScore,2300);
 assert.equal(updated.playData.history[id]['33'].exScore,2400);
 assert.equal(next.playData.history[id]['33'].exScore,2100);
 assert.deepEqual(parseBackup(makeBackup(updated)).data,updated);
 assert.equal(playDataSchema.safeParse(updated.playData).success,true);
});

test('Mixed-series CSV can match one chart more than once; same-series conflicts still require review',()=>{
 assert.deepEqual(matches([score(32,2300),score(33,2100)]).map(m=>m.reason),['matched','matched']);
 assert.deepEqual(matches([score(33,2300),score(33,2100)]).map(m=>m.reason),['duplicate','duplicate']);
});

test('Best EX uses a coherent score/DJ record and latest-series clear without comparing lamp strength',()=>{
 const old=score(32,2400,{djLevel:'AAA',lamp:'FULLCOMBO CLEAR'}),current=score(33,2200,{djLevel:'AA',lamp:'NO PLAY'});
 const best=bestPlayScore([current,old]);
 assert.equal(best.exScore,2400);assert.equal(best.djLevel,'AAA');assert.equal(best.gameVersion,32);
 assert.equal(best.lamp,'NO PLAY');assert.equal(best.lampVersion,33);
 const tie=bestPlayScore([old,score(33,2400)]);assert.equal(tie.gameVersion,33);
 assert.equal(bestPlayScore([]),undefined);
 assert.equal(bestPlayScore([score(32,null),score(33,0)]).gameVersion,33);
});

test('Explicit series and latest selection leave absent charts missing; unknown never gets an invented series',()=>{
 const history=collectPlayHistory({records:{[id]:score(32,2300),'other:DP:ANOTHER':score(33,1500),'old:SP:HYPER':score(null,2000)},imports:{}});
 assert.deepEqual(storedPlayVersions(history),{versions:[33,32],unknown:true});
 assert.equal(resolvePlayRecords(history,'latest')[id],undefined);
 assert.equal(resolvePlayRecords(history,'version:32')[id].exScore,2300);
 assert.equal(resolvePlayRecords(history,'unknown')['old:SP:HYPER'].gameVersion,null);
 assert.equal(resolvePlayRecords(history,'best')[id].exScore,2300);
 assert.equal(chartPlayHistory(history,'missing:SP:ANOTHER').length,0);
});

test('History is validated in backups, survives catalog ID migration and keeps charts with history only',()=>{
 const base={...initialState(),playData:{records:{},imports:{},history:{[id]:{'32':score(32,2100),'33':score(33,2300)}}}};
 const catalog=mergeCatalog(null,{schemaVersion:1,source:'iidx-data-table',fetchedAt:at,sourceUpdatedAt:null,seriesNames:{},songs:[],charts:[]},base).catalog;
 assert(catalog.charts.some(c=>c.id===canonicalChartId(id)));
 const migrated=migrateLegacyState(base,catalog).state;
 assert.deepEqual(Object.keys(migrated.playData.history[canonicalChartId(id)]),['32','33']);
 assert.equal(migrated.playData.history[id],undefined);
 assert.deepEqual(parseBackup(makeBackup(migrated)).data,migrated);
 const invalid=JSON.parse(makeBackup(base));invalid.data.playData.history[id]['32'].gameVersion=33;
 assert.throws(()=>parseBackup(JSON.stringify(invalid)));
});

test('Score selection persists and is preserved by filter reset; existing views default to latest',()=>{
 for(const scoreSource of ['latest','best','unknown','version:32','version:33']){
  const view={...initialLibraryView(),scoreSource};
  assert.equal(parseLibraryView(serializeLibraryView(view)).scoreSource,scoreSource);
  assert.equal(clearLibraryFilters(view).scoreSource,scoreSource);
 }
 const old={...initialLibraryView()};delete old.scoreSource;
 assert.equal(parseLibraryView(JSON.stringify({version:1,view:old})).scoreSource,'latest');
});
