import {seriesCode,type Chart,type CpiGauge,type Mode,type Song} from './iidx-data';
import {chartRating,inDifficultyTable,type ClearGauge,type DifficultyTable} from './iidx-additional';
import {type PlayScore} from './play-data';
import {emptyFolderSummary,folderDjLevel,type FolderSummary} from './folder-summary';

export type OfficialFolderGrouping='level'|'series';
export type FolderContext={table:DifficultyTable;mode:Mode;gauge:ClearGauge;cpiGauge:CpiGauge;dpParent?:string;officialGrouping?:OfficialFolderGrouping;songById?:Readonly<Record<string,Pick<Song,'series'>>>;seriesNames?:Readonly<Record<number,string>>};
export type DifficultyFolder={key:string;label:string;shortLabel:string;songCount:number;chartCount:number;summary:FolderSummary;description?:string};

// Fallbacks for catalogs without CPI data. Downloaded values determine the bounds.
const cpiFloor:Record<CpiGauge,number>={easy:1050,normal:1250,hard:1350,exh:1600,fc:1850};
const cpiGaugeName:Record<CpiGauge,string>={easy:'EASY',normal:'CLEAR',hard:'HARD',exh:'EX HARD',fc:'FC'};
export const difficultyFolderPrefix=(context:FolderContext)=>context.table==='cpi'?`${cpiGaugeName[context.cpiGauge]} 適正CPI`:'';
const spRanks:[number,string][]=[
 [0.5,'個人差F'],[1,'地力F'],[1.5,'個人差E'],[2,'地力E'],[2.5,'個人差D'],[3,'地力D'],
 [3.5,'個人差C'],[4,'地力C'],[4.5,'個人差B'],[5,'地力B'],[5.5,'個人差B+'],[6,'地力B+'],
 [6.5,'個人差A'],[7,'地力A'],[7.5,'個人差A+'],[8,'地力A+'],[8.5,'個人差S'],[9,'地力S'],[9.5,'個人差S+'],[10,'地力S+'],
];

export function difficultyFolderKey(chart:Chart,context:FolderContext):string{
 const {table,gauge,cpiGauge}=context;
 if(table==='official'){
  if(context.officialGrouping!=='series')return String(chart.level);
  const series=context.songById?.[chart.songId]?.series;
  return `series:${series!=null&&Number.isFinite(series)?series:'missing'}`;
 }
 const rating=chartRating(chart,table,gauge,cpiGauge),value=rating?.value;
 if(table==='cpi'){
  if(value===-1)return 'infinity';
  return value==null||!Number.isFinite(value)||value<0?'excluded':String(Math.floor(value/50)*50);
 }
 if(value==null||!Number.isFinite(value))return 'missing';
 if(table==='dp'){
  if(value<0)return 'missing';
  // Preserve integer folders at the root; distinguish 12.0 from its parent 12.
  return context.dpParent!==undefined?(Math.floor((value+1e-9)*10)/10).toFixed(1):String(Math.floor(value));
 }
 return String(value);
}

export function buildDifficultyFolders(catalogCharts:Chart[],filteredCharts:Chart[],context:FolderContext,records:Record<string,PlayScore>={}):DifficultyFolder[]{
 const {table,mode,gauge,cpiGauge}=context;
 const belongs=(c:Chart)=>c.mode===mode&&inDifficultyTable(c,table)&&(table!=='dp'||context.dpParent===undefined||difficultyFolderKey(c,{...context,dpParent:undefined})===context.dpParent);
 const eligible=catalogCharts.filter(belongs);
 const counts=new Map<string,{songs:Set<string>;charts:number;summary:FolderSummary}>();
 for(const chart of filteredCharts){
  if(!belongs(chart))continue;
  const key=difficultyFolderKey(chart,context),count=counts.get(key)??{songs:new Set<string>(),charts:0,summary:emptyFolderSummary()};
  const score=records[chart.id];count.summary.dj[folderDjLevel(chart,score)]++;count.summary.clear[score?.lamp??'missing']++;
  count.songs.add(chart.songId);count.charts++;counts.set(key,count);
 }
 const prefix=difficultyFolderPrefix(context);
 const folder=(key:string,label:string,description?:string):DifficultyFolder=>({key,label,shortLabel:prefix&&label.startsWith(prefix+' ')?label.slice(prefix.length+1):label,songCount:counts.get(key)?.songs.size??0,chartCount:counts.get(key)?.charts??0,summary:counts.get(key)?.summary??emptyFolderSummary(),...(description?{description}:{})});
 if(table==='official'){
  if(context.officialGrouping!=='series'){const folders=Array.from({length:12},(_,i)=>folder(String(12-i),`☆${12-i}`));if(eligible.some(c=>c.level===0))folders.push(folder('0','難度不明'));return folders;}
  // Use the catalog's series, including folders emptied by the current filters.
  // Names remain data-driven so later releases need no application update.
  const keys=new Set(eligible.map(chart=>difficultyFolderKey(chart,context)));
  const series=[...keys].filter(key=>key!=='series:missing').map(key=>Number(key.slice(7))).sort((a,b)=>b-a);
  const folders=series.map(value=>folder(`series:${value}`,`${seriesCode(value)} · ${context.seriesNames?.[value]??'シリーズ名未登録'}`));
  if(keys.has('series:missing'))folders.push(folder('series:missing','シリーズ不明','楽曲DBにシリーズ情報がない譜面です。'));
  return folders;
 }
 const ratings=eligible.map(c=>chartRating(c,table,gauge,cpiGauge)).filter((r):r is NonNullable<typeof r>=>!!r);
 if(table==='cpi'){
  const values=ratings.map(r=>r.value).filter(v=>Number.isFinite(v)&&v>=0);
  const low=values.length?Math.floor(Math.min(...values)/50)*50:cpiFloor[cpiGauge];
  const high=values.length?Math.floor(Math.max(...values)/50)*50:low;
  const prefix=`${cpiGaugeName[cpiGauge]} 適正CPI `,folders:DifficultyFolder[]=[];
  if(ratings.some(r=>r.value===-1))folders.push(folder('infinity',prefix+'∞'));
  for(let start=high;start>=low;start-=50)folders.push(folder(String(start),`${prefix}${start}～${start+50}`));
  folders.push(folder('excluded',prefix+'算出対象外','算出対象外・CPI未掲載の譜面を表示しています。'));
  return folders;
 }
 const folders:DifficultyFolder[]=[];
 if(table==='dp'){
  if(context.dpParent!==undefined){
   const keys=[...new Set(eligible.map(c=>difficultyFolderKey(c,context)))].sort((a,b)=>Number(b)-Number(a));
   return keys.map(key=>folder(key,key));
  }
  const values=ratings.map(r=>r.value).filter(v=>Number.isFinite(v)&&v>=0);
  const low=Math.min(1,...values.map(Math.floor)),high=Math.max(12,...values.map(Math.floor));
  for(let n=high;n>=low;n--)folders.push(folder(String(n),`DP非公式難度 ${n}`));
 }else{
  // Keep the table's named ranks visible even when a filter leaves them empty.
  const ranks=new Map(spRanks.filter(([value])=>table==='sp12'||![5.5,6,7.5,8].includes(value)));
  ranks.set(-1,'未定');
  if(table==='sp12')ranks.set(-2,'不明');else ranks.set(12,'超個人差');
  for(const rating of ratings)ranks.set(rating.value,rating.label);
  for(const [value,label] of [...ranks].sort((a,b)=>b[0]-a[0]))folders.push(folder(String(value),label));
 }
 folders.push(folder('missing','未掲載','この難易度表に評価が掲載されていない譜面です。'));
 return folders;
}
