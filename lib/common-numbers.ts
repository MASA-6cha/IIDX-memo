import {z} from 'zod';
import {blankNote,commonDisplay,hasLegacyDisplayConflict,type AppState,type Chart,type Song,type Side,type Note,type NumberSettings,type NumberProfile} from './iidx-data';
import {canonicalChartId} from './iidx-ids';
export const numberFields=['green','whiteTop','whiteBottom'] as const;
export const numberLabels={green:'緑数字',whiteTop:'白数字 SUD+',whiteBottom:'白数字 LIFT'};
export const profileLabels={'SP:1P':'SP 1P','SP:2P':'SP 2P',DP:'DP共通'};
export const blankNumbers=():NumberSettings=>({green:'',whiteTop:'',whiteBottom:''});
const numberText=(min:number,max:number)=>z.string().refine(v=>v===''||(/^\d+$/.test(v)&&Number(v)>=min&&Number(v)<=max));
export const numbersSchema=z.object({green:numberText(1,9999),whiteTop:numberText(0,1000),whiteBottom:numberText(0,1000)}).strict();
export const commonNumbersSchema=z.object({'SP:1P':numbersSchema.optional(),'SP:2P':numbersSchema.optional(),DP:numbersSchema.optional()}).strict();
export const numberProfile=(chart:Chart,side:Side):NumberProfile=>chart.mode==='DP'?'DP':`SP:${side}`;
export function chartCommonNumbers(state:AppState,chart:Chart,song:Song,side:Side):NumberSettings|undefined{
 return (chart.soflan??song.soflan)?undefined:state.commonNumbers?.[numberProfile(chart,side)];
}
export function effectiveNumberNote(note:Note|undefined,defaults:NumberSettings|undefined,mode:'SP'|'DP',side:Side):Note|undefined{
 if(!defaults||!numberFields.some(field=>defaults[field]!==''))return note;
 const n=note??blankNote();if(mode==='DP'&&hasLegacyDisplayConflict(n))return note;
 const display=mode==='DP'?commonDisplay(n):side==='1P'?n.left:n.right;
 const values={...display,...Object.fromEntries(numberFields.map(field=>[field,display[field]!==''?display[field]:defaults[field]]))};
 return mode==='DP'?{...n,display:values}:{...n,[side==='1P'?'left':'right']:values};
}
export type NumberAction={type:'save';profile:NumberProfile;values:NumberSettings;alignExisting:boolean}|{type:'shift';profile:NumberProfile;field:keyof NumberSettings;delta:number};
export function applyNumberAction(state:AppState,charts:Chart[],songs:Song[],action:NumberAction){
 const originals=state.commonNumbers?.[action.profile]??blankNumbers();
 if(action.type==='save'&&!numbersSchema.safeParse(action.values).success)throw new Error('緑数字は1〜9999、白数字は0〜1000の整数で入力してください（空欄可）。');
 const values=action.type==='save'?{...action.values}:{...originals};
 const move=(value:string,field:keyof NumberSettings)=>{
  if(value==='')return value;
  const next=Number(value)+(action.type==='shift'?action.delta:0),min=field==='green'?1:0,max=field==='green'?9999:1000;
  if(!Number.isInteger(next)||next<min||next>max)throw new Error(`${numberLabels[field]}が範囲外になるため変更しません（${min}〜${max}）。`);
  return String(next);
 };
 if(action.type==='shift'){
  if(!Number.isInteger(action.delta)||!action.delta||Math.abs(action.delta)>1000)throw new Error('調整量は0以外の整数（±1000以内）で指定してください。');
  values[action.field]=move(values[action.field],action.field);
 }
 const songMap=new Map(songs.map(song=>[song.id,song]));
 const chartMap=new Map(charts.map(chart=>[canonicalChartId(chart.id),chart]));
 const notes={...state.notes};let changedNotes=0,excludedNotes=0;
 if(action.type==='shift'||action.alignExisting)for(const [key,note] of Object.entries(notes)){
  const parts=key.split(':'),mode=parts[1],side=mode==='SP'?parts[3] as Side:'1P';
  if((mode==='DP'?'DP':`${mode}:${side}`)!==action.profile)continue;
  const chart=chartMap.get(canonicalChartId(parts.slice(0,3).join(':'))),song=chart&&songMap.get(chart.songId);
  if(!chart||!song||(chart.soflan??song.soflan)||(mode==='DP'&&hasLegacyDisplayConflict(note))){excludedNotes++;continue;}
  const display=mode==='DP'?commonDisplay(note):side==='1P'?note.left:note.right;
  const updated={...display};
  if(action.type==='save')for(const field of numberFields)updated[field]='';
  else updated[action.field]=move(display[action.field],action.field);
  if(numberFields.every(field=>updated[field]===display[field]))continue;
  notes[key]={...note,...(mode==='DP'?{display:updated}:{[side==='1P'?'left':'right']:updated}),updatedAt:new Date().toISOString()};changedNotes++;
 }
 if(action.type==='shift'&&values[action.field]===originals[action.field]&&!changedNotes)throw new Error('調整できる保存済みの数値がありません。先に共通値を保存してください。');
 return {state:{...state,commonNumbers:{...state.commonNumbers,[action.profile]:values},notes},changedNotes,excludedNotes};
}
