import {type AppState,type Chart} from './iidx-data';
import {collectPlayHistory,playVersionKey,playScoreSchema,type PlayScore,type PlayHistory,type ClearLamp} from './play-data';

export type ManualPlayInput={gameVersion:number|null;exScore?:number|null;lamp?:ClearLamp};
export const manualScoreLabel=(score:PlayScore)=>[score.manual?.score?'EX':'',score.manual?.lamp?'クリア':''].filter(Boolean).join('・');

export function djLevelForScore(exScore:number|null,notes:number|null|undefined):PlayScore['djLevel']{
 if(exScore===null||!Number.isSafeInteger(notes)||!notes||notes<1||!Number.isSafeInteger(exScore)||exScore<0||exScore>notes*2)return null;
 const max=notes*2;
 for(const [rank,step] of [['AAA',8],['AA',7],['A',6],['B',5],['C',4],['D',3],['E',2]] as const)if(exScore>=Math.ceil(max*step/9))return rank;
 return 'F';
}

export function applyManualPlay(state:AppState,chart:Chart,input:ManualPlayInput,now=new Date().toISOString()):AppState{
 if(input.gameVersion!==null&&(!Number.isInteger(input.gameVersion)||input.gameVersion<1||input.gameVersion>999))throw new Error('保存先シリーズを選んでください。');
 const changesScore=Object.hasOwn(input,'exScore'),changesLamp=Object.hasOwn(input,'lamp');
 if(!changesScore&&!changesLamp)throw new Error('更新する項目を選んでください。');
 const max=chart.noteCount&&Number.isSafeInteger(chart.noteCount)?chart.noteCount*2:200000;
 if(changesScore&&input.exScore!==null&&(!Number.isSafeInteger(input.exScore)||input.exScore!<0||input.exScore!>max))throw new Error(`EXスコアは0〜${max.toLocaleString()}の整数で入力してください。`);
 const history=collectPlayHistory(state.playData),key=playVersionKey(input.gameVersion),previous=history[chart.id]?.[key];
 const base:PlayScore=previous??{gameVersion:input.gameVersion,exScore:null,pgreat:null,great:null,missCount:null,lamp:'NO PLAY',djLevel:null,fetchedAt:now,importedAt:now};
 const score=playScoreSchema.parse({...base,importedAt:now,
  ...(changesScore?{exScore:input.exScore,pgreat:null,great:null,missCount:null,djLevel:djLevelForScore(input.exScore!,chart.noteCount)}:{}),
  ...(changesLamp?{lamp:input.lamp}:{}),
  manual:{...base.manual,...(changesScore?{score:now}:{}),...(changesLamp?{lamp:now}:{})},
 });
 history[chart.id]={...history[chart.id],[key]:score};
 return {...state,playData:{records:{...state.playData?.records,[chart.id]:score},imports:{...state.playData?.imports},history}};
}

export function playSeriesCounts(history:PlayHistory){
 const counts=new Map<string,{key:string;version:number|null;SP:number;DP:number;manual:number}>();
 for(const [id,scores] of Object.entries(history))for(const [key,score] of Object.entries(scores)){
  const entry=counts.get(key)??{key,version:score.gameVersion,SP:0,DP:0,manual:0};
  if(id.includes(':SP:'))entry.SP++;else if(id.includes(':DP:'))entry.DP++;
  if(score.manual?.score||score.manual?.lamp)entry.manual++;
  counts.set(key,entry);
 }
 return [...counts.values()].sort((a,b)=>(b.version??-1)-(a.version??-1));
}

export function deletePlaySeries(state:AppState,version:number|null):AppState{
 const key=playVersionKey(version),history=collectPlayHistory(state.playData),records:Record<string,PlayScore>={};
 for(const [id,scores] of Object.entries(history)){
  delete scores[key];
  const remaining=Object.values(scores);
  if(!remaining.length){delete history[id];continue;}
  // Rebuild the compatibility cache so a deleted legacy record cannot reappear.
  records[id]=remaining.reduce((latest,score)=>Date.parse(score.importedAt)>Date.parse(latest.importedAt)?score:latest);
 }
 const imports={...state.playData?.imports};
 for(const mode of ['SP','DP'] as const)if(imports[mode]?.gameVersion===version||imports[mode]?.gameVersion===null)delete imports[mode];
 return {...state,playData:{records,history,imports}};
}
