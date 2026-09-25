import assert from 'node:assert/strict';
import test from 'node:test';
import {loadSource} from './load-source.mjs';
const {parseCatalogImport,mergeCatalogImport}=await loadSource('../lib/catalog-import.ts');
const {mergeCatalog}=await loadSource('../lib/iidx-catalog.ts');
const {initialState}=await loadSource('../lib/iidx-data.ts');
const {applyManualChart}=await loadSource('../lib/manual-chart.ts');
const at='2026-09-24T00:00:00Z',origin={label:'iidx34-songs.json'};
const fixture=()=>({schema:'iidx-song-supplement/1',songs:[{music_id:null,song_key:'iidx-data-table:3401',version:34,title:'Song',artist:'Artist',charts:{SPA:{level:12,bpm:{min:null,max:null},bpm_display:{min:180,max:180},note_count:1500,radar:{NOTES:120,PEAK:90,SCRATCH:20,'SOF-LAN':0,CHARGE:0,CHORD:null},CN:true,HCN:false}}}]});
const parse=x=>parseCatalogImport(JSON.stringify(x));
const base=()=>({schemaVersion:1,source:'iidx-data-table',fetchedAt:at,sourceUpdatedAt:null,seriesNames:{34:'34'},songs:[{id:'idt-3401',title:'Song',artist:'Artist',series:34,bpm:'180',soflan:false,removed:false}],charts:[{id:'idt-3401:SP:ANOTHER',songId:'idt-3401',mode:'SP',difficulty:'ANOTHER',level:12,unofficialRatings:{},noteCount:null,radar:{values:[0,null,null,null,null,null],notes:0},importedInfo:{level:12,features:{CN:false},importedAt:at}}]});
test('Supplement fills each missing field, preserves zero/false, skips unnamed songs, and local input is last',()=>{
 const raw=fixture();raw.songs.push({title:null,charts:{broken:true}});const data=parse(raw);
 assert.equal(data.skippedUnnamedSongs,1);assert.equal(data.kind,'supplement');
 const source=base(),before=JSON.stringify(source),result=mergeCatalogImport(source,data,origin,at).catalog;
 const chart=result.charts[0];assert.equal(chart.noteCount,1500);assert.deepEqual(chart.radar.values,[0,90,20,0,0,null]);assert.equal(chart.importedInfo.features.CN,false);assert.equal(chart.importedInfo.features.HCN,false);
 const effective=applyManualChart(chart,{[chart.id]:{noteCount:999,bpm:'200',radarValues:[199,199,199,199,199,50],updatedAt:at}});
 assert.equal(effective.noteCount,1500);assert.equal(effective.bpm,'180');assert.deepEqual(effective.radar.values,[0,90,20,0,0,50]);assert.equal(JSON.stringify(source),before);
});
test('Public refresh and analyzed import replace fallback values without losing stable chart IDs',()=>{
 const first=mergeCatalogImport(null,parse(fixture()),origin,at).catalog;
 assert.equal(first.songs[0].id,'idt-3401');assert.equal(first.songs[0].series,34);assert.equal(first.songs[0].removed,false);
 const source=base();source.charts[0].noteCount=1600;source.charts[0].radar.values=[130,null,null,null,null,null];
 const refreshed=mergeCatalog(first,source,initialState()).catalog;assert.equal(refreshed.charts[0].noteCount,1600);assert.deepEqual(refreshed.charts[0].radar.values,[130,90,20,0,0,null]);
 const raw=fixture();raw.schema='iidx-info-exporter/songs/1';raw.songs[0].music_id=34001;raw.songs[0].charts.SPA.note_count=1700;raw.songs[0].charts.SPA.radar.NOTES=140;
 const analyzed=mergeCatalogImport(first,parse(raw),{label:'songs.json'},at).catalog;
 assert.equal(analyzed.songs.length,1);assert.equal(analyzed.charts[0].id,'idt-3401:SP:ANOTHER');assert.equal(analyzed.charts[0].noteCount,1700);assert.equal(analyzed.charts[0].radar.values[0],140);
 const again=mergeCatalogImport(analyzed,parse(fixture()),origin,at).catalog;assert.equal(again.charts[0].noteCount,1700);
});
test('Repeated supplements update fallback data and round-trip through JSON without nesting snapshots',()=>{
 const first=mergeCatalogImport(base(),parse(fixture()),origin,at).catalog;
 const raw=fixture();raw.songs[0].charts.SPA.note_count=1800;raw.songs[0].charts.SPA.radar.PEAK=null;
 const second=mergeCatalogImport(JSON.parse(JSON.stringify(first)),parse(raw),origin,at).catalog;
 assert.equal(second.charts[0].noteCount,1800);assert.equal(second.charts[0].radar.values[1],null);assert.equal(second.charts[0].supplementBase.supplementBase,undefined);
 assert.equal(second.charts[0].radar.values[0],0);
});
test('Ambiguous matches and mismatched source IDs are held, and excluded charts are not created',()=>{
 const source=base();source.songs[0].title='Different';const result=mergeCatalogImport(source,parse(fixture()),origin,at);assert.equal(result.issues.length,1);assert.equal(result.acceptedCharts,0);
 const raw=fixture();raw.songs[0].charts.SPH={level:10};raw.songs[0].excluded_charts=['SPA'];const parsed=parse(raw);assert.equal(parsed.chartCount,1);assert.equal(parsed.songs[0].charts[0].difficulty,'HYPER');
});
