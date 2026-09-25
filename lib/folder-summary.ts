import {type Chart} from './iidx-data';
import {type PlayScore,type ClearLamp} from './play-data';
import {getScoreRate} from './play-rate';

export type FolderSummaryMode='none'|'dj'|'clear'|'both';
export type FolderDjLevel=NonNullable<PlayScore['djLevel']>|'no-score'|'missing'|'unknown';
export type FolderClearType=ClearLamp|'missing';
export type FolderSummary={dj:Record<FolderDjLevel,number>;clear:Record<FolderClearType,number>};
type SummaryColumn<K extends string>={key:K;label:string;title:string;tone:string};
export const djColumns:SummaryColumn<FolderDjLevel>[]=[
 ...(['AAA','AA','A','B','C','D','E','F'] as const).map(key=>({key,label:key,title:key,tone:key==='AAA'||key==='AA'?'gold':key==='A'||key==='B'?'blue':'purple'})),
 {key:'no-score',label:'無',title:'スコアなし',tone:'muted'},
 {key:'missing',label:'未',title:'未取得',tone:'muted'},
 {key:'unknown',label:'不明',title:'スコアあり・DJ LEVEL不明',tone:'muted'},
];
export const clearColumns:SummaryColumn<FolderClearType>[]=[
 {key:'FULLCOMBO CLEAR',label:'FC',title:'FULL COMBO',tone:'teal'},
 {key:'EX HARD CLEAR',label:'EXH',title:'EX HARD',tone:'gold'},
 {key:'HARD CLEAR',label:'H',title:'HARD',tone:'hard'},
 {key:'CLEAR',label:'C',title:'CLEAR',tone:'blue'},
 {key:'EASY CLEAR',label:'E',title:'EASY',tone:'green'},
 {key:'ASSIST CLEAR',label:'AS',title:'ASSIST',tone:'purple'},
 {key:'FAILED',label:'F',title:'FAILED',tone:'failed'},
 {key:'NO PLAY',label:'NP',title:'未プレー',tone:'muted'},
 {key:'missing',label:'未',title:'未取得',tone:'muted'},
];
export function emptyFolderSummary():FolderSummary{
 return {dj:Object.fromEntries(djColumns.map(c=>[c.key,0])) as FolderSummary['dj'],clear:Object.fromEntries(clearColumns.map(c=>[c.key,0])) as FolderSummary['clear']};
}
export function folderDjLevel(chart:Chart,score:PlayScore|undefined):FolderDjLevel{
 if(!score)return 'missing';
 if(score.exScore===null||score.exScore===0)return 'no-score';
 if(score.djLevel)return score.djLevel;
 const rate=getScoreRate(score,chart.noteCount),rank=rate.benchmarks[0]?.label;
 if(rate.reason!==null||!rank)return 'unknown';
 return rank==='MAX'?'AAA':rank as NonNullable<PlayScore['djLevel']>;
}
