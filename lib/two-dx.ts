import {type Chart} from './iidx-data';
import {type ClearLamp,type PlayScore} from './play-data';
import {getScoreRate} from './play-rate';
import {djLevelForScore} from './play-edit';

export const twoDxLamps:Record<ClearLamp,{key:string;color:string}>={
 'NO PLAY':{key:'none',color:'#656573'},
 FAILED:{key:'failed',color:'#90202D'},
 'ASSIST CLEAR':{key:'assist',color:'#B86CFF'},
 'EASY CLEAR':{key:'easy',color:'#69E878'},
 CLEAR:{key:'clear',color:'#66D9FF'},
 'HARD CLEAR':{key:'hard',color:'#F5F7FF'},
 'EX HARD CLEAR':{key:'ex',color:'#FFE24A'},
 'FULLCOMBO CLEAR':{key:'fc',color:'#FFE24A'},
};
export const twoDxBoundaries=[['AAA',8],['AA',7],['A',6],['B',5],['C',4],['D',3],['E',2]] as const;
export const twoDxBoundaryLeft=(step:number)=>(1-step/9)*100;
export const twoDxRadarText=(value:number|null|undefined)=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=200?value.toFixed(2):'—';
export function twoDxScore(score:PlayScore|undefined,chart:Chart){
 const rate=getScoreRate(score,chart.noteCount);
 const hasScore=!!score&&score.exScore!==null&&(score.exScore>0||score.djLevel!==null);
 return {
  lamp:score?.lamp??'NO PLAY',
  grade:score?.djLevel??(rate.percent!==null?djLevelForScore(score?.exScore??null,chart.noteCount):null),
  rate:rate.percent,
  rateText:rate.percent===null?'—':`${rate.percent.toFixed(2)}%`,
  scoreText:hasScore?score!.exScore!.toLocaleString('ja-JP'):'—',
 };
}
