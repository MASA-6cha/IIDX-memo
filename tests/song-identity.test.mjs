import assert from 'node:assert/strict';
import test from 'node:test';
import {loadSource} from './load-source.mjs';
const {reconcileSongIdentities,songNames}=await loadSource('../lib/song-identity.ts');
const {mergeCatalogImport,parseCatalogImport}=await loadSource('../lib/catalog-import.ts');
const {mergeCatalog,migrateLegacyState}=await loadSource('../lib/iidx-catalog.ts');
const {blankNote,initialState}=await loadSource('../lib/iidx-data.ts');
const {makeBackup,parseBackup}=await loadSource('../lib/iidx-backup.ts');
const {initialLibraryView}=await loadSource('../lib/iidx-view.ts');
const at='2026-09-27T00:00:00Z',origin={label:'analysis.json'};
const song=(id,title='ＡＢＣ ～test～',artist='Artist')=>({id,title,artist,series:33,bpm:'180',soflan:false,removed:false});
const chart=(id,extra={})=>({id:`${id}:SP:ANOTHER`,songId:id,mode:'SP',difficulty:'ANOTHER',level:12,unofficialRatings:{},...extra});
const base=(songs=[song('idt-999001')],charts=songs.map(s=>chart(s.id,{community:{sp12:{normal:{value:2,label:'B'},hard:null}}})))=>({schemaVersion:1,source:'iidx-data-table',fetchedAt:at,sourceUpdatedAt:null,seriesNames:{33:'test'},songs,charts});
const input=(music_id=900000001,title='ABC ~test~',artist='Artist')=>parseCatalogImport(JSON.stringify({schema:'iidx-info-exporter/songs/1',songs:[{music_id,title,artist,charts:{SPA:{level:11,note_count:1234,radar:{NOTES:0}}}}]}));
const mapping=(music_id=900000001,publicId='999001')=>parseCatalogImport(JSON.stringify({schema:'iidx-song-identities/1',links:[{music_id,song_key:`iidx-data-table:${publicId}`}]}));

test('Analysis display wins, public and old analysis names remain aliases across public refreshes',()=>{
 let catalog=mergeCatalogImport(base(),input(),origin,at).catalog;
 assert.equal(catalog.songs.length,1);assert.equal(catalog.songs[0].title,'ABC ~test~');assert.equal(catalog.songs[0].publicId,'idt-999001');
 assert(songNames(catalog.songs[0]).some(s=>s.title==='ＡＢＣ ～test～'));
 catalog=mergeCatalogImport(catalog,input(900000001,'New analysis title','New artist'),origin,'2026-09-28T00:00:00Z').catalog;
 const incoming=base([song('idt-999001','Changed provider title','Provider artist')]);incoming.charts[0].community.sp12.normal.label='A';
 catalog=mergeCatalog(catalog,incoming,initialState()).catalog;
 assert.equal(catalog.songs[0].title,'New analysis title');assert(songNames(catalog.songs[0]).some(s=>s.title==='ABC ~test~'));assert(songNames(catalog.songs[0]).some(s=>s.title==='Changed provider title'));
 assert.equal(catalog.charts[0].community.sp12.normal.label,'A');assert.equal(catalog.charts[0].level,11);assert.equal(catalog.charts[0].radar.values[0],0);
});

test('Imported-first ID stays stable when provider title changes after first linkage',()=>{
 let catalog=mergeCatalogImport(null,input(),origin,at).catalog;
 catalog=mergeCatalog(catalog,base(),initialState()).catalog;
 assert.equal(catalog.songs[0].id,'arcade-900000001');assert.equal(catalog.songs[0].publicId,'idt-999001');
 catalog=mergeCatalog(catalog,base([song('idt-999001','Completely renamed','Changed')]),initialState()).catalog;
 assert.equal(catalog.songs.length,1);assert.equal(catalog.songs[0].id,'arcade-900000001');assert.equal(catalog.songs[0].title,'ABC ~test~');assert.equal(catalog.charts[0].community.sp12.normal.label,'B');
});

test('Explicit mapping joins unrelated spellings; repeated mappings and JSON round trips are idempotent',()=>{
 const imported=mergeCatalogImport(base(),input(900000001,'different name','another artist'),origin,at).catalog;
 assert.equal(imported.songs.length,2);
 const result=mergeCatalogImport(imported,mapping(),{label:'map.json'},at).catalog;
 assert.equal(result.songs.length,1);assert.equal(result.songs[0].title,'different name');assert.equal(result.charts[0].community.sp12.normal.label,'B');
 const again=mergeCatalogImport(JSON.parse(JSON.stringify(result)),mapping(),{label:'map.json'},at).catalog;
 assert.deepEqual(again,result);
});

test('Duplicate identity redirects preserve notes, folders, manual fields and score histories with conflicts intact',()=>{
 const old=mergeCatalogImport(null,input(),origin,at).catalog;
 const duplicate={...old,songs:[...base().songs,...old.songs],charts:[...base().charts,...old.charts]};
 const catalog=reconcileSongIdentities(duplicate),id=catalog.songs[0].id,other=id==='idt-999001'?'arcade-900000001':'idt-999001';
 const state=initialState();const target=`${id}:SP:ANOTHER`,legacy=`${other}:SP:ANOTHER`;
 const n=blankNote();n.left.comment='original';state.notes[legacy+':1P']=n;state.notes[target+':2P']=blankNote();state.notes[legacy+':2P']={...blankNote(),flip:true};
 state.folders[0].songIds=[id,other];state.manualCharts={[legacy]:{noteCount:1234,updatedAt:at}};
 const score=(gameVersion,exScore)=>({gameVersion,exScore,pgreat:null,great:null,missCount:null,lamp:'CLEAR',djLevel:null,fetchedAt:at,importedAt:at});state.playData={imports:{},records:{[legacy]:score(33,2000)},history:{[legacy]:{'33':score(33,2000)},[target]:{'32':score(32,1900)}}};
 const before=JSON.stringify(state),m=migrateLegacyState(state,catalog);
 assert.equal(JSON.stringify(state),before);assert.equal(m.state.notes[target+':1P'].left.comment,'original');assert(m.state.notes[legacy+':2P']);assert.equal(m.conflicts,1);
 assert.deepEqual(m.state.folders[0].songIds,[id]);assert(m.state.manualCharts[target]);assert(m.state.playData.history[target]['32']);assert(m.state.playData.history[target]['33']);assert(!m.state.playData.history[legacy]);
 assert.deepEqual(parseBackup(makeBackup(m.state,initialLibraryView())).data.songIdentities,m.state.songIdentities);
});

test('Ambiguous provider titles, historical variants and different music IDs are not collapsed',()=>{
 const imported=mergeCatalogImport(null,input(),origin,at).catalog;
 const catalog=reconcileSongIdentities({...imported,songs:[song('idt-999001'),song('idt-999002'),...imported.songs],charts:[...base().charts,...imported.charts]});
 assert.equal(catalog.songs.length,3);assert(catalog.identityIssues.length);
 const variant=mergeCatalogImport(base(),input(900000002,'ABC ~test~ (AC 3rd)'),origin,at).catalog;assert.equal(variant.songs.length,2);
 const first=mergeCatalogImport(base(),input(),origin,at).catalog;
 const conflict=mergeCatalogImport(first,input(900000002),origin,at);assert.equal(conflict.acceptedCharts,0);
});

test('Correspondence files reject duplicate and conflicting IDs before any catalog mutation',()=>{
 const value={schema:'iidx-song-identities/1',links:[{music_id:1,song_key:'iidx-data-table:5'},{music_id:2,song_key:'iidx-data-table:5'}]};assert.throws(()=>parseCatalogImport(JSON.stringify(value)),/1対1/);
 const first=mergeCatalogImport(base(),input(),origin,at).catalog,before=JSON.stringify(first);
 assert.throws(()=>mergeCatalogImport(first,mapping(900000001,'999002'),origin,at),/別の曲/);assert.equal(JSON.stringify(first),before);
});

test('Mapping can be imported before analysis and both refreshed catalogs preserve its ID pairing',()=>{
 const mapped=mergeCatalogImport(base(),mapping(),origin,at).catalog;
 const refreshed=mergeCatalog(mapped,base(),initialState()).catalog;
 const imported=mergeCatalogImport(refreshed,input(900000001,'unrelated title','unrelated artist'),origin,at).catalog;
 assert.equal(imported.songs.length,1);assert.equal(imported.songs[0].id,'idt-999001');assert.equal(imported.songs[0].title,'unrelated title');
});

test('Saved provider spellings still match score imports after analysis renames the display title',async()=>{
 const {matchPlayImport}=await loadSource('../lib/play-data.ts');
 let catalog=mergeCatalogImport(base(),input(),origin,at).catalog;
 catalog=mergeCatalogImport(catalog,input(900000001,'Entirely new title','New artist'),origin,at).catalog;
 const result=matchPlayImport({entries:[{mode:'SP',title:'ＡＢＣ ～test～',difficulty:'ANOTHER',level:11,score:{}}],legacy:false,duplicates:0},catalog.songs,catalog.charts);
 assert.equal(result[0].target.id,'idt-999001:SP:ANOTHER');
});
