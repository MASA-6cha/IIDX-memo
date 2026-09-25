import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {loadSource} from './load-source.mjs';
const {parseCatalogImport,mergeCatalogImport,normalizeCatalogImportUrl,fetchCatalogImportText,CATALOG_IMPORT_MAX_BYTES}=await loadSource('../lib/catalog-import.ts');
const {mergeCatalog,migrateLegacyState,isStoredCatalog}=await loadSource('../lib/iidx-catalog.ts');
const {initialState,blankNote}=await loadSource('../lib/iidx-data.ts');
const {chartAvailability}=await loadSource('../lib/iidx-view.ts');
const {calculateActivity}=await loadSource('../lib/my-activity.ts');
const sample=JSON.parse(readFileSync(new URL('./fixtures/catalog-import.json',import.meta.url),'utf8'));
const input=()=>structuredClone(sample),parse=value=>parseCatalogImport(JSON.stringify(value));
const origin={label:'songs.json'},at='2026-09-24T00:00:00.000Z';
const existing=()=>({schemaVersion:1,source:'iidx-data-table',fetchedAt:at,sourceUpdatedAt:null,seriesNames:{19:'Lincle'},songs:[{id:'idt-1971',title:'quaver♪',artist:'Risk Junk',series:19,removed:false,bpm:'186',soflan:false}],charts:[{id:'idt-1971:SP:ANOTHER',songId:'idt-1971',mode:'SP',difficulty:'ANOTHER',level:11,bpm:'186',noteCount:1700,unofficialRatings:{},radar:{values:[100,100,100,100,100,100],notes:1700},community:{sp12:{normal:{value:1,label:'A'},hard:null}}}],additionalData:{radarCharts:1,sp11Charts:0,sp12Charts:1,dpCharts:0}});

test('Per-chart IIDX 33 availability overrides song status and survives public DB refresh',()=>{
 const value=input(),song=value.songs[0];
 song.charts.SPA.arcade_availability={status:'not_included',reference_version:33};
 song.charts.SPN.arcade_availability={status:'included',reference_version:33};
 song.charts.SPH.arcade_availability={status:'unknown',reference_version:33};
 song.charts.SPA.chart_source='PRIVATE_DISK_PATH';
 const parsed=parse(value),first=mergeCatalogImport(existing(),parsed,origin,at).catalog;
 const status=difficulty=>{const chart=first.charts.find(c=>c.mode==='SP'&&c.difficulty===difficulty);return chartAvailability(chart,first.songs[0]);};
 assert.equal(status('ANOTHER'),'not_included');assert.equal(status('NORMAL'),'included');assert.equal(status('HYPER'),'unknown');
 const refreshed=mergeCatalog(first,existing(),initialState()).catalog;
 assert.equal(chartAvailability(refreshed.charts.find(c=>c.id==='idt-1971:SP:ANOTHER'),refreshed.songs[0]),'not_included');
 assert(!JSON.stringify(refreshed).includes('PRIVATE_DISK_PATH'));
});

test('The supplied format maps all seven charts, SOF-LAN and false features without retaining file paths',()=>{
 const value=input();value.songs[0].charts.SPA.chart_source='PRIVATE_DISK_PATH';
 const data=parse(value),s=data.songs[0],c=s.charts.find(c=>c.mode==='DP'&&c.difficulty==='ANOTHER');
 assert.equal(data.chartCount,7);assert.equal(s.musicId,19071);assert.equal(s.genre,'HAPPY');assert.equal(c.noteCount,1874);
 assert.deepEqual(c.radarValues,[170.15,146.51,17.75,47.39,0,163.16]);assert.equal(c.bpm,'182-186');assert.equal(c.soflan,true);
 assert.deepEqual(c.features,{CN:false,HCN:false,BSS:false,MSS:false});assert.equal(c.statusLabel,'独立計算');assert(!JSON.stringify(data).includes('PRIVATE_DISK_PATH'));
});

test('Imports keep existing identities, series, availability and community data; unrelated data and histories survive',()=>{
 const base=existing(),state=initialState();state.notes['idt-1971:SP:ANOTHER:1P']=blankNote();state.folders[0].songIds=['idt-1971'];
 state.playData={records:{'idt-1971:SP:ANOTHER':{exScore:3000,gameVersion:33}},history:{'idt-1971:SP:ANOTHER':{'33':{exScore:3000,gameVersion:33}}}};
 const before=JSON.stringify({base,state}),result=mergeCatalogImport(base,parse(input()),origin,at);
 assert.equal(result.updatedSongs,1);assert.equal(result.addedSongs,0);assert.equal(result.updatedCharts,1);assert.equal(result.addedCharts,6);
 assert.equal(result.catalog.songs[0].series,19);assert.equal(result.catalog.songs[0].removed,false);
 const chart=result.catalog.charts.find(c=>c.id==='idt-1971:SP:ANOTHER');assert.equal(chart.noteCount,1745);assert.equal(chart.level,12);assert.equal(chart.community.sp12.normal.label,'A');
 assert.equal(chart.radar.values[0],157.37);assert(isStoredCatalog(JSON.parse(JSON.stringify(result.catalog))));
 assert.equal(JSON.stringify({base,state}),before);assert.deepEqual(migrateLegacyState(state,result.catalog).state.playData.history,state.playData.history);
 const stats=calculateActivity(result.catalog.charts,result.catalog.songs,{'idt-1971:SP:ANOTHER':{exScore:3000,gameVersion:33,lamp:'CLEAR',djLevel:'AA'}},'SP','available');
 assert.equal(stats.axes[0].top[0].value,135.27);
});

test('Public refresh preserves imported values including null, yet refreshes community and never drops imported charts',()=>{
 const data=input();data.songs[0].charts.SPA.radar=null;
 const imported=mergeCatalogImport(existing(),parse(data),origin,at).catalog,next=existing();next.charts[0].community.sp12.normal.label='B';next.charts[0].level=10;
 const refreshed=mergeCatalog(imported,next,initialState()).catalog,c=refreshed.charts.find(c=>c.id==='idt-1971:SP:ANOTHER');
 assert.equal(c.level,12);assert.equal(c.noteCount,1745);assert.equal(c.radar,null);assert.equal(c.community.sp12.normal.label,'B');assert.equal(refreshed.charts.length,7);
 assert(refreshed.charts.every(c=>!c.retained));assert.equal(refreshed.importedData.label,'songs.json');
});

test('New songs stay unknown until a unique public match enriches them without changing saved IDs',()=>{
 const fresh=mergeCatalogImport(null,parse(input()),origin,at).catalog;
 assert.equal(fresh.songs[0].id,'arcade-19071');assert.equal(fresh.songs[0].series,-2);assert.equal(fresh.songs[0].availabilityUnknown,true);
 assert.equal(calculateActivity(fresh.charts,fresh.songs,{},'SP','available').total,0);
 const state=initialState();state.notes['arcade-19071:SP:ANOTHER:1P']=blankNote();state.folders[0].songIds=['arcade-19071'];
 const refreshed=mergeCatalog(fresh,existing(),state).catalog;
 assert.equal(refreshed.songs.length,1);assert.equal(refreshed.songs[0].id,'arcade-19071');assert.equal(refreshed.songs[0].series,19);assert.equal(refreshed.songs[0].availabilityUnknown,false);
 assert.equal(refreshed.charts.length,7);assert.equal(refreshed.charts[0].id,'arcade-19071:SP:ANOTHER');assert.equal(refreshed.charts[0].noteCount,1745);
 const again=mergeCatalogImport(refreshed,parse(input()),origin,at);assert.equal(again.addedSongs,0);assert.equal(again.catalog.songs.length,1);
});

test('A first import also preserves notes written against the original sample IDs',()=>{
 const value=input();value.songs[0].music_id=12058;value.songs[0].title='冥';value.songs[0].artist='Amuro vs Killer';
 const state=initialState();state.notes['mei:SP:ANOTHER:2P']=blankNote();state.folders[0].songIds=['mei'];
 const imported=mergeCatalogImport(null,parse(value),origin,at).catalog,merged=mergeCatalog(null,imported,state).catalog;
 assert.equal(merged.songs.length,1);assert.equal(merged.songs[0].id,'idt-1258');
 const migrated=migrateLegacyState(state,merged).state;assert(migrated.notes['idt-1258:SP:ANOTHER:2P']);assert.deepEqual(migrated.folders[0].songIds,['idt-1258']);
});

test('Null radar and missing axes remain unknown; zero is kept and absent fields do not erase earlier imports',()=>{
 const value=input(),a=value.songs[0].charts.SPA;a.radar={NOTES:0,CHARGE:null};a.note_count=null;
 const first=mergeCatalogImport(existing(),parse(value),origin,at).catalog,c=first.charts.find(c=>c.difficulty==='ANOTHER'&&c.mode==='SP');
 assert.deepEqual(c.radar.values,[0,null,null,null,null,null]);assert.equal(c.noteCount,null);
 const partial=input();partial.songs[0].charts={SPA:{level:12}};
 const second=mergeCatalogImport(first,parse(partial),origin,at).catalog,next=second.charts.find(item=>item.id===c.id);
 assert.equal(second.charts.length,7);assert.deepEqual(next.radar.values,c.radar.values);assert.equal(next.noteCount,null);assert.deepEqual(next.importedInfo.features,c.importedInfo.features);
});

test('Ambiguous titles, artist mismatches, and conflicting music IDs are held for review instead of overwriting',()=>{
 const base=existing();base.songs.push({...base.songs[0],id:'duplicate'});
 let result=mergeCatalogImport(base,parse(input()),origin,at);assert.equal(result.acceptedCharts,0);assert.equal(result.issues.length,1);
 const changed=input();changed.songs[0].artist='A different artist';result=mergeCatalogImport(existing(),parse(changed),origin,at);assert.equal(result.acceptedCharts,0);
 const first=mergeCatalogImport(existing(),parse(input()),origin,at).catalog;const conflict=input();conflict.songs[0].music_id=19072;
 result=mergeCatalogImport(first,parse(conflict),origin,at);assert.equal(result.acceptedCharts,0);assert.equal(result.catalog.charts.length,7);
});

test('Malformed schema, duplicate IDs, wrong types, invalid values and empty files fail before saving',()=>{
 for(const mutate of [x=>x.schema='other',x=>x.songs.push(x.songs[0]),x=>x.songs[0].charts.SPA.note_count=-1,x=>x.songs[0].charts.SPA.radar.NOTES=201,x=>x.songs[0].charts.SPA.CN='false',x=>x.songs[0].charts.SPA.chart_type='DPA',x=>x.songs[0].charts={UNKNOWN:{}},x=>x.songs=[]]){const x=input();mutate(x);assert.throws(()=>parse(x));}
 assert.throws(()=>parseCatalogImport('not json'));assert.throws(()=>parseCatalogImport(' '.repeat(CATALOG_IMPORT_MAX_BYTES+1)));
 const x=input();x.songs[0].charts.SPL=null;x.songs[0].charts.DPB={level:0};assert.equal(parse(x).skippedEmptyCharts,2);
});

test('GitHub URLs normalize without credentials; bounded streaming requests omit cookies and report progress',async()=>{
 assert.equal(normalizeCatalogImportUrl('https://github.com/owner/repo/blob/main/songs.json?raw=true'),'https://raw.githubusercontent.com/owner/repo/main/songs.json');
 assert.equal(normalizeCatalogImportUrl('https://owner.github.io/data/songs.json'),'https://owner.github.io/data/songs.json');
 for(const url of ['http://github.com/o/r/blob/main/a.json','https://token@raw.githubusercontent.com/o/r/main/a.json','https://raw.githubusercontent.com.evil.test/a.json','https://github.com/o/r'])assert.throws(()=>normalizeCatalogImportUrl(url));
 let options,bytes=0;const response=await fetchCatalogImportText('https://raw.githubusercontent.com/o/r/main/songs.json',new AbortController().signal,n=>bytes=n,async(_url,args)=>{options=args;return new Response(JSON.stringify(sample));});
 assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');assert(bytes>0);assert.equal(parseCatalogImport(response.text).chartCount,7);
 await assert.rejects(fetchCatalogImportText(response.url,new AbortController().signal,()=>{},async()=>new Response('',{headers:{'Content-Length':String(CATALOG_IMPORT_MAX_BYTES+1)}})),/32MB/);
 await assert.rejects(fetchCatalogImportText(response.url,new AbortController().signal,()=>{},async()=>new Response('',{status:404})),/404/);
});

test('Published JSON supports unknown levels and unavailable BPM without dropping named charts',async()=>{
 const value=input();value.songs[0].charts.SPA.level=null;
 value.songs[0].charts.SPB.bpm={min:null,max:null};value.songs[0].charts.SPB.bpm_display={min:null,max:null,text:null};
 const data=parse(value),newCatalog=mergeCatalogImport(null,data,origin,at).catalog;
 assert.equal(data.chartCount,7);assert.equal(newCatalog.charts.find(c=>c.mode==='SP'&&c.difficulty==='ANOTHER').level,0);
 const updated=mergeCatalogImport(existing(),data,origin,at).catalog;
 assert.equal(updated.charts.find(c=>c.id==='idt-1971:SP:ANOTHER').level,11);
 assert.equal(mergeCatalog(updated,existing(),initialState()).catalog.charts.find(c=>c.id==='idt-1971:SP:ANOTHER').level,11);

 const {buildDifficultyFolders}=await loadSource('../lib/difficulty-folders.ts');
 const folders=buildDifficultyFolders(newCatalog.charts,newCatalog.charts,{table:'official',mode:'SP',gauge:'normal',cpiGauge:'hard'});
 assert.equal(folders.find(f=>f.key==='0').chartCount,1);assert.equal(folders.find(f=>f.key==='0').label,'難度不明');
});


test('Missing, null, empty and whitespace titles are skipped before chart validation',()=>{
 const value=input();
 for(const title of [null,undefined,'','  '])value.songs.push({music_id:99999,title,charts:{SPN:{level:'invalid'}}});
 const data=parse(value);assert.equal(data.songs.length,1);assert.equal(data.chartCount,7);assert.equal(data.skippedUnnamedSongs,4);
 const result=mergeCatalogImport(existing(),data,origin,at);assert.equal(result.addedSongs,0);assert.equal(result.acceptedCharts,7);
 assert.throws(()=>parse({...value,songs:value.songs.slice(1)}),/取り込める譜面がありません/);
 delete value.songs[0].charts.SPN.level;assert.equal(parse(value).songs[0].charts.find(c=>c.mode==='SP'&&c.difficulty==='NORMAL').level,null);
});
