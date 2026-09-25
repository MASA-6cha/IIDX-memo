import assert from 'node:assert/strict';
import test from 'node:test';
import {loadSource} from './load-source.mjs';
const {enrichCatalog,chartRating,chartRank,ratingSortValue,inDifficultyTable,matchesRadar,emptyRadarRanges,radarRangeError,radarPoint,compareNullable}=await loadSource('../lib/iidx-additional.ts');
const {parseLibraryView,serializeLibraryView,initialLibraryView,clearLibraryFilters}=await loadSource('../lib/iidx-view.ts');

function fixture(){
 const radar={NOTES:[0,50,100,150.47,0],PEAK:[0,20,40,180.36,0],SCRATCH:[0,10,15,26.86,0],SOFLAN:[0,0,0,183.46,0],CHARGE:[0,0,0,0,0],CHORD:[0,5,10,140.97,0],notes:[0,500,1000,2000,0]};
 const spread=v=>Object.fromEntries(Array.from({length:100},(_,i)=>[String(1258+i),structuredClone(v)]));
 const sp=spread(radar),dp=spread({...radar,NOTES:[0,45,95,149.49,0]});
 delete sp['1259'].CHARGE;
 const table=spread({A:{n_value:7,h_value:10}}),labels={normal:{7:'地力A'},hard:{10:'地力S+'}},dpt=spread({A:{value:12.5}});
 const chart=(songId,mode,difficulty,level)=>({id:`idt-${songId}:${mode}:${difficulty}`,songId:`idt-${songId}`,mode,difficulty,level,unofficialRatings:{}});
 const catalog={schemaVersion:1,source:'iidx-data-table',fetchedAt:'2026-09-20T00:00:00Z',sourceUpdatedAt:null,seriesNames:{},songs:[],charts:[chart('1258','SP','ANOTHER',12),chart('1258','DP','ANOTHER',12),chart('1258','SP','LEGGENDARIA',12),chart('1259','SP','ANOTHER',12)]};
 const pair=n=>({cpi_value:n,kojinsa_value:100});
 const cpi=spread({cpi_id:'342',A:{easy:pair(1580.95),clear:pair(1658.51),hard:pair(1986.05),exh:pair(2414.58),fc:pair(-1)}});
 cpi['1259'].A.hard=pair(-2);
 return {catalog,payload:[sp,dp,table,labels,table,labels,dpt,cpi]};
}
test('Stable chart keys distinguish SP/DP, gauge ranks, real zeroes and partially missing radar',()=>{
 const f=fixture(),e=enrichCatalog(f.catalog,f.payload),[sp,dp,missing,partial]=e.charts;
 assert.equal(chartRating(sp,'sp12','hard').label,'地力S+');assert.equal(chartRating(sp,'sp12','normal').label,'地力A');assert.equal(chartRating(dp,'dp','hard').value,12.5);
 assert.equal(sp.radar.values[0],150.47);assert.equal(dp.radar.values[0],149.49);assert.equal(sp.radar.values[4],0);assert.equal(missing.radar,null);assert.equal(partial.radar.values[4],null);assert.equal(partial.radar.values[0],150.47);
 assert.equal(f.catalog.charts[0].radar,undefined);
 const ranges=emptyRadarRanges();ranges[4]={min:'0',max:'0'};assert(matchesRadar(sp,ranges));assert(!matchesRadar(partial,ranges));assert(!matchesRadar(missing,ranges));ranges[0]={min:'151',max:''};assert(!matchesRadar(sp,ranges));ranges[0]={min:'201',max:''};assert(radarRangeError(ranges));
 f.payload[0]['1258'].NOTES[3]=201;assert.throws(()=>enrichCatalog(f.catalog,f.payload));
});
test('Legacy filters survive preference migration, new controls persist, reset preserves display choices',()=>{
 const legacy={version:1,view:{query:'冥',filters:{series:'12',artist:'Amuro',level:'12',availability:'all',soflan:true},difficulty:'ANOTHER',folder:'fav2',savedOnly:true,sort:'series'}};
 const v=parseLibraryView(JSON.stringify(legacy));assert.equal(v.query,'冥');assert.equal(v.filters.artist,'Amuro');assert.equal(v.sortDirection,'desc');assert.equal(v.table,'official');assert.equal(v.showRadar,true);
 const next={...v,table:'sp12',gauge:'normal',sort:'SOFLAN',showRadar:false,radarMode:true,rank:'7',radarRanges:[{min:'100',max:'200'},...emptyRadarRanges().slice(1)]};assert.deepEqual(parseLibraryView(serializeLibraryView(next)),next);
 const reset=clearLibraryFilters(next);assert.equal(reset.table,'sp12');assert.equal(reset.gauge,'normal');assert.equal(reset.showRadar,false);assert.equal(reset.radarMode,true);assert.equal(reset.sort,'SOFLAN');assert.equal(reset.query,'');assert.equal(reset.rank,'all');assert.deepEqual(reset.radarRanges,emptyRadarRanges());assert.deepEqual(parseLibraryView('invalid'),initialLibraryView());
});
test('100 is half the 200 radius; maximum polygon fits; unknown values sort last both ways',()=>{
 for(const size of [104,116,132,220])for(let axis=0;axis<6;axis++){
  const a=radarPoint(axis,100,size),b=radarPoint(axis,200,size),c=size/2;
  assert(Math.abs(Math.hypot(a[0]-c,a[1]-c)*2-Math.hypot(b[0]-c,b[1]-c))<1e-8);
  assert(b.every(v=>v>=0&&v<=size));
 }
 for(const direction of [1,-1]){assert(compareNullable(null,0,direction)>0);assert(compareNullable(0,null,direction)<0);}
});

test('CPI uses SP level 12 chart IDs, all clear types and JSON-safe missing/infinite values',()=>{
 const f=fixture(),e=enrichCatalog(f.catalog,f.payload),[sp,dp,missing,partial]=e.charts;
 assert.equal(chartRating(sp,'cpi','hard','easy').value,1580.95);
 assert.equal(chartRating(sp,'cpi','hard','normal').value,1658.51);
 assert.equal(chartRating(sp,'cpi','normal','hard').value,1986.05);
 assert.equal(chartRating(sp,'cpi','hard','exh').value,2414.58);
 assert.deepEqual(chartRating(sp,'cpi','hard','fc'),{value:-1,label:'∞'});
 assert.equal(chartRating(partial,'cpi','hard','hard'),null);
 assert.equal(chartRating(missing,'cpi','hard'),null);
 assert.equal(chartRating(dp,'cpi','hard'),null);
 assert.equal(inDifficultyTable({...sp,level:11},'cpi'),false);
 assert.equal(e.additionalData.cpiCharts,2);
 assert.deepEqual(chartRank(sp,'cpi','hard'),{value:1900,label:'1900〜1999.99'});
 assert.equal(chartRank(sp,'cpi','hard','fc').value,-1);
 for(const direction of [1,-1]){
  const values=[null,1500,-1,2000].sort((a,b)=>compareNullable(ratingSortValue(a,'cpi'),ratingSortValue(b,'cpi'),direction));
  assert.deepEqual(values,direction===1?[1500,2000,-1,null]:[-1,2000,1500,null]);
 }
 assert.equal(JSON.parse(JSON.stringify(sp)).community.cpi.fc.value,-1);
 const view={...initialLibraryView(),table:'cpi',cpiGauge:'exh',rank:'2400',sort:'unofficial'};
 assert.deepEqual(parseLibraryView(serializeLibraryView(view)),view);
 assert.equal(clearLibraryFilters(view).cpiGauge,'exh');
 const original=structuredClone(f.catalog);f.payload[7]['1258'].A.hard.cpi_value=-4;
 assert.throws(()=>enrichCatalog(f.catalog,f.payload));assert.deepEqual(f.catalog,original);
});
