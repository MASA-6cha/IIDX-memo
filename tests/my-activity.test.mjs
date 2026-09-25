import assert from 'node:assert/strict';
import test from 'node:test';
import {loadSource} from './load-source.mjs';
const {calculateActivity}=await loadSource('../lib/my-activity.ts');
const {resolvePlayRecords}=await loadSource('../lib/play-history.ts');
const at='2026-09-23T00:00:00.000Z';
const song=(id,removed=false)=>({id,title:id,removed});
const chart=(songId,difficulty='ANOTHER',values=[100,100,100,100,100,100],extra={})=>({id:`${songId}:SP:${difficulty}`,songId,mode:'SP',difficulty,level:12,noteCount:1000,radar:{values,notes:1000},unofficialRatings:{},...extra});
const score=(exScore=1600,extra={})=>({exScore,lamp:'HARD CLEAR',djLevel:'AA',gameVersion:33,pgreat:null,great:null,missCount:null,fetchedAt:at,importedAt:at,...extra});

test('Zero radar candidates are excluded per axis and the total sums displayed hundredths',()=>{
 const charts=[chart('a','ANOTHER',[0,1.13,0,0,0,0]),chart('b','ANOTHER',[0,0,1.17,0,0,0])];
 const records=Object.fromEntries(charts.map(c=>[c.id,score(2000)]));
 const result=calculateActivity(charts,[song('a'),song('b')],records,'SP','all');
 assert.equal(result.axes[0].top.length,0);assert.equal(result.axes[0].candidates,0);
 assert.equal(result.axes[1].top.length,1);assert.equal(result.axes[2].top.length,1);
 assert.equal(result.radarTotal,0.22);
 const empty=calculateActivity(charts,[song('a'),song('b')],{},'SP','all');
 assert.equal(empty.radarTotal,0);assert.ok(empty.axes.every(axis=>axis.top.length===0));
});

test('Rates are fractional multipliers; best chart is chosen separately per axis and shortage still divides by ten',()=>{
 const charts=[chart('a','ANOTHER',[150,50,0,100,100,100]),chart('a','HYPER',[100,200,0,100,100,100]),chart('b')];
 const records=Object.fromEntries(charts.map(c=>[c.id,score(c.difficulty==='HYPER'?1000:1600)]));
 const stats=calculateActivity(charts,[song('a'),song('b')],records,'SP','all');
 assert.equal(stats.axes[0].value,20); // (150*.8 + 100*.8) / 10
 assert.equal(stats.axes[1].value,18); // HYPER supplies PEAK: (200*.5 + 100*.8) / 10
 assert.equal(stats.axes[0].top[0].chart.difficulty,'ANOTHER');assert.equal(stats.axes[1].top[0].chart.difficulty,'HYPER');
 assert.equal(stats.axes[0].top.length,2);assert.equal(stats.total,3);assert.equal(stats.clear['HARD CLEAR'],3);assert.equal(stats.dj.AA,3);
});

test('Top ten matches a full-sort oracle and never duplicates a song; inputs remain unchanged',()=>{
 const songs=Array.from({length:50},(_,i)=>song(`s${i}`));
 const charts=songs.flatMap((s,i)=>['NORMAL','HYPER','ANOTHER'].map((d,j)=>chart(s.id,d,Array.from({length:6},(_,axis)=>(i*17+j*37+axis*11)%201))));
 const records=Object.fromEntries(charts.map((c,i)=>[c.id,score(1000+i%1001)]));
 const before=JSON.stringify({charts,records});const result=calculateActivity(charts,songs,records,'SP','all');
 for(let axis=0;axis<6;axis++){
  const hundredths=songs.map(s=>Math.max(...charts.filter(c=>c.songId===s.id).map(c=>Number(BigInt(records[c.id].exScore)*BigInt(c.radar.values[axis])*100n/2000n)))).sort((a,b)=>b-a).slice(0,10);
  assert.equal(result.axes[axis].value,Math.floor(hundredths.reduce((a,b)=>a+b,0)/10)/100);assert.equal(new Set(result.axes[axis].top.map(c=>c.chart.songId)).size,10);
 }
 assert.equal(JSON.stringify({charts,records}),before);
});

test('Both chart contributions and the top-ten average truncate after two decimal places',()=>{
 const songs=Array.from({length:10},(_,i)=>song(`s${i}`)),charts=songs.map(s=>chart(s.id,'ANOTHER',undefined,{noteCount:10000}));
 const records=Object.fromEntries(charts.map((c,i)=>[c.id,score(i<5?18001:18003)]));
 const result=calculateActivity(charts,songs,records,'SP','all');
 // Raw: five 90.005 and five 90.015. Truncated: five 90.00 and five 90.01.
 // Their average is 90.005, truncated again to 90.00 (not 90.01).
 for(const axis of result.axes){assert.deepEqual(axis.top.map(item=>item.value),[90.01,90.01,90.01,90.01,90.01,90,90,90,90,90]);assert.equal(axis.value,90);}
 const one=calculateActivity([charts[5]],[songs[5]],{[charts[5].id]:records[charts[5].id]},'SP','all');
 assert.equal(one.axes[0].value,9); // 90.01 / 10 -> 9.00, even with fewer than ten songs.
});

test('Exact hundredths, near-boundary values and zero/full scores are not rounded by binary arithmetic',()=>{
 const fixtures=[
  {notes:1000,ex:820,radar:80,expected:32.8},
  {notes:1000,ex:2000,radar:1.13,expected:1.13},
  {notes:1000,ex:2000,radar:199.99999999999997,expected:199.99},
  {notes:1000,ex:2000,radar:1e-7,expected:0},
  {notes:1000,ex:0,radar:200,expected:0},
  {notes:100000,ex:200000,radar:200,expected:200},
 ];
 for(const fixture of fixtures){
  const songs=Array.from({length:10},(_,i)=>song(`s${i}`)),charts=songs.map(s=>chart(s.id,'ANOTHER',Array(6).fill(fixture.radar),{noteCount:fixture.notes}));
  const records=Object.fromEntries(charts.map(c=>[c.id,score(fixture.ex)]));
  const result=calculateActivity(charts,songs,records,'SP','all');
  for(const axis of result.axes){assert.equal(axis.value,fixture.expected,JSON.stringify(fixture));assert.equal(axis.top[0].value,fixture.expected);}
 }
});

test('Modes, availability, missing records, invalid scores and partially missing radar remain explicit',()=>{
 const charts=[chart('a'),chart('b'),chart('gone'),chart('dp','ANOTHER',undefined,{id:'dp:DP:ANOTHER',mode:'DP'}),chart('notes','ANOTHER',undefined,{noteCount:null}),chart('invalid'),chart('partial','ANOTHER',[150,null,0,0,0,0])];
 const songs=['a','b','gone','dp','notes','invalid','partial'].map(id=>song(id,id==='gone'));
 const records=Object.fromEntries(charts.filter(c=>c.songId!=='b').map(c=>[c.id,score(c.songId==='invalid'?2001:1600)]));
 const result=calculateActivity(charts,songs,records,'SP','available');
 assert.equal(result.total,5);assert.equal(result.recorded,4);assert.equal(result.missing,1);assert.equal(result.clear['NO PLAY'],1);assert.equal(result.dj['記録なし'],1);
 assert.equal(result.missingNotes,1);assert.equal(result.invalidScores,1);assert.equal(result.missingRadar,1);
 assert.equal(result.axes[0].value,20);assert.equal(result.axes[1].value,8);
 assert.equal(calculateActivity(charts,songs,records,'DP','available').total,1);
 assert.equal(calculateActivity(charts,songs,records,'SP','all').total,6);
});

test('Switching series or all-time best changes radar scores and preserves their source versions',()=>{
 const charts=[chart('a'),chart('b')],songs=[song('a'),song('b')];
 const history={[charts[0].id]:{'32':score(1800,{gameVersion:32}),'33':score(1000)},[charts[1].id]:{'33':score(1500,{manual:{score:at}})}};
 const get=source=>calculateActivity(charts,songs,resolvePlayRecords(history,source),'SP','all');
 assert.equal(get('version:32').axes[0].value,9);assert.equal(get('version:33').axes[0].value,12.5);assert.equal(get('best').axes[0].value,16.5);
 assert.deepEqual(get('best').axes[0].top.map(item=>item.version),[32,33]);assert.equal(get('best').manual,1);
});

test('Rank drilldown charts exactly match displayed counts and availability scope',()=>{
 const charts=[chart('a'),chart('b'),chart('missing'),chart('removed'),chart('dp','NORMAL',undefined,{mode:'DP'})];
 const songs=[song('a'),song('b'),song('missing'),song('removed',true),song('dp')];
 const records={[charts[0].id]:score(),[charts[1].id]:score(0,{djLevel:'F',lamp:'FAILED'}),[charts[3].id]:score()};
 for(const scope of ['available','all']){
  const stats=calculateActivity(charts,songs,records,'SP',scope);
  for(const [rank,count] of Object.entries(stats.dj))assert.equal(stats.djCharts[rank].length,count);
  for(const [rank,count] of Object.entries(stats.clear))assert.equal(stats.clearCharts[rank].length,count);
  assert.deepEqual(stats.djCharts['記録なし'].map(c=>c.songId),['missing']);
  assert.deepEqual(stats.clearCharts['NO PLAY'].map(c=>c.songId),['missing']);
  assert.equal(stats.djCharts.AA.length,scope==='all'?2:1);
 }
});
