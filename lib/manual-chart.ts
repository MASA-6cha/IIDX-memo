import {z} from 'zod';
import type {Chart,RadarValues,ManualChartData} from './iidx-data';
import {canonicalChartId} from './iidx-ids';
const radarValue=z.number().finite().min(0).max(200).nullable();
export const manualChartSchema=z.object({
 bpm:z.string().regex(/^\d+(?:-\d+)?$/).refine(text=>{const [min,max=min]=text.split('-').map(Number);return min>=1&&max>=min&&max<=100000;}).optional(),
 noteCount:z.number().int().min(1).max(100000).optional(),
 radarValues:z.tuple([radarValue,radarValue,radarValue,radarValue,radarValue,radarValue]).optional(),
 updatedAt:z.string().refine(value=>Number.isFinite(Date.parse(value))),
}).strict();
export const manualChartsSchema=z.record(z.string().regex(/^[^:\s]{1,160}:(SP|DP):(BEGINNER|NORMAL|HYPER|ANOTHER|LEGGENDARIA)$/),manualChartSchema);
export function applyManualChart(chart:Chart,data:Record<string,ManualChartData>|undefined,songBpm?:string):Chart{
 const manual=data?.[chart.id]??data?.[canonicalChartId(chart.id)];if(!manual)return chart;
 const knownBpm=(value:string|undefined)=>!!value&&/\d/.test(value)&&value!=='0';
 const bpm=knownBpm(chart.bpm)?chart.bpm:knownBpm(songBpm)?songBpm:manual.bpm??chart.bpm;
 const noteCount=chart.noteCount!=null&&chart.noteCount>0?chart.noteCount:manual.noteCount??chart.noteCount;
 const values=Array.from({length:6},(_,i)=>chart.radar?.values[i]??manual.radarValues?.[i]??null) as RadarValues;
 const manualApplied:string[]=[];
 if(!knownBpm(chart.bpm)&&!knownBpm(songBpm)&&manual.bpm!==undefined)manualApplied.push('bpm');
 if((chart.noteCount==null||chart.noteCount<=0)&&manual.noteCount!==undefined)manualApplied.push('noteCount');
 if(manual.radarValues?.some((value,i)=>value!==null&&chart.radar?.values[i]==null))manualApplied.push('radarValues');
 return {...chart,bpm,noteCount,manualData:manual,manualApplied,
  radar:values.some(value=>value!==null)?{values,notes:noteCount??0}:chart.radar};
}
export function parseManualChart(bpmMin:string,bpmMax:string,notes:string,radar:string[]):ManualChartData{
 const read=(text:string)=>{if(!/^\d+(?:\.\d+)?$/.test(text.trim()))throw new Error('数値を正しく入力してください。');return Number(text);};
 const value:ManualChartData={updatedAt:new Date().toISOString()};
 if(bpmMin.trim()||bpmMax.trim()){
  const min=read(bpmMin),max=bpmMax.trim()?read(bpmMax):min;
  if(!Number.isInteger(min)||!Number.isInteger(max))throw new Error('丸めBPMは整数で入力してください。');
  value.bpm=min===max?String(min):`${min}-${max}`;
 }
 if(notes.trim())value.noteCount=read(notes);
 if(radar.some(v=>v.trim()))value.radarValues=radar.map(v=>v.trim()?read(v):null) as RadarValues;
 const parsed=manualChartSchema.safeParse(value);
 if(!parsed.success)throw new Error('BPMは1〜100000（下限≦上限）、ノーツ数は1〜100000の整数、レーダーは0〜200で入力してください。');
 return parsed.data;
}
