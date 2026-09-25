import {z} from 'zod';
import {difficulties,seriesNames,songs as sampleSongs,charts as sampleCharts,type AppState,type Catalog,type Chart,type Song,type Mode} from './iidx-data';
import {additionalFiles,enrichCatalog} from './iidx-additional';
import {collectPlayHistory} from './play-data';
import {preserveImportedCatalog,stripSupplement,applySavedSupplement} from './catalog-import';

export const CATALOG_SOURCE_URL='https://chinimuruhi.github.io/IIDX-Data-Table/';
const sourceId=z.string().regex(/^\d{1,12}$/);
const speed=z.number().finite().min(0).max(100000);
const speedRange=z.union([speed,z.tuple([speed,speed]).refine(v=>v[0]<=v[1])]);
const bpmSchema=z.union([speedRange,z.object({sp:z.array(speedRange).length(5),dp:z.array(speedRange).length(5)})]);
const titleSchema=z.record(sourceId,z.string().min(1).max(512));
const infoSchema=z.record(sourceId,z.object({artist:z.string().max(1024),version:z.number().int().min(-1).max(999)}));
const noteCounts=z.array(z.number().int().min(0).max(100000)).length(5);
const chartSchema=z.record(sourceId,z.object({bpm:bpmSchema,in_ac:z.boolean(),in_inf:z.boolean(),level:z.object({sp:z.array(z.number().int().min(0).max(12)).length(5),dp:z.array(z.number().int().min(0).max(12)).length(5)}),notes:z.object({sp:noteCounts,dp:noteCounts}).optional()}));
const versionSchema=z.array(z.string().min(1).max(100)).min(3).max(1000);

import {canonicalChartId,canonicalSongId} from './iidx-ids';
export {legacySongIds,canonicalChartId,canonicalSongId} from './iidx-ids';
const versionNumber=(value:number)=>value===0?1:value===1?1.5:value;
const fallbackVersions:Record<number,string>={...seriesNames,[-1]:'CS / その他',[1.5]:'substream',28:'BISTROVER',29:'CastHour',30:'RESIDENT',31:'EPOLIS',32:'Pinky Crush',33:'Sparkle Shower',34:'ZINRAI'};

function chartSpeed(bpm:z.infer<typeof bpmSchema>,mode:Mode,index:number){
 const v=typeof bpm==='object'&&!Array.isArray(bpm)?bpm[mode==='SP'?'sp':'dp'][index]:bpm;
 const [low,high]=typeof v==='number'?[v,v]:v;
 return {bpm:low===0&&high===0?'—':low===high?String(low):`${low}–${high}`,soflan:low>0&&high>low};
}

export function parseCatalog(payload:{titles:unknown;info:unknown;charts:unknown;versions:unknown},sourceUpdatedAt:string|null=null):Catalog{
 const t=titleSchema.safeParse(payload.titles),i=infoSchema.safeParse(payload.info),c=chartSchema.safeParse(payload.charts),v=versionSchema.safeParse(payload.versions);
 if(!t.success||!i.success||!c.success||!v.success)throw new Error('配信データの形式を読み取れませんでした。現在のDBは変更していません。');
 const ids=Object.keys(t.data);
 if(!ids.length||ids.length!==Object.keys(i.data).length||ids.length!==Object.keys(c.data).length||ids.some(id=>!i.data[id]||!c.data[id]))throw new Error('配信中のデータに不整合があります。少し待ってから再度更新してください。');
 const names={...fallbackVersions};v.data.forEach((name,index)=>{names[versionNumber(index)]=name;});
 const songs:Song[]=[],charts:Chart[]=[];
 for(const rawId of ids.sort((a,b)=>Number(a)-Number(b))){
  const songId=`idt-${rawId}`,info=i.data[rawId],data=c.data[rawId],songCharts:Chart[]=[];
  for(const mode of ['SP','DP'] as Mode[])for(let index=0;index<5;index++){
   const level=data.level[mode==='SP'?'sp':'dp'][index];if(level===0)continue;
   const difficulty=difficulties[index],tempo=chartSpeed(data.bpm,mode,index);
   const noteCount=data.notes?.[mode==='SP'?'sp':'dp'][index]||null;
   songCharts.push({id:`${songId}:${mode}:${difficulty}`,songId,mode,difficulty,level,...tempo,noteCount,unofficialRatings:{}});
  }
  const series=versionNumber(info.version);names[series]??=`シリーズ ${series}`;
  songs.push({id:songId,series,title:t.data[rawId],artist:info.artist||'不明',bpm:songCharts[0]?.bpm??'—',soflan:songCharts.some(x=>x.soflan),removed:!data.in_ac});
  charts.push(...songCharts);
 }
 if(!charts.some(c=>c.mode==='SP')||!charts.some(c=>c.mode==='DP'))throw new Error('譜面情報が不足しているため更新を中止しました。');
 return {schemaVersion:1,source:'iidx-data-table',fetchedAt:new Date().toISOString(),sourceUpdatedAt,seriesNames:names,songs,charts};
}

export async function fetchCatalog(onProgress:(completed:number,total:number)=>void=()=>{},fetcher:typeof fetch=fetch):Promise<Catalog>{
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),45000);
 const files=['textage/title.json','textage/song-info.json','textage/chart-info.json','textage/version.json',...additionalFiles];let completed=0;
 try{
  const responses=await Promise.all(files.map(async file=>{
   const r=await fetcher(`${CATALOG_SOURCE_URL}${file}`,{mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',cache:'no-cache',signal:controller.signal});
   if(!r.ok)throw new Error(`配信元からデータを取得できませんでした（HTTP ${r.status}）。`);
   const text=await r.text();if(text.length>12_000_000)throw new Error('配信データの容量が想定範囲を超えています。');
   let json:unknown;try{json=JSON.parse(text);}catch{throw new Error('配信データがJSON形式ではありません。');}
   onProgress(++completed,files.length);return {json,modified:r.headers.get('Last-Modified')};
  }));
  const dates=responses.map(r=>r.modified?Date.parse(r.modified):NaN).filter(Number.isFinite);
  const result=parseCatalog({titles:responses[0].json,info:responses[1].json,charts:responses[2].json,versions:responses[3].json},dates.length?new Date(Math.max(...dates)).toISOString():null);
  if(result.songs.length<1000)throw new Error('配信データの件数が少なすぎるため、更新を中止しました。');
  return enrichCatalog(result,responses.slice(4).map(r=>r.json));
 }catch(e){
  const timedOut=controller.signal.aborted;controller.abort();
  if(timedOut)throw new Error('取得が時間内に完了しませんでした。通信を確認して再度お試しください。');
  if(e instanceof TypeError)throw new Error('配信元に接続できませんでした。通信を確認して再度お試しください。');
  throw e;
 }finally{clearTimeout(timeout);}
}

export function migrateLegacyState(state:AppState,catalog:Catalog):{state:AppState;moved:number;conflicts:number}{
 const songIds=new Set(catalog.songs.map(s=>s.id)),notes={...state.notes};let moved=0,conflicts=0;
 for(const [key,note] of Object.entries(state.notes)){
  const next=canonicalChartId(key);if(next===key||!songIds.has(next.split(':')[0]))continue;
  if(notes[next]&&JSON.stringify(notes[next])!==JSON.stringify(note)){conflicts++;continue;}
  notes[next]=note;delete notes[key];moved++;
 }
 const manualCharts={...state.manualCharts};
 for(const [id,value] of Object.entries(manualCharts)){const next=canonicalChartId(id);if(next!==id&&songIds.has(next.split(':')[0])&&!manualCharts[next]){manualCharts[next]=value;delete manualCharts[id];}}
 const folders=state.folders.map(f=>({...f,songIds:Array.from(new Set(f.songIds.map(id=>songIds.has(canonicalSongId(id))?canonicalSongId(id):id)))}));
 const records={...state.playData?.records};
 for(const [key,score] of Object.entries(records)){const next=canonicalChartId(key);if(next===key||!songIds.has(next.split(':')[0]))continue;if(records[next]&&JSON.stringify(records[next])!==JSON.stringify(score)){conflicts++;continue;}records[next]=score;delete records[key];}
 const history=collectPlayHistory(state.playData);
 for(const [key,scores] of Object.entries(history)){
  const next=canonicalChartId(key);if(next===key||!songIds.has(next.split(':')[0]))continue;
  const target={...history[next]},remaining:typeof scores={};
  for(const [version,score] of Object.entries(scores)){
   if(target[version]&&JSON.stringify(target[version])!==JSON.stringify(score)){remaining[version]=score;conflicts++;}
   else target[version]=score;
  }
  history[next]=target;if(Object.keys(remaining).length)history[key]=remaining;else delete history[key];
 }
 return {state:{...state,notes,folders,...(state.manualCharts?{manualCharts}:{}),...(state.playData?{playData:{...state.playData,records,history}}:{})},moved,conflicts};
}

export function mergeCatalog(previous:Catalog|null,incoming:Catalog,state:AppState){
 const supplementData=incoming.supplementData??previous?.supplementData;
 previous=stripSupplement(previous);incoming=stripSupplement(incoming)!;
 incoming=preserveImportedCatalog(previous,incoming);
 const songs=new Map(incoming.songs.map(s=>[s.id,s])),charts=new Map(incoming.charts.map(c=>[c.id,c]));
 const oldSongs=previous?.songs??sampleSongs,oldCharts=previous?.charts??sampleCharts;
 for(const s of oldSongs){const id=canonicalSongId(s.id);if(!songs.has(id)&&(previous||state.folders.some(f=>f.songIds.includes(s.id))||[...Object.keys(state.notes),...Object.keys(state.manualCharts??{}),...Object.keys(state.playData?.records??{}),...Object.keys(state.playData?.history??{})].some(k=>k.startsWith(`${s.id}:`)||k.startsWith(`${id}:`))))songs.set(id,{...s,id,retained:s.importedInfo?s.retained:true});}
 for(const c of oldCharts){
  const id=canonicalChartId(c.id),songId=canonicalSongId(c.songId);
  if(!charts.has(id)&&songs.has(songId)&&(previous||state.manualCharts?.[c.id]||state.manualCharts?.[id]||state.playData?.records[c.id]||state.playData?.records[id]||state.playData?.history?.[c.id]||state.playData?.history?.[id]||Object.keys(state.notes).some(key=>key===c.id||key.startsWith(`${c.id}:`)||key===id||key.startsWith(`${id}:`))))charts.set(id,{...c,id,songId,retained:c.importedInfo?c.retained:true});
 }
 const catalog:Catalog=applySavedSupplement({...incoming,supplementData,seriesNames:{...previous?.seriesNames,...incoming.seriesNames},songs:Array.from(songs.values()),charts:Array.from(charts.values())});
 const oldSongIds=new Set((previous?.songs??[]).map(s=>s.id)),oldChartIds=new Set((previous?.charts??[]).map(c=>c.id));
 return {catalog,addedSongs:incoming.songs.filter(s=>!oldSongIds.has(s.id)).length,addedCharts:incoming.charts.filter(c=>!oldChartIds.has(c.id)).length,retainedCharts:catalog.charts.filter(c=>c.retained).length};
}

export function isStoredCatalog(value:unknown):value is Catalog{
 if(!value||typeof value!=='object')return false;
 const c=value as Catalog;
 return c.schemaVersion===1&&(c.source==='iidx-data-table'||c.source==='iidx-info-exporter')&&typeof c.fetchedAt==='string'&&!!c.seriesNames&&Array.isArray(c.songs)&&c.songs.length>0&&Array.isArray(c.charts)&&c.charts.length>0&&c.songs.every(s=>typeof s.id==='string'&&typeof s.title==='string')&&c.charts.every(x=>typeof x.id==='string'&&typeof x.songId==='string');
}
