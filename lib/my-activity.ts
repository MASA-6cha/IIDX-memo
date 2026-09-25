import {type Chart,type Song,type Mode} from './iidx-data';
import {chartAvailability} from './iidx-view';
import {lamps,type PlayScore} from './play-data';

export const djLevels=['AAA','AA','A','B','C','D','E','F','記録なし'] as const;
export type RadarContribution={chart:Chart;value:number;radar:number;percent:number;version:number|null;manual:boolean};

// Truncate the decimal radar value as an exact ratio, not a floating-point
// rate product (which can turn an exact 32.80 into 32.79999999999999).
function contributionHundredths(exScore:number,notes:number,radar:number){
 const [mantissa,exponent='0']=String(radar).split('e'),[whole,fraction='']=mantissa.split('.');
 const digits=whole+fraction,power=Number(exponent)-fraction.length+2;
 const numerator=exScore*Number(digits)*10**Math.max(0,power),denominator=notes*2*10**Math.max(0,-power);
 if(Number.isSafeInteger(numerator)&&Number.isSafeInteger(denominator)){
  const quotient=Math.floor(numerator/denominator),product=quotient*denominator;
  if(Number.isSafeInteger(product))return product>numerator?quotient-1:quotient;
 }
 // Unusually precise / scientific-notation source values use exact integers too.
 return Number(BigInt(exScore)*BigInt(digits)*BigInt(10)**BigInt(Math.max(0,power))/(BigInt(notes*2)*BigInt(10)**BigInt(Math.max(0,-power))));
}

export function calculateActivity(charts:Chart[],songs:Song[],records:Record<string,PlayScore>,mode:Mode,scope:'available'|'all'){
 const songMap=new Map(songs.map(song=>[song.id,song]));
 const dj=Object.fromEntries(djLevels.map(rank=>[rank,0])) as Record<typeof djLevels[number],number>;
 const clear=Object.fromEntries(lamps.map(lamp=>[lamp,0])) as Record<typeof lamps[number],number>;
 const djCharts=Object.fromEntries(djLevels.map(rank=>[rank,[] as Chart[]])) as Record<typeof djLevels[number],Chart[]>;
 const clearCharts=Object.fromEntries(lamps.map(lamp=>[lamp,[] as Chart[]])) as Record<typeof lamps[number],Chart[]>;
 const bySong=Array.from({length:6},()=>new Map<string,RadarContribution>());
 let total=0,recorded=0,manual=0,missing=0,missingNotes=0,missingRadar=0,invalidScores=0;
 for(const chart of charts){
  const song=songMap.get(chart.songId);
  if(chart.mode!==mode||!song||(scope==='available'&&(chartAvailability(chart,song)!=='included'||song.retained||chart.retained)))continue;
  total++;
  const score=records[chart.id];
  dj[score?.djLevel??'記録なし']++;clear[score?.lamp??'NO PLAY']++;
  djCharts[score?.djLevel??'記録なし'].push(chart);clearCharts[score?.lamp??'NO PLAY'].push(chart);
  if(!score){missing++;continue;}
  recorded++;if(score.manual?.score||score.manual?.lamp)manual++;
  if(score.exScore===null||(score.exScore===0&&score.djLevel===null))continue;
  const notes=chart.noteCount;
  if(!notes||!Number.isSafeInteger(notes)||notes<1||notes>100000){missingNotes++;continue;}
  if(!Number.isSafeInteger(score.exScore)||score.exScore<0||score.exScore>notes*2){invalidScores++;continue;}
  const rate=score.exScore/(notes*2);
  if(!chart.radar||chart.radar.values.some(value=>value===null))missingRadar++;
  for(let i=0;i<6;i++){
   const radar=chart.radar?.values[i];
   if(typeof radar!=='number'||!Number.isFinite(radar)||radar<=0||radar>200)continue;
   const value=contributionHundredths(score.exScore,notes,radar)/100,previous=bySong[i].get(chart.songId);
   if(!previous||value>previous.value||(value===previous.value&&chart.id<previous.chart.id))bySong[i].set(chart.songId,{chart,value,radar,percent:rate*100,version:score.gameVersion,manual:!!score.manual?.score});
  }
 }
 // Only ten entries per axis are kept sorted; never sort the full chart library.
 const axes=bySong.map(candidates=>{
  const top:RadarContribution[]=[];
  for(const candidate of candidates.values()){
   const index=top.findIndex(item=>candidate.value>item.value||(candidate.value===item.value&&candidate.chart.id<item.chart.id));
   if(index>=0)top.splice(index,0,candidate);else if(top.length<10)top.push(candidate);
   if(top.length>10)top.pop();
  }
  // Sum the already-truncated hundredths as integers, divide by ten songs,
  // and truncate again. Missing songs still count as zero.
  const sumHundredths=top.reduce((sum,item)=>sum+Math.round(item.value*100),0);
  return {value:Math.floor(sumHundredths/10)/100,top,candidates:candidates.size};
 });
 const radarTotal=axes.reduce((sum,axis)=>sum+Math.round(axis.value*100),0)/100;
 return {total,recorded,manual,missing,missingNotes,missingRadar,invalidScores,dj,clear,djCharts,clearCharts,axes,radarTotal};
}
