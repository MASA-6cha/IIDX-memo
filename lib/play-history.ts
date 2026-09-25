import {type PlayHistory,type PlayScore} from './play-data';

export type ScoreSource='latest'|'best'|'unknown'|`version:${number}`;
export type DisplayPlayScore=PlayScore&{best?:boolean;scoreVersion?:number|null;lampVersion?:number|null;lampFetchedAt?:string};
export const scoreSeriesLabel=(version:number|null)=>version===null?'シリーズ不明':`#${version}`;
export function storedPlayVersions(history:PlayHistory){
 const versions=new Set<number>();let unknown=false;
 for(const scores of Object.values(history))for(const score of Object.values(scores)){
  if(score.gameVersion===null)unknown=true;else versions.add(score.gameVersion);
 }
 return {versions:[...versions].sort((a,b)=>b-a),unknown};
}
export function chartPlayHistory(history:PlayHistory,id:string):PlayScore[]{
 return Object.values(history[id]??{}).sort((a,b)=>(b.gameVersion??-1)-(a.gameVersion??-1)||Date.parse(b.fetchedAt)-Date.parse(a.fetchedAt));
}
export function bestPlayScore(scores:PlayScore[]):DisplayPlayScore|undefined{
 if(!scores.length)return undefined;
 // One pass over saved series, without sorting. EX/DJ stay on one record.
 const newer=(a:PlayScore,b:PlayScore)=>(a.gameVersion??-1)>(b.gameVersion??-1)||(a.gameVersion===b.gameVersion&&Date.parse(a.fetchedAt)>Date.parse(b.fetchedAt));
 let score=scores[0],clear=scores[0];
 for(let i=1;i<scores.length;i++){
  const current=scores[i],ex=current.exScore??-1,best=score.exScore??-1;
  if(ex>best||(ex===best&&newer(current,score)))score=current;
  if(newer(current,clear))clear=current;
 }
 // Clear status carries over between releases; use the newest saved series.
 const {manual:originalManual,...base}=score;
 const manual={...(originalManual?.score?{score:originalManual.score}:{}),...(clear.manual?.lamp?{lamp:clear.manual.lamp}:{})};
 return {...base,lamp:clear.lamp,best:true,scoreVersion:score.gameVersion,lampVersion:clear.gameVersion,lampFetchedAt:clear.fetchedAt,...(Object.keys(manual).length?{manual}:{})};
}
export function resolvePlayRecords(history:PlayHistory,source:ScoreSource):Record<string,DisplayPlayScore>{
 const latest=source==='latest'?storedPlayVersions(history).versions[0]:undefined;
 const key=source==='latest'?(latest===undefined?'unknown':String(latest)):source.startsWith('version:')?source.slice(8):source;
 const records:Record<string,DisplayPlayScore>={};
 for(const [id,scores] of Object.entries(history)){
  const score=source==='best'?bestPlayScore(Object.values(scores)):scores[key];
  if(score)records[id]=score;
 }
 return records;
}
export function scoreSourceLabel(source:ScoreSource,history:PlayHistory,seriesNames:Record<number,string>={}){
 if(source==='best')return '歴代最高';
 if(source==='unknown')return 'シリーズ不明';
 const version=source==='latest'?storedPlayVersions(history).versions[0]:Number(source.slice(8));
 if(version===undefined)return '最新の保存シリーズ';
 return `${source==='latest'?'最新：':''}#${version}${seriesNames[version]?` ${seriesNames[version]}`:''}`;
}
