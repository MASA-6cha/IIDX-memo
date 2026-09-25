import assert from 'node:assert/strict';import test from 'node:test';import {loadSource} from './load-source.mjs';
const {parseManualChart,applyManualChart}=await loadSource('../lib/manual-chart.ts');
const {makeBackup,parseBackup}=await loadSource('../lib/iidx-backup.ts');
const {initialState}=await loadSource('../lib/iidx-data.ts');
const {migrateLegacyState,mergeCatalog}=await loadSource('../lib/iidx-catalog.ts');
const {calculateActivity}=await loadSource('../lib/my-activity.ts');
const chart={id:'mei:SP:ANOTHER',songId:'mei',mode:'SP',difficulty:'ANOTHER',level:12,noteCount:1000,bpm:'66-200',radar:{values:[100,100,100,100,100,100],notes:1000},unofficialRatings:{}};
test('Manual values fill missing fields only, preserve database zero, and affect radar calculations',()=>{
 const input=parseManualChart('70','200','2000',['150','0','','','','']);const before=JSON.stringify(chart);
 const partial={...chart,noteCount:null,bpm:'—',radar:{values:[null,null,0,100,100,100],notes:0}};
 const result=applyManualChart(partial,{'idt-1258:SP:ANOTHER':input});
 const full=applyManualChart(chart,{'idt-1258:SP:ANOTHER':input});assert.equal(full.noteCount,1000);assert.equal(full.bpm,'66-200');assert.deepEqual(full.radar.values,chart.radar.values);assert.deepEqual(full.manualApplied,[]);
 assert.equal(applyManualChart(partial,{'idt-1258:SP:ANOTHER':input},'180').bpm,'180');
 assert.equal(result.noteCount,2000);assert.equal(result.bpm,'70-200');assert.deepEqual(result.radar.values,[150,0,0,100,100,100]);assert.equal(result.radar.notes,2000);assert.equal(JSON.stringify(chart),before);
 const summary=calculateActivity([result],[{id:'mei',removed:false}],{[chart.id]:{exScore:3200,djLevel:'AA',lamp:'CLEAR',gameVersion:33}},'SP','all');assert.equal(summary.axes[0].value,12);
 assert.equal(applyManualChart(chart,{}),chart);
});
test('Invalid manual values reject; empty fields inherit and fixed BPM accepts one value',()=>{
 assert.equal(parseManualChart('150','','',['','','','','','']).bpm,'150');
 assert.equal(parseManualChart('','','',['','','','','','']).radarValues,undefined);
 for(const args of [['200','100','',[]],['','100','',[]],['150.5','','',[]],['','','0',[]],['','','1.2',[]],['','','',['201','','','','','']],['','','',['-1','','','','','']]])assert.throws(()=>parseManualChart(...args));
});
test('Manual corrections round-trip in backups and survive catalog refresh and legacy ID migration',()=>{
 const state=initialState();state.manualCharts={[chart.id]:parseManualChart('100','','2000',['150','','','','',''])};
 assert.deepEqual(parseBackup(makeBackup(state)).data.manualCharts,state.manualCharts);
 const incoming={schemaVersion:1,source:'iidx-data-table',fetchedAt:new Date().toISOString(),sourceUpdatedAt:null,seriesNames:{12:'HAPPY SKY'},songs:[{id:'idt-1258',title:'冥',artist:'Amuro vs Killer',series:12,removed:false,bpm:'66-200',soflan:true}],charts:[{...chart,id:'idt-1258:SP:ANOTHER',songId:'idt-1258',noteCount:999}]};
 const migrated=migrateLegacyState(state,incoming).state;assert(migrated.manualCharts['idt-1258:SP:ANOTHER']);
 const refreshed=mergeCatalog(null,incoming,migrated).catalog;assert.equal(applyManualChart(refreshed.charts[0],migrated.manualCharts).noteCount,999);
});
