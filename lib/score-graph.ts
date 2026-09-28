import {z} from 'zod';
import {type PlayScore} from './play-data';
import {getScoreRate} from './play-rate';

export const defaultScoreGraphColors=()=>({current:'#39adff',past:'#839ab4'});
export type ScoreGraphColors=ReturnType<typeof defaultScoreGraphColors>;
export const scoreGraphColorsSchema=z.object({current:z.string().regex(/^#[0-9a-fA-F]{6}$/),past:z.string().regex(/^#[0-9a-fA-F]{6}$/)});

export function buildScoreGraph(scores:Record<string,PlayScore>|undefined,versions:number[],unknown:boolean,noteCount:number|null|undefined){
 const currentVersion=versions.length?Math.max(...versions):null;
 const maxExScore=getScoreRate(undefined,noteCount).maxExScore;
 const keys=[...(unknown?['unknown']:[]),...[...new Set(versions)].sort((a,b)=>a-b).map(String)];
 const rows=keys.map(key=>{
  const score=scores?.[key];
  const ex=score?.exScore;
  const hasScore=typeof ex==='number'&&Number.isSafeInteger(ex)&&ex>=0&&!(ex===0&&score?.djLevel===null);
  const invalid=hasScore&&maxExScore!==null&&ex!>maxExScore;
  const value=hasScore&&!invalid?ex!:null;
  return {key,version:key==='unknown'?null:Number(key),score,value,invalid,current:currentVersion!==null&&key===String(currentVersion),rate:getScoreRate(score,noteCount)};
 });
 const values=rows.flatMap(r=>r.value===null?[]:[r.value]);
 const best=values.length?Math.max(...values):null;
 const current=rows.find(r=>r.current);
 // Unknown-series records have no chronological relationship to the current series.
 const past=rows.filter(r=>r.version!==null&&!r.current&&r.value!==null).map(r=>r.value!);
 const delta=current?.value!==null&&current?.value!==undefined&&past.length?current.value-Math.max(...past):null;
 const ceiling=maxExScore??Math.max(1,...values);
 return {rows,currentVersion,current,best,delta,maxExScore,ceiling};
}
