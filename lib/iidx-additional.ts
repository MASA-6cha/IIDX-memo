import {z} from 'zod';
import {difficulties,type Catalog,type Chart,type Difficulty,type DifficultyRating,type GaugeRatings,type RadarValues,type CpiGauge,type CpiRatings} from './iidx-data';

export const radarAxes=[
 {key:'NOTES',label:'NOTES',short:'NTS',color:'#ff8dc5'},
 {key:'PEAK',label:'PEAK',short:'PEK',color:'#ffb36b'},
 {key:'SCRATCH',label:'SCRATCH',short:'SCR',color:'#ff777f'},
 {key:'SOFLAN',label:'SOF-LAN',short:'SFL',color:'#7cdfff'},
 {key:'CHARGE',label:'CHARGE',short:'CHG',color:'#bd9aff'},
 {key:'CHORD',label:'CHORD',short:'CHD',color:'#bbea7d'},
] as const;
export type RadarAxis=typeof radarAxes[number]['key'];
export type DifficultyTable='official'|'sp12'|'sp11'|'dp'|'cpi';
export type ClearGauge='normal'|'hard';
export const cpiGauges:{value:CpiGauge;label:string}[]=[{value:'easy',label:'EASY'},{value:'normal',label:'ノマゲ'},{value:'hard',label:'HARD'},{value:'exh',label:'EX HARD'},{value:'fc',label:'FC'}];
export type RadarRange={min:string;max:string};
export const emptyRadarRanges=():RadarRange[]=>radarAxes.map(()=>({min:'',max:''}));
export const difficultyColors:Record<Difficulty,string>={BEGINNER:'#7cda99',NORMAL:'#7ab9f5',HYPER:'#e9ce6c',ANOTHER:'#f78b9d',LEGGENDARIA:'#bea0f8'};
export const additionalFiles=['notes_radar/sp.json','notes_radar/dp.json','difficulty/sp12/songs_dict.json','difficulty/sp12/difficulty.json','difficulty/sp11/songs_dict.json','difficulty/sp11/difficulty.json','difficulty/dp/songs_dict.json','cpi/songs_dict.json'];

const id=z.string().regex(/^\d{1,12}$/),value=z.number().finite();
const five=z.array(value.min(0).max(200)).length(5);
const radarSchema=z.record(id,z.object({NOTES:five.optional(),PEAK:five.optional(),SCRATCH:five.optional(),SOFLAN:five.optional(),CHARGE:five.optional(),CHORD:five.optional(),notes:z.array(z.number().int().min(0).max(100000)).length(5)}));
const diffKey=z.enum(['B','N','H','A','L']);
const spSchema=z.record(id,z.record(diffKey,z.object({h_value:value.min(-2).max(100),n_value:value.min(-2).max(100)})));
const labels=z.record(z.string(),z.string().min(1).max(80));
const labelsSchema=z.object({normal:labels,hard:labels});
const dpSchema=z.record(id,z.record(diffKey,z.object({value:value.min(0).max(20)})));
const cpiNumber=value.refine(n=>n>=0||[-1,-2,-3].includes(n));
const cpiPair=z.object({cpi_value:cpiNumber,kojinsa_value:cpiNumber});
const cpiChart=z.object({easy:cpiPair,clear:cpiPair,hard:cpiPair,exh:cpiPair,fc:cpiPair});
const cpiSchema=z.record(id,z.object({cpi_id:id.optional(),B:cpiChart.optional(),N:cpiChart.optional(),H:cpiChart.optional(),A:cpiChart.optional(),L:cpiChart.optional()}));

// Join only on the provider's song ID, mode and chart difficulty; titles are not unique.
export function enrichCatalog(catalog:Catalog,payload:unknown[]):Catalog{
 const schemas=[radarSchema,radarSchema,spSchema,labelsSchema,spSchema,labelsSchema,dpSchema,cpiSchema];
 const parsed=schemas.map((schema,i)=>schema.safeParse(payload[i]));
 if(parsed.some(p=>!p.success))throw new Error('追加難易度・ノーツレーダーの形式を読み取れませんでした。');
 const spRadar=radarSchema.parse(payload[0]),dpRadar=radarSchema.parse(payload[1]);
 const sp12=spSchema.parse(payload[2]),sp12Labels=labelsSchema.parse(payload[3]);
 const sp11=spSchema.parse(payload[4]),sp11Labels=labelsSchema.parse(payload[5]),dp=dpSchema.parse(payload[6]);
 const cpi=cpiSchema.parse(payload[7]);
 if([spRadar,dpRadar,sp12,sp11,dp,cpi].some(x=>Object.keys(x).length<100))throw new Error('追加データの件数が少なすぎるため更新を中止しました。');
 const counts={radarCharts:0,sp11Charts:0,sp12Charts:0,dpCharts:0,cpiCharts:0};
 const charts=catalog.charts.map(chart=>{
  const rawId=chart.songId.replace(/^idt-/,''),index=difficulties.indexOf(chart.difficulty),key=chart.difficulty[0] as z.infer<typeof diffKey>;
  const source=(chart.mode==='SP'?spRadar:dpRadar)[rawId],community:NonNullable<Chart['community']>={};
  const radar=source&&source.notes[index]>0?{values:radarAxes.map(a=>source[a.key]?.[index]??null) as RadarValues,notes:source.notes[index]}:null;
  if(radar)counts.radarCharts++;
  if(chart.mode==='SP')for(const [table,songs,names] of [['sp12',sp12,sp12Labels],['sp11',sp11,sp11Labels]] as const){
   const record=songs[rawId]?.[key];if(!record)continue;
   const rating=(g:ClearGauge):DifficultyRating|null=>{const n=record[g==='hard'?'h_value':'n_value'],label=names[g][String(n)];if(!label)throw new Error('非公式難易度の区分が配信データと一致しません。');return {value:n,label};};
   community[table]={normal:rating('normal'),hard:rating('hard')} as GaugeRatings;counts[table==='sp12'?'sp12Charts':'sp11Charts']++;
  }
  else {const record=dp[rawId]?.[key];if(record){community.dp={value:record.value,label:record.value.toFixed(1)};counts.dpCharts++;}}
  if(chart.mode==='SP'&&chart.level===12){
   const record=cpi[rawId]?.[key];
   if(record){
    // The provider encodes infinity as -1, and unavailable/invalid values as -2/-3.
    // Keep the infinity sentinel JSON-safe in storage; convert only for comparison/display.
    const available=(n:number)=>n>=0||n===-1?n:null;
    community.cpi=Object.fromEntries(cpiGauges.map(({value:g})=>{const pair=record[g==='normal'?'clear':g];return [g,{value:available(pair.cpi_value),individual:available(pair.kojinsa_value)}];})) as CpiRatings;
    if(Object.values(community.cpi).some(r=>r.value!==null))counts.cpiCharts++;
   }
  }
  return {...chart,radar,community};
 });
 return {...catalog,charts,additionalData:counts};
}

export function inDifficultyTable(chart:Chart,table:DifficultyTable){return table==='official'||(table==='dp'?chart.mode==='DP':chart.mode==='SP'&&chart.level===(table==='sp11'?11:12));}
export function chartRating(chart:Chart,table:DifficultyTable,gauge:ClearGauge,cpiGauge:CpiGauge='hard'):DifficultyRating|null{
 if(table==='official')return null;
 if(table==='dp')return chart.mode==='DP'?chart.community?.dp??null:null;
 if(table==='cpi'){const n=inDifficultyTable(chart,table)?chart.community?.cpi?.[cpiGauge]?.value:null;return n==null?null:{value:n,label:n===-1?'∞':n.toFixed(2)};}
 return inDifficultyTable(chart,table)?chart.community?.[table]?.[gauge]??null:null;
}
export function ratingSortValue(value:number|null|undefined,table:DifficultyTable){return value==null?null:table==='cpi'&&value===-1?Infinity:value<0?null:value;}
export function chartRank(chart:Chart,table:DifficultyTable,gauge:ClearGauge,cpiGauge:CpiGauge='hard'):DifficultyRating|null{
 const rating=chartRating(chart,table,gauge,cpiGauge);
 if(table!=='cpi'||!rating||rating.value<0)return rating;
 const start=Math.floor(rating.value/100)*100;return {value:start,label:`${start}〜${start+99.99}`};
}
export function radarRangeError(ranges:RadarRange[]){
 for(let i=0;i<ranges.length;i++){
  const {min,max}=ranges[i];
  if([min,max].some(v=>v!==''&&(!Number.isFinite(Number(v))||Number(v)<0||Number(v)>200)))return `${radarAxes[i].label}は0〜200で指定してください。`;
  if(min!==''&&max!==''&&Number(min)>Number(max))return `${radarAxes[i].label}の下限は上限以下にしてください。`;
 }
 return '';
}
export function matchesRadar(chart:Chart,ranges:RadarRange[]){return ranges.every(({min,max},i)=>{const value=chart.radar?.values[i];return (min===''&&max==='')||value!=null&&(min===''||value>=Number(min))&&(max===''||value<=Number(max));});}
export function compareNullable(a:number|null|undefined,b:number|null|undefined,direction:number){return a==null?(b==null?0:1):b==null?-1:direction*(a-b);}
export function radarPoint(index:number,value:number,size:number){const center=size/2,radius=Math.max(1,center-25)*Math.min(200,Math.max(0,value))/200,angle=-Math.PI/2+index*Math.PI/3;return [center+Math.cos(angle)*radius,center+Math.sin(angle)*radius] as const;}
