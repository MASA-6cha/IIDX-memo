import assert from 'node:assert/strict';
import test from 'node:test';
import {loadSource} from './load-source.mjs';
const {buildDifficultyFolders,difficultyFolderKey}=await loadSource('../lib/difficulty-folders.ts');
const {initialLibraryView,parseLibraryView,serializeLibraryView,clearLibraryFilters}=await loadSource('../lib/iidx-view.ts');

const context=(table,extra={})=>({table,mode:table==='dp'?'DP':'SP',gauge:'hard',cpiGauge:'easy',...extra});
const chart=(songId,extra={})=>({id:`${songId}:SP:ANOTHER`,songId,mode:'SP',difficulty:'ANOTHER',level:12,...extra});
const cpi=(songId,value,extra={})=>chart(songId,{community:{cpi:{easy:{value,individual:null}}},...extra});
const rated=(songId,table,hard,normal=hard)=>chart(songId,{level:table==='sp11'?11:12,community:{[table]:{hard,normal}}});

test('CPI ranges do not overlap, keep empty ranges after filtering, and count distinct songs',()=>{
 const charts=[cpi('low',1050),cpi('edge',1099.99),cpi('boundary',1100),cpi('boundary',1149.99,{id:'boundary:SP:LEGGENDARIA',difficulty:'LEGGENDARIA'}),cpi('top',1249.99),cpi('unknown',null),cpi('infinite',-1)];
 const ctx=context('cpi'),folders=buildDifficultyFolders(charts,charts,ctx);
 assert.deepEqual(folders.map(f=>f.key),['infinity','1200','1150','1100','1050','excluded']);
 assert.equal(folders.find(f=>f.key==='1050').label,'EASY 適正CPI 1050～1100');
 assert.equal(folders.find(f=>f.key==='1100').chartCount,2);
 assert.equal(folders.find(f=>f.key==='1100').songCount,1);
 assert.equal(folders.find(f=>f.key==='1150').chartCount,0);
 assert.deepEqual(charts.map(c=>difficultyFolderKey(c,ctx)),['1050','1050','1100','1100','1200','excluded','infinity']);
 const filtered=buildDifficultyFolders(charts,[charts[4]],ctx);
 assert.deepEqual(filtered.map(f=>f.key),folders.map(f=>f.key));
 assert.equal(filtered.find(f=>f.key==='1050').chartCount,0);
 assert.equal(filtered.find(f=>f.key==='1200').songCount,1);
});

test('Each CPI gauge derives bounds from its own data and keeps excluded charts accessible',()=>{
 const shared=chart('gauge',{community:{cpi:{easy:{value:1080},normal:{value:1290},hard:{value:1399.5},exh:{value:1640},fc:{value:1888}}}});
 for(const [cpiGauge,lowest] of [['easy','1050'],['normal','1250'],['hard','1350'],['exh','1600'],['fc','1850']]){
  const folders=buildDifficultyFolders([shared,chart('missing')],[shared,chart('missing')],context('cpi',{cpiGauge}));
  assert.deepEqual(folders.map(f=>f.key),[lowest,'excluded']);assert.equal(folders[1].chartCount,1);
 }
 const empty=buildDifficultyFolders([],[],context('cpi',{cpiGauge:'fc'}));
 assert.deepEqual(empty.map(f=>f.key),['1850','excluded']);
 const moved=cpi('newMinimum',1000);assert.equal(buildDifficultyFolders([moved],[moved],context('cpi'))[0].key,'1000');
});

test('SP folders use the selected gauge labels, retain unclassified ranks and isolate level 11/12',()=>{
 const a=rated('a','sp12',{value:9,label:'地力S'},{value:6.5,label:'個人差A'});
 const b=rated('b','sp12',{value:-1,label:'未定'}),c=rated('c','sp12',{value:-2,label:'不明'});
 const sp11=rated('sp11','sp11',{value:12,label:'超個人差'});
 const all=[a,b,c,sp11,chart('missing')];
 const hard=buildDifficultyFolders(all,all,context('sp12'));
 assert.equal(hard.find(f=>f.label==='地力S').songCount,1);
 assert.equal(hard.find(f=>f.label==='個人差A').chartCount,0);
 assert.deepEqual(hard.slice(-3).map(f=>[f.label,f.chartCount]),[['未定',1],['不明',1],['未掲載',1]]);
 const normal=buildDifficultyFolders(all,all,context('sp12',{gauge:'normal'}));
 assert.equal(normal.find(f=>f.label==='個人差A').songCount,1);
 const lower=buildDifficultyFolders(all,all,context('sp11'));
 assert.equal(lower[0].label,'超個人差');assert.equal(lower[0].chartCount,1);
 assert(!lower.some(f=>f.label==='地力B+'));assert(!lower.some(f=>f.label==='不明'));
});

test('DP truncates decimals without rounding, keeps low empty levels and excludes SP charts',()=>{
 const dp=(id,value)=>chart(id,{mode:'DP',community:{dp:{value,label:String(value)}}});
 const all=[dp('a',12.3),dp('b',11.9),dp('c',12),chart('missing',{mode:'DP'}),chart('sp',{community:{dp:{value:12.5,label:'12.5'}}})];
 const ctx=context('dp'),folders=buildDifficultyFolders(all,all,ctx);
 assert.equal(folders[0].label,'DP非公式難度 12');assert.equal(folders[0].chartCount,2);
 assert.equal(folders[1].label,'DP非公式難度 11');assert.equal(folders[1].chartCount,1);
 assert.equal(folders.find(f=>f.key==='1').chartCount,0);assert.equal(folders.at(-1).chartCount,1);
 assert.deepEqual(all.slice(0,4).map(c=>difficultyFolderKey(c,ctx)),['12','11','12','missing']);
});

test('DP decimal subfolders stay within their parent and preserve filtered counts and summaries',()=>{
 const dp=(id,value,extra={})=>chart(id,{id:`${id}:DP:ANOTHER`,mode:'DP',community:{dp:{value,label:String(value)}},...extra});
 const all=[dp('zero',12),dp('one',12.1),dp('two',12.2),dp('two',12.2,{id:'two:DP:HYPER',difficulty:'HYPER'}),dp('edge',12.9),dp('lower',11.9),dp('upper',13),dp('negative',-1),chart('missing',{mode:'DP'}),chart('sp',{community:{dp:{value:12.1,label:'12.1'}}})];
 const records={[all[1].id]:{exScore:1500,djLevel:'AA',lamp:'HARD CLEAR'}};
 const ctx=context('dp',{dpParent:'12'}),folders=buildDifficultyFolders(all,all,ctx,records);
 assert.deepEqual(folders.map(f=>f.key),['12.9','12.2','12.1','12.0']);
 assert.equal(difficultyFolderKey(all[0],ctx),'12.0');
 assert.equal(folders[1].chartCount,2);assert.equal(folders[1].songCount,1);
 assert.equal(folders[2].summary.dj.AA,1);assert.equal(folders[2].summary.clear['HARD CLEAR'],1);
 assert.equal(folders.reduce((n,f)=>n+f.chartCount,0),buildDifficultyFolders(all,all,context('dp'))[1].chartCount);
 const filtered=buildDifficultyFolders(all,[all[1]],ctx,records);
 assert.deepEqual(filtered.map(f=>f.key),folders.map(f=>f.key));
 assert.deepEqual(filtered.map(f=>f.chartCount),[0,0,1,0]);
 assert.deepEqual(buildDifficultyFolders(all,all,context('dp',{dpParent:'11'})).map(f=>f.key),['11.9']);
 for(const difficultyFolder of ['12','12.0','12.1']){
  const view={...initialLibraryView(),table:'dp',difficultyFolder};
  assert.deepEqual(parseLibraryView(serializeLibraryView(view)),view);
 }
});

test('Official folders cover every level and count only the active play mode',()=>{
 const all=[chart('sp12'),chart('dp12',{mode:'DP'}),chart('sp1',{level:1})];
 const folders=buildDifficultyFolders(all,all,context('official'));
 assert.equal(folders.length,12);assert.equal(folders[0].label,'☆12');assert.equal(folders[0].chartCount,1);
 assert.equal(folders[1].chartCount,0);assert.equal(folders.at(-1).songCount,1);
});

test('Folder display and position persist; reset clears position without discarding display preference',()=>{
 for(const difficultyFolder of ['1050','9','6.5','-1','excluded','infinity','missing']){
  const view={...initialLibraryView(),query:'冥',difficultyFolderMode:true,difficultyFolder};
  assert.deepEqual(parseLibraryView(serializeLibraryView(view)),view);
  const reset=clearLibraryFilters(view);assert.equal(reset.difficultyFolder,null);assert.equal(reset.difficultyFolderMode,true);
 }
 const old={...initialLibraryView(),query:'previous',difficultyFolderMode:undefined,difficultyFolder:undefined};
 const migrated=parseLibraryView(JSON.stringify({version:1,view:old}));
 assert.equal(migrated.query,'previous');assert.equal(migrated.difficultyFolder,null);
});

test('Folder summaries partition chart records without confusing zero scores, NO PLAY and missing imports',()=>{
 const score=(extra={})=>({exScore:1000,djLevel:'AA',lamp:'HARD CLEAR',...extra});
 const all=[chart('same'),chart('same',{id:'same:SP:HYPER',difficulty:'HYPER'}),chart('zero'),chart('no-score'),chart('not-imported'),chart('unknown'),chart('fallback',{noteCount:1000}),chart('dp',{id:'dp:DP:ANOTHER',mode:'DP'})];
 const records={
  [all[0].id]:score(),[all[1].id]:score({lamp:'NO PLAY',djLevel:'AAA'}),
  [all[2].id]:score({exScore:0,djLevel:'F'}),[all[3].id]:score({exScore:null,djLevel:null,lamp:'FAILED'}),
  [all[5].id]:score({djLevel:null}),[all[6].id]:score({djLevel:null,exScore:1778}),[all[7].id]:score(),
 };
 const folders=buildDifficultyFolders(all,all,context('official'),records),f=folders[0];
 assert.equal(f.songCount,6);assert.equal(f.chartCount,7);
 assert.equal(f.summary.dj.AAA,2);assert.equal(f.summary.dj.AA,1);
 assert.equal(f.summary.dj['no-score'],2);assert.equal(f.summary.dj.F,0);
 assert.equal(f.summary.dj.missing,1);assert.equal(f.summary.dj.unknown,1);
 assert.equal(f.summary.clear['NO PLAY'],1);assert.equal(f.summary.clear['HARD CLEAR'],4);
 assert.equal(f.summary.clear.FAILED,1);assert.equal(f.summary.clear.missing,1);
 assert.equal(Object.values(f.summary.dj).reduce((a,b)=>a+b,0),f.chartCount);
 assert.equal(Object.values(f.summary.clear).reduce((a,b)=>a+b,0),f.chartCount);
 assert.equal(Object.values(folders[1].summary.dj).reduce((a,b)=>a+b,0),0);
 const filtered=buildDifficultyFolders(all,[all[1]],context('official'),records)[0];
 assert.equal(filtered.chartCount,1);assert.equal(filtered.summary.dj.AAA,1);assert.equal(filtered.summary.clear['NO PLAY'],1);
});

test('Every clear type gets its own column; no records defaults to 未取得',()=>{
 const lamps=['FULLCOMBO CLEAR','EX HARD CLEAR','HARD CLEAR','CLEAR','EASY CLEAR','ASSIST CLEAR','FAILED','NO PLAY'];
 const all=lamps.map((lamp,i)=>chart(String(i))),records=Object.fromEntries(all.map((c,i)=>[c.id,{lamp:lamps[i],exScore:0,djLevel:null}]));
 const f=buildDifficultyFolders(all,all,context('official'),records)[0];
 for(const lamp of lamps)assert.equal(f.summary.clear[lamp],1);
 assert.equal(f.summary.dj['no-score'],8);
 assert.equal(buildDifficultyFolders(all,all,context('official'))[0].summary.dj.missing,8);
});

test('CPI short labels keep complete names for all gauges, ranges and special folders',()=>{
 for(const [cpiGauge,name] of [['easy','EASY'],['normal','CLEAR'],['hard','HARD'],['exh','EX HARD'],['fc','FC']]){
  const all=[chart('a',{community:{cpi:{[cpiGauge]:{value:1800}}}}),chart('b',{community:{cpi:{[cpiGauge]:{value:-1}}}}),chart('missing')];
  const folders=buildDifficultyFolders(all,all,context('cpi',{cpiGauge}));
  assert.deepEqual(folders.map(f=>f.shortLabel),['∞','1800～1850','算出対象外']);
  assert.deepEqual(folders.map(f=>f.label),folders.map(f=>`${name} 適正CPI ${f.shortLabel}`));
 }
});

test('Summary choice persists and survives filter reset; old saved views retain their existing preferences',()=>{
 for(const folderSummary of ['none','dj','clear','both']){
  const view={...initialLibraryView(),folderSummary,query:'test'};
  assert.equal(parseLibraryView(serializeLibraryView(view)).folderSummary,folderSummary);
  assert.equal(clearLibraryFilters(view).folderSummary,folderSummary);
 }
 const old={...initialLibraryView(),folderSummary:undefined,query:'previous',theme:'light',table:'cpi',cpiGauge:'fc'};
 const migrated=parseLibraryView(JSON.stringify({version:1,view:old}));
 assert.equal(migrated.folderSummary,'both');assert.equal(migrated.query,'previous');assert.equal(migrated.theme,'light');assert.equal(migrated.cpiGauge,'fc');
});

test('Official series folders use song series, newest first, and aggregate only filtered charts in the active mode',()=>{
 const songs=[['early',1],['sub',1.5],['second',2],['new',34],['console',-1],['dp',30]].map(([id,series])=>({id,series}));
 const all=[chart('early',{level:1}),chart('sub'),chart('second'),chart('new'),chart('new',{id:'new:SP:HYPER',difficulty:'HYPER',level:10}),chart('console'),chart('dp',{id:'dp:DP:ANOTHER',mode:'DP'})];
 const ctx=context('official',{officialGrouping:'series',songById:Object.fromEntries(songs.map(s=>[s.id,s])),seriesNames:{1:'1st style',1.5:'substream',2:'2nd style',34:'ZINRAI',[-1]:'CS / その他',30:'RESIDENT'}});
 const records={[all[3].id]:{exScore:1000,djLevel:'A',lamp:'HARD CLEAR'},[all[4].id]:{exScore:0,djLevel:null,lamp:'NO PLAY'}};
 const folders=buildDifficultyFolders(all,all,ctx,records);
 assert.deepEqual(folders.map(f=>f.key),['series:34','series:2','series:1.5','series:1','series:-1']);
 assert.equal(folders[0].label,'34 · ZINRAI');assert.equal(folders[0].songCount,1);assert.equal(folders[0].chartCount,2);
 assert.equal(folders[0].summary.dj.A,1);assert.equal(folders[0].summary.dj['no-score'],1);
 assert.equal(folders[0].summary.clear['HARD CLEAR'],1);assert.equal(folders[0].summary.clear['NO PLAY'],1);
 assert.equal(difficultyFolderKey(all[4],ctx),'series:34');
 const filtered=buildDifficultyFolders(all,[all[3]],ctx,records);
 assert.deepEqual(filtered.map(f=>f.key),folders.map(f=>f.key));assert.equal(filtered[0].chartCount,1);assert.equal(filtered[1].chartCount,0);
 const dp=buildDifficultyFolders(all,all,{...ctx,mode:'DP'},records);
 assert.deepEqual(dp.map(f=>[f.key,f.chartCount]),[['series:30',1]]);
});

test('Series grouping handles missing catalog metadata and never overrides non-official folder rules',()=>{
 const all=[chart('known'),chart('unknown')];
 const ctx=context('official',{officialGrouping:'series',songById:{known:{series:35}},seriesNames:{}});
 const folders=buildDifficultyFolders(all,all,ctx);
 assert.deepEqual(folders.map(f=>[f.key,f.label]),[['series:35','35 · シリーズ名未登録'],['series:missing','シリーズ不明']]);
 assert.equal(folders[1].chartCount,1);
 assert.equal(difficultyFolderKey(all[0],{...ctx,officialGrouping:'level'}),'12');
 const ratedChart=cpi('known',1800);
 assert.equal(difficultyFolderKey(ratedChart,{...ctx,table:'cpi'}),'1800');
 assert.deepEqual(buildDifficultyFolders([ratedChart],[ratedChart],{...ctx,table:'cpi'}).map(f=>f.key),['1800','excluded']);
});

test('Official folder classification and series position persist without changing legacy saved views',()=>{
 for(const difficultyFolder of ['series:34','series:1.5','series:-1','series:missing']){
  const view={...initialLibraryView(),officialFolderGrouping:'series',difficultyFolder,folderSummary:'clear',query:'冥'};
  assert.deepEqual(parseLibraryView(serializeLibraryView(view)),view);
  const reset=clearLibraryFilters(view);assert.equal(reset.officialFolderGrouping,'series');assert.equal(reset.difficultyFolder,null);assert.equal(reset.folderSummary,'clear');
 }
 const old={...initialLibraryView(),officialFolderGrouping:undefined,difficultyFolder:'12',query:'keep'};
 const migrated=parseLibraryView(JSON.stringify({version:1,view:old}));
 assert.equal(migrated.officialFolderGrouping,'level');assert.equal(migrated.difficultyFolder,'12');assert.equal(migrated.query,'keep');
});
