import assert from 'node:assert/strict';
import test from 'node:test';
import {loadSource} from './load-source.mjs';
const {parseCatalogImport,mergeCatalogImport,reconcileStoredCatalog,stripSupplement}=await loadSource('../lib/catalog-import.ts');
const {mergeCatalog,migrateLegacyState}=await loadSource('../lib/iidx-catalog.ts');
const {initialState,blankNote}=await loadSource('../lib/iidx-data.ts');
const {chartAvailability}=await loadSource('../lib/iidx-view.ts');
const at='2026-10-06T00:00:00Z',origin={label:'bemaniwiki-iidx34.json'};
const row=()=>({title:'Song',artist:'Artist',genre:'GENRE',bpm:'138-200',series:34,song_id:null,availability:'listed',charts:{SP:{A:{exists:true,level:11,notes:1400,flags:['CN','BSS','MSS','HCN?']},L:{exists:false,level:null,notes:null,flags:[]}},DP:{N:{exists:null,level:null,notes:null,flags:[]}}}});
const crawl=()=>({schema_version:1,source:{name:'BEMANIWiki 2nd'},updated_at:at,songs:[row()]});
const parse=value=>parseCatalogImport(JSON.stringify(value));
const imported=()=>({schema:'iidx-info-exporter/songs/1',songs:[{music_id:34999,title:'Ｓｏｎｇ',artist:'Artist',charts:{SPA:{level:12,note_count:1600,radar:{NOTES:135,PEAK:0},CN:false}}}]});
const manual=()=>({schema:'iidx-song-supplement/1',songs:[{music_id:null,song_key:'iidx-data-table:3401',version:34,title:'Song',artist:'Artist',charts:{SPA:{level:10,note_count:1700,radar:{NOTES:90,PEAK:20}}}}]});
const publicDb=()=>({schemaVersion:1,source:'iidx-data-table',fetchedAt:at,sourceUpdatedAt:null,seriesNames:{34:'ZINRAI'},songs:[{id:'idt-3401',series:34,title:'Song',artist:'Artist',removed:false,bpm:'180',soflan:false}],charts:[{id:'idt-3401:SP:ANOTHER',songId:'idt-3401',mode:'SP',difficulty:'ANOTHER',level:12,noteCount:null,radar:{values:[0,120,null,null,null,null],notes:0},unofficialRatings:{},community:{sp12:{normal:{value:1,label:'A'},hard:null}}}]});

test('Crawl parser accepts confirmed charts, keeps uncertain flags unknown, and does not synthesize radar',()=>{
 const raw=crawl();raw.songs.push({...row(),title:'Upcoming',availability:'planned'});const data=parse(raw);
 assert.equal(data.kind,'wiki');assert.equal(data.songs.length,1);assert.equal(data.chartCount,1);assert.equal(data.skippedPlannedSongs,1);assert.equal(data.skippedEmptyCharts,2);
 const chart=data.songs[0].charts[0];assert.equal(chart.noteCount,1400);assert.equal(chart.bpm,'138-200');assert.equal(chart.soflan,true);
 assert.deepEqual(chart.features,{CN:true,BSS:true,MSS:true});assert.equal(chart.radarValues,undefined);assert.equal(data.warningCount,1);
 assert.equal(data.songs[0].musicId,null);assert.match(data.songs[0].supplementId,/^wiki-34-[a-f0-9]{16}$/);
});
test('Invalid schema, series, chart keys and duplicate normalized titles fail before saving',()=>{
 for(const change of [r=>r.schema_version=2,r=>r.songs[0].series=33,r=>r.songs[0].charts.SP.A.notes=-1,r=>r.songs[0].charts.SP.X={exists:true,level:12},r=>r.songs.push({...row(),title:'Ｓｏｎｇ'})]){
  const raw=crawl();change(raw);assert.throws(()=>parse(raw));
 }
 const onlyPlanned=crawl();onlyPlanned.songs[0].availability='planned';assert.throws(()=>parse(onlyPlanned),/取り込める/);
});
test('Missing notes and BPM do not clear existing fields, and known radar zero remains zero',()=>{
 const source=publicDb(),before=JSON.stringify(source),raw=crawl();raw.songs[0].bpm=null;raw.songs[0].charts.SP.A.notes=null;
 const result=mergeCatalogImport(source,parse(raw),origin,at).catalog,chart=result.charts[0];
 assert.equal(chart.bpm,undefined);assert.equal(result.songs[0].bpm,'180');assert.equal(chart.noteCount,null);
 assert.deepEqual(chart.radar.values,[0,120,null,null,null,null]);assert.equal(chart.community.sp12.normal.label,'A');
 assert.equal(chartAvailability(chart,result.songs[0]),'included');assert.equal(JSON.stringify(source),before);
 assert.deepEqual(stripSupplement(result).charts,source.charts);
});
test('Separate imported radar and authoritative fields survive either import order and later crawl updates',()=>{
 for(const wikiFirst of [true,false]){
  let catalog=mergeCatalogImport(null,parse(wikiFirst?crawl():imported()),origin,at).catalog;
  catalog=mergeCatalogImport(catalog,parse(wikiFirst?imported():crawl()),origin,at).catalog;
  const id=catalog.charts[0].id;
  const changed=crawl();changed.songs[0].charts.SP.A.notes=1800;
  catalog=mergeCatalogImport(catalog,parse(changed),origin,at).catalog;
  assert.equal(catalog.songs.length,1);assert.equal(catalog.charts.length,1);assert.equal(catalog.charts[0].id,id);
  assert.equal(catalog.songs[0].title,'Ｓｏｎｇ');assert.equal(catalog.charts[0].level,12);assert.equal(catalog.charts[0].noteCount,1600);
  assert.deepEqual(catalog.charts[0].radar.values,[135,0,null,null,null,null]);assert.equal(catalog.charts[0].importedInfo.features.CN,false);
 }
});
test('Manual supplement and crawl remain independent, order-independent, and preserve separate radar',()=>{
 for(const wikiFirst of [true,false]){
  let catalog=mergeCatalogImport(null,parse(wikiFirst?crawl():manual()),origin,at).catalog;
  const firstId=catalog.charts[0].id;
  catalog=mergeCatalogImport(catalog,parse(wikiFirst?manual():crawl()),origin,at).catalog;
  const id=catalog.charts[0].id;
  assert.equal(id,firstId);
  const changed=crawl();changed.songs[0].charts.SP.A.notes=1500;
  catalog=mergeCatalogImport(JSON.parse(JSON.stringify(catalog)),parse(changed),origin,at).catalog;
  assert.equal(catalog.songs.length,1);assert.equal(catalog.charts[0].id,id);assert.equal(catalog.charts[0].noteCount,1500);
  assert.deepEqual(catalog.charts[0].radar.values,[90,20,null,null,null,null]);assert(catalog.wikiData);assert(catalog.supplementData);
  const roundtrip=reconcileStoredCatalog(JSON.parse(JSON.stringify(catalog)));
  assert.equal(roundtrip.charts[0].supplementBase,null);assert.equal(roundtrip.songs[0].supplementBase,null);assert.equal(stripSupplement(roundtrip).charts.length,0);
  assert.deepEqual(roundtrip.charts[0].radar,catalog.charts[0].radar);
 }
});
test('A later public catalog links the crawl identity and migrates notes, favorites and scores',()=>{
 const initial=mergeCatalogImport(null,parse(crawl()),origin,at).catalog;
 const oldSong=initial.songs[0].id,oldChart=initial.charts[0].id,state=initialState();
 state.notes[`${oldChart}:1P`]=blankNote();state.notes[`${oldChart}:1P`].left.comment='keep';state.folders[0].songIds=[oldSong];
 state.playData={records:{[oldChart]:{exScore:2500,gameVersion:34}},history:{[oldChart]:{'34':{exScore:2500,gameVersion:34}}}};
 const catalog=mergeCatalog(initial,publicDb(),state).catalog,next=migrateLegacyState(state,catalog).state;
 assert.equal(catalog.songs.length,1);assert.equal(catalog.songIdentities.redirects[oldSong],'idt-3401');
 assert.equal(next.notes['idt-3401:SP:ANOTHER:1P'].left.comment,'keep');assert.deepEqual(next.folders[0].songIds,['idt-3401']);
 assert.equal(next.playData.records['idt-3401:SP:ANOTHER'].exScore,2500);assert.equal(next.playData.history['idt-3401:SP:ANOTHER']['34'].exScore,2500);
 assert.deepEqual(catalog.charts[0].radar.values,[0,120,null,null,null,null]);assert(catalog.wikiData);
});
test('Ambiguous names and another series with the same title cannot be merged silently',()=>{
 const source=publicDb();source.songs.push({...source.songs[0],id:'idt-3402'});
 assert.equal(mergeCatalogImport(source,parse(crawl()),origin,at).acceptedCharts,0);
 const other=publicDb();other.songs[0].series=33;assert.equal(mergeCatalogImport(other,parse(crawl()),origin,at).acceptedCharts,0);
 const artist=publicDb();artist.songs[0].artist='Other artist';assert.equal(mergeCatalogImport(artist,parse(crawl()),origin,at).issues.length,1);
});

test('Artist conflicts with a saved supplemental radar are held without hiding its song or radar on reopen',()=>{
 const raw=manual();raw.songs[0].artist='Artist feat. vocalist';
 const prior=mergeCatalogImport(null,parse(raw),origin,at).catalog;
 const result=mergeCatalogImport(prior,parse(crawl()),origin,at);
 assert.equal(result.acceptedCharts,0);assert.equal(result.issues.length,1);
 for(const catalog of [result.catalog,reconcileStoredCatalog(JSON.parse(JSON.stringify(result.catalog)))]){
  assert.equal(catalog.songs.length,1);assert.equal(catalog.songs[0].artist,'Artist feat. vocalist');assert.deepEqual(catalog.charts[0].radar.values,[90,20,null,null,null,null]);
 }
});

test('Provider aliases in a saved manual song remain available when the crawl becomes its base',()=>{
 const raw=manual();raw.songs[0].title='NOMAD (feat.らっぷぴと)';raw.songs[0].song_key='iidx-data-table:3411';
 const wiki=crawl();wiki.songs[0].title='NOMAD (feat. らっぷびと)';
 const prior=mergeCatalogImport(null,parse(raw),origin,at).catalog;
 const result=mergeCatalogImport(prior,parse(wiki),origin,at),again=reconcileStoredCatalog(JSON.parse(JSON.stringify(result.catalog)));
 assert.equal(result.issues.length,0);assert.equal(again.songs.length,1);assert.equal(again.songs[0].id,'idt-3411');
 assert.deepEqual(again.charts[0].radar.values,[90,20,null,null,null,null]);
});
