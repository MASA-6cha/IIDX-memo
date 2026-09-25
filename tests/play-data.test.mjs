import assert from 'node:assert/strict';
import test from 'node:test';
import {loadSource} from './load-source.mjs';
const {parsePlayImport,matchPlayImport,applyPlayImport,PlayModeRequired,matchesPlayFilter,playCsvHeaders,readPlayCsv}=await loadSource('../lib/play-data.ts');
const {initialState,blankNote,songs,charts}=await loadSource('../lib/iidx-data.ts');
const {makeBackup,parseBackup}=await loadSource('../lib/iidx-backup.ts');
const {migrateLegacyState,mergeCatalog,canonicalChartId}=await loadSource('../lib/iidx-catalog.ts');
const {initialLibraryView,parseLibraryView,serializeLibraryView,clearLibraryFilters}=await loadSource('../lib/iidx-view.ts');
const now='2026-09-20T01:00:00.000Z';
const row=(mode='SP',title='冥',diff='ANOTHER',level='12')=>[mode,title,diff,level,'3200','1500','200','HARD CLEAR','AA','34',now];
const csv=(rows)=>[playCsvHeaders,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');

test('Quoted Japanese CSV with BOM, commas, quotes and newlines preserves titles and separates SP/DP',()=>{
 const title='テスト, "譜面"\n改行';
 assert.equal(readPlayCsv('\uFEFF'+csv([row('SP',title)]))[1][1],title);
 const parsed=parsePlayImport(csv([row(),row('DP')]),undefined,now);
 const matched=matchPlayImport(parsed,songs,charts);
 assert.deepEqual(matched.map(m=>m.target.id),['mei:SP:ANOTHER','mei:DP:ANOTHER']);
 assert.equal(parsed.entries[0].score.pgreat,1500);
});
test('Legacy CSV needs explicit mode and never treats an unfetched difficulty as NO PLAY',()=>{
 const headers=['タイトル',...['NORMAL','HYPER','ANOTHER'].flatMap(d=>[`${d} 難易度`,`${d} スコア`,`${d} クリアタイプ`])];
 const text=[headers,['冥','-','0','NO PLAY','-','0','NO PLAY','12','3200','HARD CLEAR']].map(r=>r.join(',')).join('\n');
 assert.throws(()=>parsePlayImport(text),PlayModeRequired);
 const parsed=parsePlayImport(text,'DP',now);
 assert.equal(parsed.entries.length,1);assert.equal(parsed.entries[0].mode,'DP');assert.equal(parsed.entries[0].difficulty,'ANOTHER');
 assert.equal(parsed.entries[0].score.pgreat,null);assert.equal(parsed.entries[0].score.gameVersion,null);
});
test('Malformed rows, partial copying and contradictory scores reject the entire import',()=>{
 const bad=row();bad[4]='3000';
 const unknown=row();unknown[7]='???';
 for(const text of [csv([row(),bad]),csv([unknown]),csv([row()]).slice(0,-2),csv([row()]).replace('"SP"','"SP"broken')])assert.throws(()=>parsePlayImport(text));
});
test('Ambiguous same-title charts, level mismatches and conflicting rows require explicit choices',()=>{
 const song=songs.find(s=>s.id==='mei'),chart=charts.find(c=>c.id==='mei:SP:ANOTHER');
 const duplicateSong={...song,id:'other-mei'},duplicateChart={...chart,id:'other-mei:SP:ANOTHER',songId:'other-mei'};
 const parsed=parsePlayImport(csv([row()]),undefined,now);
 assert.equal(matchPlayImport(parsed,[song,duplicateSong],[chart,duplicateChart])[0].target,null);
 assert.equal(matchPlayImport(parsed,[song,duplicateSong],[chart,duplicateChart],{0:chart.id})[0].target.id,chart.id);
 assert.equal(matchPlayImport(parsed,[song],[{...chart,level:11}])[0].target,null);
 const second=row();second[7]='CLEAR';const conflict=parsePlayImport(csv([row(),second]),undefined,now);
 assert.deepEqual(matchPlayImport(conflict,[song],[chart]).map(m=>m.reason),['duplicate','duplicate']);
 const resolved=matchPlayImport(conflict,[song],[chart],{1:''});assert.equal(resolved[0].target.id,chart.id);assert.equal(resolved[1].target,null);
 assert.equal(parsePlayImport(csv([row(),row()])).duplicates,1);
});
test('Partial updates retain previous scores, both SP-side notes and favorites, and round-trip in backups',()=>{
 const state=initialState();state.notes['mei:SP:ANOTHER:1P']=blankNote();state.notes['mei:SP:ANOTHER:2P']={...blankNote(),flip:true};state.folders[0].songIds=['mei'];
 const first=applyPlayImport(state,matchPlayImport(parsePlayImport(csv([row(),row('DP')])),songs,charts),now);
 const next=row();next[7]='EX HARD CLEAR';const updated=applyPlayImport(first,matchPlayImport(parsePlayImport(csv([next])),songs,charts),now);
 assert.equal(updated.playData.records['mei:DP:ANOTHER'].lamp,'HARD CLEAR');assert.equal(updated.playData.records['mei:SP:ANOTHER'].lamp,'EX HARD CLEAR');
 assert.deepEqual(updated.notes,state.notes);assert.deepEqual(updated.folders,state.folders);assert.equal(state.playData,undefined);
 assert.deepEqual(parseBackup(makeBackup(updated)).data,updated);assert.deepEqual(parseBackup(makeBackup(state)).data,state);
 const invalid=JSON.parse(makeBackup(updated));invalid.data.playData.records['mei:SP:ANOTHER'].lamp='???';assert.throws(()=>parseBackup(JSON.stringify(invalid)));
 assert.throws(()=>applyPlayImport(updated,[]));
});
test('Catalog migration and omissions retain imported scores even without option notes',()=>{
 const base=applyPlayImport(initialState(),matchPlayImport(parsePlayImport(csv([row()])),songs,charts),now);
 const catalog={schemaVersion:1,source:'iidx-data-table',fetchedAt:now,seriesNames:{},songs:[],charts:[]};
 const merged=mergeCatalog(null,catalog,base).catalog;
 assert.ok(merged.charts.some(c=>c.id===canonicalChartId('mei:SP:ANOTHER')));
 const migrated=migrateLegacyState(base,merged).state;
 assert.ok(migrated.playData.records[canonicalChartId('mei:SP:ANOTHER')]);
 assert.equal(migrated.playData.records['mei:SP:ANOTHER'],undefined);
});
test('Missing and NO PLAY remain different; display and lamp filters persist and reset correctly',()=>{
 const score=parsePlayImport(csv([row()])).entries[0].score;
 assert.equal(matchesPlayFilter(undefined,'NO PLAY'),false);assert.equal(matchesPlayFilter(undefined,'missing'),true);
 assert.equal(matchesPlayFilter({...score,lamp:'NO PLAY',exScore:0},'played'),false);assert.equal(matchesPlayFilter(score,'played'),true);
 const view={...initialLibraryView(),playStatus:'HARD CLEAR',showPlayData:false,playDisplay:{clear:false,dj:true,ex:false,rate:true,difference:false,notes:false}};
 assert.deepEqual(parseLibraryView(serializeLibraryView(view)),view);assert.equal(clearLibraryFilters(view).playStatus,'all');assert.equal(clearLibraryFilters(view).showPlayData,false);
 const older={...view};delete older.playStatus;delete older.showPlayData;assert.equal(parseLibraryView(serializeLibraryView(older)).showPlayData,true);
 assert.deepEqual(clearLibraryFilters(view).playDisplay,view.playDisplay);
 delete older.playDisplay;
 const migrated=parseLibraryView(serializeLibraryView({...older,showPlayData:false}));
 assert.equal(migrated.showPlayData,false);assert.deepEqual(migrated.playDisplay,initialLibraryView().playDisplay);
 assert.deepEqual(parseLibraryView(serializeLibraryView({...view,playDisplay:{clear:false}})).playDisplay,{...initialLibraryView().playDisplay,clear:false});
});

test('Official NO PLAY with a positive score survives import, storage and backup',()=>{
 const source=row();source[7]='NO PLAY';
 const parsed=parsePlayImport(csv([source]),undefined,now);
 const state=applyPlayImport(initialState(),matchPlayImport(parsed,songs,charts),now);
 const score=state.playData.records['mei:SP:ANOTHER'];
 assert.equal(score.lamp,'NO PLAY');assert.equal(score.exScore,3200);assert.equal(score.djLevel,'AA');
 assert.equal(matchesPlayFilter(score,'played'),true);assert.equal(matchesPlayFilter(score,'NO PLAY'),true);
 assert.deepEqual(parseBackup(makeBackup(state)).data,state);
});
