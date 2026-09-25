import assert from 'node:assert/strict';
import test from 'node:test';
import {loadSource} from './load-source.mjs';
const {applyManualPlay,deletePlaySeries,playSeriesCounts}=await loadSource('../lib/play-edit.ts');
const {collectPlayHistory,playDataSchema,applyPlayImport}=await loadSource('../lib/play-data.ts');
const {bestPlayScore}=await loadSource('../lib/play-history.ts');
const {makeBackup,parseBackup}=await loadSource('../lib/iidx-backup.ts');
const {initialState}=await loadSource('../lib/iidx-data.ts');
const at='2026-09-23T00:00:00.000Z',later='2026-09-23T01:00:00.000Z';
const chart={id:'song:SP:ANOTHER',songId:'song',mode:'SP',difficulty:'ANOTHER',level:12,noteCount:1000,unofficialRatings:{}};
const score=(version,extra={})=>({gameVersion:version,exScore:1600,pgreat:700,great:200,missCount:12,lamp:'HARD CLEAR',djLevel:'AA',fetchedAt:at,importedAt:at,...extra});
const state=()=>({...initialState(),playData:{records:{[chart.id]:score(32)},imports:{SP:{at,count:1,gameVersion:32}},history:{[chart.id]:{'32':score(32),'33':score(33)}}}});

test('Manual changes only affect the chosen fields and series, keep provenance, and survive backups',()=>{
 const original=state(),before=JSON.stringify(original);
 const changed=applyManualPlay(original,chart,{gameVersion:33,exScore:1800},later);
 const scores=collectPlayHistory(changed.playData)[chart.id];
 assert.equal(scores['33'].exScore,1800);assert.equal(scores['33'].djLevel,'AAA');assert.equal(scores['33'].lamp,'HARD CLEAR');
 assert.equal(scores['33'].pgreat,null);assert.equal(scores['33'].great,null);assert.equal(scores['33'].missCount,null);
 assert.deepEqual(scores['33'].manual,{score:later});assert.equal(scores['32'].exScore,1600);assert.equal(JSON.stringify(original),before);
 const clearOnly=applyManualPlay(changed,chart,{gameVersion:33,lamp:'EASY CLEAR'},later);
 assert.equal(clearOnly.playData.history[chart.id]['33'].exScore,1800);
 assert.deepEqual(clearOnly.playData.history[chart.id]['33'].manual,{score:later,lamp:later});
 assert.deepEqual(clearOnly.playData.imports,original.playData.imports);
 assert(playDataSchema.safeParse(clearOnly.playData).success);
 assert.deepEqual(parseBackup(makeBackup(clearOnly)).data,clearOnly);
 const imported=applyPlayImport(clearOnly,[{target:chart,entry:{mode:'SP',score:score(33,{exScore:1700})}}],later);
 assert.equal(imported.playData.history[chart.id]['33'].manual,undefined);
});

test('Manual validation enforces score limits; empty and zero have distinct meanings',()=>{
 const base=initialState();
 for(const exScore of [-1,2001,1.5,NaN,Infinity,undefined])assert.throws(()=>applyManualPlay(base,chart,{gameVersion:33,exScore},later));
 for(const gameVersion of [0,1.5,1000])assert.throws(()=>applyManualPlay(base,chart,{gameVersion,lamp:'CLEAR'},later));
 assert.throws(()=>applyManualPlay(base,chart,{gameVersion:33},later));
 const empty=applyManualPlay(base,chart,{gameVersion:null,lamp:'CLEAR'},later).playData.records[chart.id];
 assert.equal(empty.exScore,null);assert.equal(empty.djLevel,null);assert.deepEqual(empty.manual,{lamp:later});
 const zero=applyManualPlay(base,chart,{gameVersion:33,exScore:0},later).playData.records[chart.id];assert.equal(zero.djLevel,'F');
 const removed=applyManualPlay(state(),chart,{gameVersion:32,exScore:null},later).playData.records[chart.id];assert.equal(removed.djLevel,null);assert.equal(removed.lamp,'HARD CLEAR');
 const unknownNotes=applyManualPlay(base,{...chart,noteCount:null},{gameVersion:33,exScore:1500},later).playData.records[chart.id];assert.equal(unknownNotes.djLevel,null);
});

test('Deleting a series removes every SP/DP/legacy record without resurrection or damage to other data',()=>{
 const original=state();original.playData.records['other:DP:NORMAL']=score(32,{manual:{lamp:later}});original.playData.records['unknown:SP:NORMAL']=score(null);
 const before=JSON.stringify(original),deleted=deletePlaySeries(original,32);
 assert.equal(JSON.stringify(original),before);
 const history=collectPlayHistory(deleted.playData);
 assert.equal(history[chart.id]['32'],undefined);assert.equal(history[chart.id]['33'].gameVersion,33);assert.equal(history['other:DP:NORMAL'],undefined);
 assert.equal(deleted.playData.records[chart.id].gameVersion,33);assert.equal(deleted.playData.imports.SP,undefined);
 assert.equal(history['unknown:SP:NORMAL'].unknown.gameVersion,null);
 assert.deepEqual(deleted.notes,original.notes);assert.deepEqual(deleted.folders,original.folders);assert.deepEqual(deleted.preferences,original.preferences);
 assert.deepEqual(parseBackup(makeBackup(deleted)).data,deleted);
 const noKnown=deletePlaySeries(deleted,33),empty=deletePlaySeries(noKnown,null);assert.deepEqual(collectPlayHistory(empty.playData),{});assert.deepEqual(empty.playData.records,{});
 assert.deepEqual(playSeriesCounts(collectPlayHistory(original.playData)).map(x=>[x.key,x.SP,x.DP,x.manual]),[['33',1,0,0],['32',1,1,1],['unknown',1,0,0]]);
});

test('All-time best preserves manual provenance from the EX source and the latest clear independently',()=>{
 const old=score(32,{exScore:1900,manual:{score:later,lamp:later}}),current=score(33,{exScore:1600});
 assert.deepEqual(bestPlayScore([current,old]).manual,{score:later});
 const best=bestPlayScore([score(32,{exScore:1900}),score(33,{manual:{score:later,lamp:later}})]);
 assert.deepEqual(best.manual,{lamp:later});assert.equal(best.lampVersion,33);assert.equal(best.gameVersion,32);
});
