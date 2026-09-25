import {z} from 'zod';
import {commonNumbersSchema} from './common-numbers';
import {manualChartsSchema} from './manual-chart';
import {styles, covers, type AppState} from './iidx-data';
import {playDataSchema,collectPlayHistory} from './play-data';

const numericText=(min:number,max:number)=>z.string().refine(v=>v===''||(/^\d+$/.test(v)&&Number(v)>=min&&Number(v)<=max));
const displaySchema=z.object({
 cover:z.string().refine(v=>covers.includes(v)),
 whiteTop:numericText(0,1000),whiteBottom:numericText(0,1000),green:numericText(1,9999),
}).strict();
const sideSchema=displaySchema.extend({
 style:z.string().refine(v=>styles.includes(v)),comment:z.string().max(2000),autoScratch:z.boolean(),legacyNote:z.boolean(),
}).strict();
const dateSchema=z.string().max(40).refine(v=>Number.isFinite(Date.parse(v)));
const noteSchema=z.object({
 left:sideSchema,right:sideSchema,display:displaySchema.optional(),flip:z.boolean(),
 link:z.enum(['OFF','SYNCHRONIZE','SYMMETRY']),updatedAt:dateSchema.optional(),
}).strict();
// IDs may belong to a later catalog. Retain them without requiring the current sample DB.
const noteId=/^[^:\s]{1,160}:(?:SP:(?:BEGINNER|NORMAL|HYPER|ANOTHER|LEGGENDARIA):(?:1P|2P)|DP:(?:BEGINNER|NORMAL|HYPER|ANOTHER|LEGGENDARIA))$/;
const stateSchema=z.object({
 schemaVersion:z.literal(1),
 preferences:z.object({mode:z.enum(['SP','DP']),spSide:z.enum(['1P','2P'])}).strict(),
 notes:z.record(z.string().regex(noteId),noteSchema),
 liftVisibility:z.object({SP:z.boolean(),DP:z.boolean()}).strict().optional(),commonNumbers:commonNumbersSchema.optional(),playData:playDataSchema.optional(),manualCharts:manualChartsSchema.optional(),
 folders:z.array(z.object({
  id:z.enum(['fav1','fav2','fav3','fav4','fav5']),name:z.string().min(1).max(20).refine(v=>!!v.trim()),
  color:z.string().regex(/^#[0-9a-fA-F]{6}$/),songIds:z.array(z.string().min(1).max(160)).max(50000).refine(v=>new Set(v).size===v.length),
 }).strict()).length(5).refine(f=>new Set(f.map(x=>x.id)).size===5),
}).strict();
const backupSchema=z.object({format:z.literal('iidx-option-notes'),version:z.literal(1),exportedAt:dateSchema,data:stateSchema}).strict();
export type Backup={format:'iidx-option-notes';version:1;exportedAt:string;data:AppState};

export function makeBackup(state:AppState):string{
 const backup:Backup={format:'iidx-option-notes',version:1,exportedAt:new Date().toISOString(),data:state};
 return JSON.stringify(backup);
}

export function parseBackup(text:string):Backup{
 if(!text.trim())throw new Error('バックアップのテキストを貼り付けてください。');
 if(text.length>128_000_000)throw new Error('テキストが長すぎます。バックアップの部分だけを貼り付けてください。');
 let raw:unknown;
 try{raw=JSON.parse(text.trim().replace(/^\uFEFF/,''));}catch{throw new Error('テキストを読み取れません。エクスポートした内容を先頭から末尾まで、省略せずに貼り付けてください。');}
 if(typeof raw!=='object'||raw===null||!('format' in raw)||raw.format!=='iidx-option-notes'||!('version' in raw)||raw.version!==1)
  throw new Error('このアプリの設定バックアップではないか、未対応の形式です。エクスポートしたテキストを使ってください。');
 const result=backupSchema.safeParse(raw);
 if(!result.success)throw new Error('設定の項目・数値・お気に入り情報に不足や不正な値があります。元の端末からもう一度エクスポートしてください。');
 return result.data;
}

export function backupCounts(state:AppState){
 const keys=Object.keys(state.notes);
 return {manualCharts:Object.keys(state.manualCharts??{}).length,total:keys.length,sp1:keys.filter(k=>k.endsWith(':1P')).length,sp2:keys.filter(k=>k.endsWith(':2P')).length,dp:keys.filter(k=>k.includes(':DP:')).length,favorites:state.folders.reduce((n,f)=>n+f.songIds.length,0),scores:Object.keys(collectPlayHistory(state.playData)).length};
}
