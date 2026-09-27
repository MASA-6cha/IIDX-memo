import assert from 'node:assert/strict';
import test from 'node:test';
import {loadSource} from './load-source.mjs';
const {parsePlayImport,matchPlayImport,applyPlayImport,playEntriesCsv,playDataSchema}=await loadSource('../lib/play-data.ts');
const {officialSeriesNumber,officialLastPlayed,officialCsvMode,decodePlayCsv}=await loadSource('../lib/official-score-csv.ts');
const {resolveSongPlayRecord,bestPlayScore}=await loadSource('../lib/play-history.ts');
const {applyManualPlay,deletePlaySeries}=await loadSource('../lib/play-edit.ts');
const {initialState}=await loadSource('../lib/iidx-data.ts');
const {migrateLegacyState}=await loadSource('../lib/iidx-catalog.ts');
const {makeBackup,parseBackup}=await loadSource('../lib/iidx-backup.ts');
const {initialLibraryView}=await loadSource('../lib/iidx-view.ts');
const now='2026-09-27T12:00:00.000Z';
const diffs=['BEGINNER','NORMAL','HYPER','ANOTHER','LEGGENDARIA'];
const headers=['バージョン','タイトル','ジャンル','アーティスト','プレー回数',...diffs.flatMap(d=>['難易度','スコア','PGreat','Great','ミスカウント','クリアタイプ','DJ LEVEL'].map(f=>`${d} ${f}`)),'最終プレー日時'];
const row=(version='EPOLIS',title='テスト,曲',count=7)=>[version,title,'ジャンル','アーティスト',count,...diffs.flatMap(d=>d==='NORMAL'||d==='ANOTHER'?[10,190,90,10,0,'FULLCOMBO CLEAR','AAA']:[0,0,0,0,'---','NO PLAY','---']),'2024-04-02 11:11'];
const csv=(rows)=>[headers,...rows].map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\r\n');
const songs=[{id:'test',title:'テスト，曲',artist:'アーティスト',series:10,removed:false}],charts=['NORMAL','ANOTHER'].map(d=>({id:`test:SP:${d}`,songId:'test',mode:'SP',difficulty:d,level:10,noteCount:100}));
const parsed=()=>parsePlayImport('\uFEFF'+csv([row()]),'SP',now);
const imported=(state=initialState(),data=parsed())=>applyPlayImport(state,matchPlayImport(data,songs,charts),now);
test('Official CSV uses final debut name as export series for every row, skips unavailable charts, and preserves zero',()=>{
 const data=parsePlayImport(csv([row('HAPPY SKY','旧曲'),row()]),'DP',now);
 assert.equal(data.official.gameVersion,31);assert.equal(data.entries.length,4);
 assert.ok(data.entries.every(e=>e.score.gameVersion===31&&e.mode==='DP'));
 assert.equal(data.entries[0].score.missCount,0);assert.equal(data.entries[0].songRecord.playCount,7);
 assert.equal(data.entries[0].songRecord.lastPlayedAt,'2024-04-02T02:11:00.000Z');
 assert.equal(officialSeriesNumber('1st&substream'),1);assert.equal(officialSeriesNumber('ＤｉｓｔｏｒｔｅＤ'),13);assert.equal(officialSeriesNumber('unknown'),null);
 assert.equal(officialCsvMode('01-IIDX31-1234-5678_sp_score.csv'),'SP');assert.equal(officialCsvMode('x_dp_score.csv'),'DP');assert.equal(officialCsvMode('x.csv'),undefined);
 assert.equal(decodePlayCsv(new TextEncoder().encode('\uFEFF日本語').buffer),'日本語');
 assert.throws(()=>officialLastPlayed('2024-02-30 12:00'));assert.throws(()=>officialLastPlayed('2024-04-01 25:00'));
 assert.equal(officialLastPlayed('---'),null);
});
test('Song-level counts are once per mode/series, reimport replaces, and extended CSV retains all values',()=>{
 const state=imported(),again=imported(state),record=again.playData.songRecords['test:SP']['31'];
 assert.equal(record.playCount,7);assert.equal(Object.keys(again.playData.songRecords).length,1);
 assert.deepEqual(playDataSchema.parse(again.playData),again.playData);
 const round=parsePlayImport(playEntriesCsv(parsed().entries),undefined,now);
 assert.deepEqual(round.entries,parsed().entries);
 const next=parsed();for(const e of next.entries){e.score.gameVersion=32;e.songRecord.gameVersion=32;e.songRecord.playCount=3;}
 const combined=imported(again,next),best=resolveSongPlayRecord(combined.playData.songRecords['test:SP'],'best',combined.playData.history);
 assert.equal(best.playCount,10);assert.equal(resolveSongPlayRecord(combined.playData.songRecords['test:SP'],'version:31',combined.playData.history).playCount,7);
 assert.equal(resolveSongPlayRecord(combined.playData.songRecords['test:SP'],'latest',combined.playData.history).playCount,3);
 assert.deepEqual(parseBackup(makeBackup(combined,initialLibraryView())).data.playData.songRecords,combined.playData.songRecords);
 const edited=applyManualPlay(combined,charts[0],{gameVersion:31,lamp:'CLEAR'},now);
 assert.deepEqual(edited.playData.songRecords,combined.playData.songRecords);
 const deleted=deletePlaySeries(edited,31);assert.equal(deleted.playData.songRecords['test:SP']['31'],undefined);assert.equal(deleted.playData.songRecords['test:SP']['32'].playCount,3);
});
test('Best EX keeps its own judgements while minimum miss is independently selected; unknown counts are not double counted',()=>{
 const a={...parsed().entries[0].score,missCount:5},b={...a,gameVersion:32,exScore:180,pgreat:80,great:20,missCount:0};
 const best=bestPlayScore([a,b]);assert.equal(best.pgreat,90);assert.equal(best.great,10);assert.equal(best.missCount,0);assert.equal(best.missVersion,32);
 const r=parsed().entries[0].songRecord;assert.equal(resolveSongPlayRecord({'31':r,unknown:{...r,gameVersion:null}},'best',{}).playCount,7);
});
test('Database identity migration carries song statistics and keeps conflicting old records',()=>{
 const state=imported(),catalog={songs:[{...songs[0],id:'canonical'}],charts:[],songIdentities:{links:{},redirects:{test:'canonical'}}};
 const migrated=migrateLegacyState(state,catalog).state;assert.equal(migrated.playData.songRecords['canonical:SP']['31'].playCount,7);assert.equal(migrated.playData.songRecords['test:SP'],undefined);
 state.playData.songRecords['canonical:SP']={'31':{...state.playData.songRecords['test:SP']['31'],playCount:8}};
 const conflict=migrateLegacyState(state,catalog);assert.ok(conflict.conflicts);assert.equal(conflict.state.playData.songRecords['test:SP']['31'].playCount,7);
});
test('A CSV song row cannot assign its different difficulties to different database songs',()=>{
 const alt={...songs[0],id:'other'},altChart={...charts[1],songId:'other',id:'other:SP:ANOTHER'};
 const matches=matchPlayImport(parsed(),[songs[0],alt],[charts[0],altChart]);assert.ok(matches.every(m=>m.target===null));
});

test('Official unquoted fields preserve literal double quotes without weakening custom CSV validation',()=>{
 const r=row('EPOLIS','Song type"Test"-');r[3]='Team "Artist"';
 const data=parsePlayImport([headers,r].map(r=>r.join(',')).join('\n'),'SP',now);
 assert.equal(data.entries[0].title,'Song type"Test"-');assert.equal(data.entries[0].artist,'Team "Artist"');
});

const oldHeaders=['バージョン','タイトル','ジャンル','アーティスト','プレー回数',...['NORMAL','HYPER','ANOTHER'].flatMap(d=>['難易度','スコア','PGreat','Great','ミスカウント','クリアタイプ','DJ LEVEL'].map(f=>`${d} ${f}`)),'最終プレー日時'];
const oldRow=(title,count=2,date='2018-04-02 11:11',series='Rootage')=>[series,title,'TEST','Artist',count,...['NORMAL','HYPER','ANOTHER'].flatMap(d=>d==='ANOTHER'?[12,190,90,10,0,'FULLCOMBO CLEAR','AAA']:[0,0,0,0,'---','NO PLAY','---']),date];
const oldCsv=rows=>[oldHeaders,...rows].map(r=>r.join(',')).join('\n');
test('IIDX21-26 suffix songs map ANOTHER to LEGGENDARIA and merge counts once with latest date',()=>{
 for(const suffix of ['†LEGGENDARIA','†'])for(const version of ['SPADA','PENDUAL','copula','SINOBUZ','CANNON BALLERS','Rootage']){
  const main=oldRow('Test',2,'2018-04-03 11:11',version),leg=oldRow('Test'+suffix,3,'2018-04-02 11:11',version);
  const data=parsePlayImport(oldCsv([leg,main,leg]),'DP',now);
  assert.deepEqual(data.entries.map(e=>e.difficulty),['LEGGENDARIA','ANOTHER']);assert.equal(data.duplicates,1);
  assert.ok(data.entries.every(e=>e.title==='Test'&&e.songRecord.playCount===5&&e.songRecord.lastPlayedAt==='2018-04-03T02:11:00.000Z'));
  assert.deepEqual(parsePlayImport(playEntriesCsv(data.entries),undefined,now).entries,data.entries);
 }
});
test('Daggers inside actual titles stay unchanged; suffix normalization is limited to old official structure and series',()=>{
 for(const title of ['perditus†paradisus','†渚の小悪魔ラヴリィ～レイディオ†(IIDX EDIT)','DEATH†ZIGOQ ～怒りの高速爆走野郎～','Ignis†Irae']){
  const data=parsePlayImport(oldCsv([oldRow(title)]),'SP',now);assert.equal(data.entries[0].title,title);assert.equal(data.entries[0].difficulty,'ANOTHER');
 }
 for(const version of ['Lincle','HEROIC VERSE','EPOLIS']){
  const data=parsePlayImport(oldCsv([oldRow('Test†',2,'2018-04-02 11:11',version)]),'SP',now);assert.equal(data.entries[0].title,'Test†');assert.equal(data.entries[0].difficulty,'ANOTHER');
 }
 const modern=parsePlayImport(csv([row('EPOLIS','Test†')]),'SP',now);assert.equal(modern.entries[0].title,'Test†');
});
test('Old companion rows retain zero/missing values and save merged counts idempotently per song/mode/series',()=>{
 const data=parsePlayImport(oldCsv([oldRow('Test',0,'---'),oldRow('Test†',3)]),'SP',now);
 const ss=[{id:'old',title:'Test',artist:'Artist',series:21,removed:false}],cc=['ANOTHER','LEGGENDARIA'].map(d=>({id:`old:SP:${d}`,songId:'old',mode:'SP',difficulty:d,level:12}));
 const matches=matchPlayImport(data,ss,cc);assert.ok(matches.every(m=>m.target));
 const first=applyPlayImport(initialState(),matches,now),second=applyPlayImport(first,matches,now);
 assert.equal(second.playData.songRecords['old:SP']['26'].playCount,3);assert.equal(Object.keys(second.playData.history).length,2);
 assert.equal(second.playData.history['old:SP:LEGGENDARIA']['26'].exScore,190);
 const single=parsePlayImport(oldCsv([oldRow('Test†LEGGENDARIA',3)]),'SP',now);assert.equal(single.entries[0].songRecord.playCount,3);
 assert.throws(()=>parsePlayImport(oldCsv([oldRow('Test',2),oldRow('Test',4),oldRow('Test†',3)]),'SP',now));
});

test('IIDX24 official EXスコア column labels are accepted as aliases for スコア',()=>{
 const text=oldCsv([oldRow('Test'),oldRow('Test†')]).replaceAll(' スコア',' EXスコア');
 const data=parsePlayImport(text,'SP',now);assert.deepEqual(data.entries.map(e=>[e.difficulty,e.score.exScore]),[['ANOTHER',190],['LEGGENDARIA',190]]);
});

test('Named historical CSV files infer SP/DP and companion title spacing does not duplicate counts',()=>{
 assert.equal(officialCsvMode('9901-2661_sp_score[IIDX24スコアデータ].csv'),'SP');assert.equal(officialCsvMode('01-9901-2661_sp_score-IIDX24-.csv'),'SP');
 const data=parsePlayImport(oldCsv([oldRow('Test feat. Artist',2),oldRow('Test feat.Artist†',3)]),'SP',now);
 assert.ok(data.entries.every(e=>e.songRecord.playCount===5));
 const ss=[{id:'old',title:'Test feat. Artist',artist:'Artist',series:21,removed:false}],cc=['ANOTHER','LEGGENDARIA'].map(d=>({id:`old:SP:${d}`,songId:'old',mode:'SP',difficulty:d,level:12}));
 const saved=applyPlayImport(initialState(),matchPlayImport(data,ss,cc),now);assert.equal(saved.playData.songRecords['old:SP']['26'].playCount,5);
});
