import {type PlayScore} from './play-data';

export type ScoreBenchmark={label:string;difference:number};
const rankSteps=[['F',0],['E',2],['D',3],['C',4],['B',5],['A',6],['AA',7],['AAA',8],['MAX',9]] as const;
function scoreBenchmarks(exScore:number,maxExScore:number):ScoreBenchmark[]{
 // An integer EX score must reach the ceiling of each ninth-based boundary.
 const points=rankSteps.map(([label,step])=>({label,point:Math.ceil(maxExScore*step/9)}));
 const next=points.findIndex(p=>p.point>exScore);
 const references=next<0?[points[points.length-1]]:[points[next-1],points[next]];
 return references.map(p=>({label:p.label,difference:exScore-p.point}));
}
export const formatScoreBenchmark=({label,difference}:ScoreBenchmark)=>label==='MAX'&&difference===0?'MAX':`${label}${difference>=0?'+':''}${difference.toLocaleString()}`;

// Derived from this exact chart; catalog updates never change the imported EX
// score. Legacy catalogs have no noteCount until a DB update.
export function getScoreRate(score:PlayScore|undefined,noteCount:number|null|undefined){
 const empty:ScoreBenchmark[]=[];
 const notes=typeof noteCount==='number'&&Number.isSafeInteger(noteCount)&&noteCount>0&&noteCount<=100000?noteCount:null;
 if(notes===null)return {notes,maxExScore:null,percent:null,benchmarks:empty,reason:'missing-notes'} as const;
 const maxExScore=notes*2;
 if(!score||score.exScore===null||(score.exScore===0&&score.djLevel===null))return {notes,maxExScore,percent:null,benchmarks:empty,reason:'missing-score'} as const;
 if(!Number.isSafeInteger(score.exScore)||score.exScore<0||score.exScore>maxExScore)return {notes,maxExScore,percent:null,benchmarks:empty,reason:'invalid-score'} as const;
 return {notes,maxExScore,percent:score.exScore/maxExScore*100,benchmarks:scoreBenchmarks(score.exScore,maxExScore),reason:null} as const;
}
