import {z} from 'zod';
import {difficulties,type AppState,type Chart,type Difficulty,type Mode,type Song} from './iidx-data';
import {officialPlayTitleAliases,playTitleKey,playTitleFormatKey,playTitleLatinKey} from './play-title';
import {lamps,playCsvHeaders} from './play-format';
export {lamps,playCsvHeaders} from './play-format';

export type ClearLamp=typeof lamps[number];
export const lampLabels:Record<ClearLamp,string>={'NO PLAY':'NO PLAY','FAILED':'FAILED','ASSIST CLEAR':'ASSIST','EASY CLEAR':'EASY','CLEAR':'CLEAR','HARD CLEAR':'HARD','EX HARD CLEAR':'EX HARD','FULLCOMBO CLEAR':'FC'};
const date=z.string().max(40).refine(v=>Number.isFinite(Date.parse(v)));
const number=z.number().int().min(0).max(200000).nullable();
export const playScoreSchema=z.object({exScore:number,pgreat:number,great:number,missCount:number,lamp:z.enum(lamps),djLevel:z.enum(['AAA','AA','A','B','C','D','E','F']).nullable(),gameVersion:z.number().int().min(1).max(999).nullable(),fetchedAt:date,importedAt:date,manual:z.object({score:date.optional(),lamp:date.optional()}).strict().optional()}).strict();
export type PlayScore=z.infer<typeof playScoreSchema>;
const stampSchema=z.object({at:date,count:z.number().int().min(0),gameVersion:z.number().int().min(1).max(999).nullable()}).strict();
const chartIdSchema=z.string().regex(/^[^:\s]{1,160}:(SP|DP):(BEGINNER|NORMAL|HYPER|ANOTHER|LEGGENDARIA)$/);
const seriesScoresSchema=z.record(z.string().regex(/^(unknown|[1-9]\d{0,2})$/),playScoreSchema).refine(scores=>Object.entries(scores).every(([key,score])=>key===playVersionKey(score.gameVersion)),'シリーズ番号が記録と一致しません。');
export const playDataSchema=z.object({records:z.record(chartIdSchema,playScoreSchema),imports:z.object({SP:stampSchema.optional(),DP:stampSchema.optional()}).strict(),history:z.record(chartIdSchema,seriesScoresSchema).optional()}).strict();
export type PlayData=z.infer<typeof playDataSchema>;
export type PlayHistory=NonNullable<PlayData['history']>;
export const playVersionKey=(version:number|null)=>version===null?'unknown':String(version);
// Read old single-record saves without losing them when the next series is imported.
export function collectPlayHistory(data:PlayData|undefined):PlayHistory{
 const history:PlayHistory=Object.fromEntries(Object.entries(data?.history??{}).map(([id,scores])=>[id,{...scores}]));
 for(const [id,score] of Object.entries(data?.records??{})){
  const key=playVersionKey(score.gameVersion),scores=history[id]??{},previous=scores[key];
  if(!previous||Date.parse(score.importedAt)>Date.parse(previous.importedAt))scores[key]=score;
  history[id]=scores;
 }
 return history;
}
export type PlayEntry={mode:Mode;title:string;artist?:string;difficulty:Difficulty;level:number;score:PlayScore};
export type PlayImport={entries:PlayEntry[];legacy:boolean;duplicates:number};
export class PlayModeRequired extends Error{constructor(){super('このCSVにはSP・DPの区別がありません。取得したモードを選んでください。');}}

// A quoted CSV field may contain commas, quotes and line breaks. Reject incomplete data.
export function readPlayCsv(text:string):string[][]{
 if(text.length>8_000_000)throw new Error('テキストが大きすぎます。取得したデータだけを貼り付けてください。');
 const csv=text.trim().replace(/^\uFEFF/,''),rows:string[][]=[];let row:string[]=[],field='',quoted=false,closed=false;
 const pushField=()=>{row.push(field);field='';closed=false;if(row.length>80)throw new Error('CSVの列数が多すぎます。');};
 const pushRow=()=>{pushField();if(row.some(v=>v.trim()))rows.push(row);row=[];if(rows.length>25001)throw new Error('取得データの件数が多すぎます。');};
 for(let i=0;i<csv.length;i++){
  const c=csv[i];
  if(quoted){if(c==='"'){if(csv[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;}
  else if(c===',')pushField();
  else if(c==='\n'||c==='\r'){if(c==='\r'&&csv[i+1]==='\n')i++;pushRow();}
  else if(c==='"'&&!field&&!closed)quoted=true;
  else if(closed||c==='"')throw new Error('CSVの引用符が不正です。省略せずにコピーし直してください。');
  else field+=c;
  if(field.length>3000)throw new Error('CSVの項目が長すぎます。');
 }
 if(quoted)throw new Error('テキストが途中で切れています。最後までコピーしてください。');
 if(field||row.length||closed)pushRow();
 return rows;
}
const isBlank=(v:string)=>['','-','--','---','—'].includes(v.trim());
function numeric(v:string,max=200000):number|null{
 if(isBlank(v))return null;
 if(!/^\d+$/.test(v.trim())||Number(v)>max)throw new Error('数値を読み取れません。');
 return Number(v);
}

export function parsePlayImport(text:string,legacyMode?:Mode,now=new Date().toISOString()):PlayImport{
 const [headers,...rows]=readPlayCsv(text);
 if(!headers||!rows.length)throw new Error('取得したプレイデータを貼り付けてください。');
 if(new Set(headers.map(v=>v.trim())).size!==headers.length)throw new Error('CSVの見出しが重複しています。');
 const column=new Map(headers.map((name,i)=>[name.trim(),i]));
 const custom=playCsvHeaders.every(h=>column.has(h));
 const legacy=!custom&&column.has('タイトル')&&['NORMAL','HYPER','ANOTHER'].every(d=>column.has(`${d} 難易度`)&&column.has(`${d} クリアタイプ`)&&column.has(`${d} スコア`));
 if(!custom&&!legacy)throw new Error('プレイデータの形式が違います。取得ツールの結果をコピーしてください。');
 if(legacy&&!legacyMode)throw new PlayModeRequired();
 const entries:PlayEntry[]=[],seen=new Set<string>();let duplicates=0;
 for(let index=0;index<rows.length;index++){
  const row=rows[index],get=(h:string)=>row[column.get(h)??-1]?.trim()??'';
  try{
   if(row.length!==headers.length)throw new Error('列が不足しています。');
   const title=get('タイトル');if(!title||title.length>512)throw new Error('曲名が不正です。');
   const mode=custom?get('プレースタイル'):legacyMode!;
   if(mode!=='SP'&&mode!=='DP')throw new Error('SP・DPを判別できません。');
   const diffs=custom?[get('譜面')]:difficulties.filter(d=>column.has(`${d} 難易度`));
   for(const diff of diffs){
    if(!difficulties.includes(diff as Difficulty))throw new Error('譜面難易度を読み取れません。');
    const level=numeric(get(custom?'難度':`${diff} 難易度`),12);
    // The reference exporter fills unfetched difficulties with "-" and NO PLAY.
    // Those placeholders must never overwrite an existing score.
    if(level===null||level===0){if(legacy)continue;throw new Error('難度値がありません。');}
    const value=(name:string,old:string)=>get(custom?name:`${diff} ${old}`);
    const dj=value('DJ LEVEL','DJ LEVEL').toUpperCase();
    const score=playScoreSchema.parse({
     exScore:numeric(value('EXスコア','スコア')),pgreat:numeric(value('PGREAT','PGreat')),great:numeric(value('GREAT','Great')),
     missCount:legacy?numeric(get(`${diff} ミスカウント`)):null,lamp:value('クリアタイプ','クリアタイプ'),djLevel:isBlank(dj)?null:dj,
     gameVersion:custom?numeric(get('取得作品'),999):null,fetchedAt:custom?get('取得日時'):now,importedAt:now,
    });
    if(score.pgreat!==null&&score.great!==null&&score.exScore!==null&&score.pgreat*2+score.great!==score.exScore)throw new Error('EXスコアと判定数が一致しません。');
    // Official CLEAR TYPE and current-version score are independent values.
    const entry:PlayEntry={mode,title,difficulty:diff as Difficulty,level,score,...(legacy&&!isBlank(get('アーティスト'))?{artist:get('アーティスト')}:{} )};
    const key=JSON.stringify(entry);if(seen.has(key)){duplicates++;continue;}seen.add(key);entries.push(entry);
   }
  }catch(e){throw new Error(`${index+2}行目：${e instanceof z.ZodError?'項目の値を読み取れません。':e instanceof Error?e.message:'読み取れません。'} コピーした内容を確認してください。`);}
 }
 if(!entries.length)throw new Error('取り込める譜面がありません。取得範囲とデータを確認してください。');
 return {entries,legacy,duplicates};
}

export type PlayMatch={entry:PlayEntry;index:number;candidates:Chart[];target:Chart|null;reason:'matched'|'missing'|'ambiguous'|'duplicate'};
export function playEntriesCsv(entries:PlayEntry[]):string{
 const rows=[playCsvHeaders,...entries.map(e=>[e.mode,e.title,e.difficulty,e.level,e.score.exScore,e.score.pgreat,e.score.great,e.score.lamp,e.score.djLevel,e.score.gameVersion,e.score.fetchedAt])];
 return rows.map(row=>row.map(value=>`"${String(value??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');
}
export function playMatchIssue(match:PlayMatch):string{
 if(match.reason==='duplicate')return '同じ譜面に複数の取得データが対応しています。';
 if(!match.candidates.length)return '曲名・モード・譜面の対応が見つかりません。楽曲DBの更新をお試しください。';
 if(!match.candidates.some(c=>c.level===match.entry.level))return `取得データは☆${match.entry.level}、DBは☆${[...new Set(match.candidates.map(c=>c.level))].join(' / ☆')}です。`;
 return '対応候補があります。収録作品・アーティスト・難度を確認してください。';
}
export function matchPlayImport(data:PlayImport,songs:Song[],charts:Chart[],choices:Record<number,string>={}):PlayMatch[]{
 const songMap=new Map(songs.map(s=>[s.id,s]));
 // Exact spelling first, then formatting, then Latin accents. Each fallback
 // retains collisions rather than guessing a song from a similar-looking name.
 const lookups=[playTitleKey,playTitleFormatKey,playTitleLatinKey].map(keyOf=>{
  const index=new Map<string,Chart[]>();
  for(const chart of charts){
   const song=songMap.get(chart.songId);if(!song)continue;
   const titles=[song.title,...(officialPlayTitleAliases[song.id]??[])];
   for(const title of new Set(titles.map(keyOf))){const key=`${chart.mode}:${chart.difficulty}:${title}`;index.set(key,[...(index.get(key)??[]),chart]);}
  }
  return {keyOf,index};
 });
 const matches:PlayMatch[]=data.entries.map((entry,index)=>{
  let candidates:Chart[]=[];
  for(const lookup of lookups){candidates=lookup.index.get(`${entry.mode}:${entry.difficulty}:${lookup.keyOf(entry.title)}`)??[];if(candidates.length)break;}
  if(candidates.length>1&&entry.artist){const exact=candidates.filter(c=>playTitleKey(songMap.get(c.songId)!.artist)===playTitleKey(entry.artist!));if(exact.length)candidates=exact;}
  // These imports come from the arcade score list. Prefer its current catalog
  // entry over archived/CS revisions, but retain every candidate for review.
  const current=candidates.filter(c=>songMap.get(c.songId)!.removed===false&&!songMap.get(c.songId)!.retained&&!c.retained);
  const pool=current.length?current:candidates;
  // A same-title chart with a different level may be a revision or a different song.
  // Ask the user instead of silently applying it to the sole apparent match.
  const exact=pool.filter(c=>c.level===entry.level);
  const target=Object.hasOwn(choices,index)?candidates.find(c=>c.id===choices[index])??null:exact.length===1?exact[0]:null;
  return {entry,index,candidates,target,reason:target?'matched':candidates.length?'ambiguous':'missing'};
 });
 const used=new Map<string,PlayMatch[]>();for(const m of matches)if(m.target){const key=`${m.target.id}:${playVersionKey(m.entry.score.gameVersion)}`;used.set(key,[...(used.get(key)??[]),m]);}
 for(const group of used.values())if(group.length>1)for(const match of group){match.target=null;match.reason='duplicate';}
 return matches;
}

export function applyPlayImport(state:AppState,matches:PlayMatch[],now=new Date().toISOString()):AppState{
 const accepted=matches.filter(m=>m.target);if(!accepted.length)throw new Error('取り込める譜面がありません。');
 const records={...state.playData?.records},imports={...state.playData?.imports},history=collectPlayHistory(state.playData);
 for(const match of accepted){
  const id=match.target!.id,score={...match.entry.score,importedAt:now};
  records[id]=score;history[id]={...history[id],[playVersionKey(score.gameVersion)]:score};
 }
 for(const mode of ['SP','DP'] as const){const rows=accepted.filter(m=>m.entry.mode===mode);if(rows.length){const versions=new Set(rows.map(m=>m.entry.score.gameVersion));imports[mode]={at:now,count:rows.length,gameVersion:versions.size===1?rows[0].entry.score.gameVersion:null};}}
 return {...state,playData:{records,imports,history}};
}
export function matchesPlayFilter(score:PlayScore|undefined,filter:string){
 if(filter==='scored')return (score?.exScore??0)>0;
 if(filter==='all')return true;if(filter==='missing')return !score;if(filter==='played')return !!score&&(score.lamp!=='NO PLAY'||(score.exScore??0)>0);
 return !!score&&score.lamp===filter;
}
