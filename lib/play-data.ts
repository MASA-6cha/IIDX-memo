import {officialSeriesNumber,officialLastPlayed} from './official-score-csv';
import {songNames} from './song-identity';
import {z} from 'zod';
import {difficulties,type AppState,type Chart,type Difficulty,type Mode,type Song} from './iidx-data';
import {playTitleKey,playTitleFormatKey,playTitleLatinKey} from './play-title';
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
export const songPlayRecordSchema=z.object({gameVersion:z.number().int().min(1).max(999).nullable(),playCount:number,lastPlayedAt:date.nullable(),importedAt:date}).strict();
export type SongPlayRecord=z.infer<typeof songPlayRecordSchema>;
const songRecordsSchema=z.record(z.string().regex(/^[^:\s]{1,160}:(SP|DP)$/),z.record(z.string().regex(/^(unknown|[1-9]\d{0,2})$/),songPlayRecordSchema).refine(records=>Object.entries(records).every(([key,r])=>key===playVersionKey(r.gameVersion))));
export const playDataSchema=z.object({records:z.record(chartIdSchema,playScoreSchema),imports:z.object({SP:stampSchema.optional(),DP:stampSchema.optional()}).strict(),history:z.record(chartIdSchema,seriesScoresSchema).optional(),songRecords:songRecordsSchema.optional()}).strict();
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
export type PlayEntry={mode:Mode;title:string;artist?:string;difficulty:Difficulty;level:number;score:PlayScore;songRecord?:SongPlayRecord};
export type PlayImport={entries:PlayEntry[];legacy:boolean;duplicates:number;official?:{seriesName:string;gameVersion:number|null}};
export class PlayModeRequired extends Error{constructor(){super('このCSVにはSP・DPの区別がありません。取得したモードを選んでください。');}}

// A quoted CSV field may contain commas, quotes and line breaks. Reject incomplete data.
export function readPlayCsv(text:string,allowBareQuotes=false):string[][]{
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
  else if(closed||(c==='"'&&!allowBareQuotes))throw new Error('CSVの引用符が不正です。省略せずにコピーし直してください。');
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
 const firstLine=readPlayCsv(text.trim().split(/\r?\n/,1)[0])[0]??[];
 const officialHeader=['バージョン','タイトル','プレー回数','最終プレー日時'].every(h=>firstLine.includes(h));
 // Konami exports literal quotes inside otherwise unquoted titles/artists.
 const [headers,...rows]=readPlayCsv(text,officialHeader);
 if(!headers||!rows.length)throw new Error('取得したプレイデータを貼り付けてください。');
 if(new Set(headers.map(v=>v.trim())).size!==headers.length)throw new Error('CSVの見出しが重複しています。');
 const column=new Map(headers.map((name,i)=>[name.trim(),i]));
 // Older official files call the same score column EXスコア.
 for(const diff of difficulties)if(!column.has(`${diff} スコア`)&&column.has(`${diff} EXスコア`))column.set(`${diff} スコア`,column.get(`${diff} EXスコア`)!);
 const custom=playCsvHeaders.every(h=>column.has(h));
 const legacy=!custom&&column.has('タイトル')&&['NORMAL','HYPER','ANOTHER'].every(d=>column.has(`${d} 難易度`)&&column.has(`${d} クリアタイプ`)&&column.has(`${d} スコア`));
 if(!custom&&!legacy)throw new Error('プレイデータの形式が違います。取得ツールの結果をコピーしてください。');
 if(legacy&&!legacyMode)throw new PlayModeRequired();
 const official=legacy&&column.has('バージョン')&&column.has('プレー回数')&&column.has('最終プレー日時')?{seriesName:(rows.at(-1)![column.get('バージョン')!]??'').trim(),gameVersion:officialSeriesNumber(rows.at(-1)![column.get('バージョン')!]??'')}:undefined;
 const entries:PlayEntry[]=[],seen=new Set<string>();let duplicates=0;
 // Before IIDX 27, official exports represent LEGGENDARIA as separate songs.
 const separateLeggendaria=!!official&&official.gameVersion!==null&&official.gameVersion>=21&&official.gameVersion<=26&&!column.has('LEGGENDARIA 難易度');
 const oldSongRows=new Map<string,Map<string,SongPlayRecord>>(),oldLeggendariaGroups=new Set<string>();
 for(let index=0;index<rows.length;index++){
  const row=rows[index],get=(h:string)=>row[column.get(h)??-1]?.trim()??'';
  try{
   if(row.length!==headers.length)throw new Error('列が不足しています。');
   const rawTitle=get('タイトル'),isOldLeggendaria=separateLeggendaria&&/†(?:LEGGENDARIA)?$/i.test(rawTitle);
   const title=isOldLeggendaria?rawTitle.replace(/†(?:LEGGENDARIA)?$/i,'').trimEnd():rawTitle;if(!title||title.length>512)throw new Error('曲名が不正です。');
   const mode=custom?get('プレースタイル'):legacyMode!;
   if(mode!=='SP'&&mode!=='DP')throw new Error('SP・DPを判別できません。');
   const diffs=isOldLeggendaria?['ANOTHER']:custom?[get('譜面')]:difficulties.filter(d=>column.has(`${d} 難易度`));
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
     missCount:numeric(get(custom?'ミスカウント':`${diff} ミスカウント`)),lamp:value('クリアタイプ','クリアタイプ'),djLevel:isBlank(dj)?null:dj,
     gameVersion:custom?numeric(get('取得作品'),999):official?.gameVersion??null,fetchedAt:custom?get('取得日時'):now,importedAt:now,
    });
    if(score.pgreat!==null&&score.great!==null&&score.exScore!==null&&score.pgreat*2+score.great!==score.exScore)throw new Error('EXスコアと判定数が一致しません。');
    // Official CLEAR TYPE and current-version score are independent values.
    const entry:PlayEntry={mode,title,difficulty:isOldLeggendaria?'LEGGENDARIA':diff as Difficulty,level,score,...(!isBlank(get('アーティスト'))?{artist:get('アーティスト')}:{} )};
    if(official||(custom&&column.has('プレー回数')&&(!isBlank(get('プレー回数'))||!isBlank(get('最終プレー日時')))))entry.songRecord=songPlayRecordSchema.parse({gameVersion:score.gameVersion,playCount:numeric(get('プレー回数')),lastPlayedAt:official?officialLastPlayed(get('最終プレー日時')):isBlank(get('最終プレー日時'))?null:get('最終プレー日時'),importedAt:now});
    if(separateLeggendaria&&entry.songRecord){
     const groupKey=`${mode}:${playTitleFormatKey(title)}`,sourceKey=playTitleKey(rawTitle),group=oldSongRows.get(groupKey)??new Map<string,SongPlayRecord>();
     const previous=group.get(sourceKey);
     if(previous&&JSON.stringify(previous)!==JSON.stringify(entry.songRecord))throw new Error('同じ曲のプレー回数・日時が複数あります。CSVの重複行を確認してください。');
     group.set(sourceKey,entry.songRecord);oldSongRows.set(groupKey,group);
     if(isOldLeggendaria)oldLeggendariaGroups.add(groupKey);
    }
    const key=JSON.stringify(entry);if(seen.has(key)){duplicates++;continue;}seen.add(key);entries.push(entry);
   }
  }catch(e){throw new Error(`${index+2}行目：${e instanceof z.ZodError?'項目の値を読み取れません。':e instanceof Error?e.message:'読み取れません。'} コピーした内容を確認してください。`);}
 }
 if(!entries.length)throw new Error('取り込める譜面がありません。取得範囲とデータを確認してください。');
 // Share the combined metadata on every difficulty, so partial imports and
 // copying unresolved charts cannot discard or count the companion row twice.
 for(const entry of entries){
  const key=`${entry.mode}:${playTitleFormatKey(entry.title)}`;
  if(!oldLeggendariaGroups.has(key))continue;
  const rows=[...oldSongRows.get(key)!.values()],counts=rows.flatMap(r=>r.playCount===null?[]:[r.playCount]);
  const dates=rows.flatMap(r=>r.lastPlayedAt?[r.lastPlayedAt]:[]).sort();
  entry.songRecord=songPlayRecordSchema.parse({...entry.songRecord,playCount:counts.length?counts.reduce((a,b)=>a+b,0):null,lastPlayedAt:dates.at(-1)??null});
 }
 return {entries,legacy,duplicates,...(official?{official}:{})};
}

export type PlayMatch={entry:PlayEntry;index:number;candidates:Chart[];target:Chart|null;reason:'matched'|'missing'|'ambiguous'|'duplicate'};
export function playEntriesCsv(entries:PlayEntry[]):string{
 const rows=[[...playCsvHeaders,'ミスカウント','プレー回数','最終プレー日時','アーティスト'],...entries.map(e=>[e.mode,e.title,e.difficulty,e.level,e.score.exScore,e.score.pgreat,e.score.great,e.score.lamp,e.score.djLevel,e.score.gameVersion,e.score.fetchedAt,e.score.missCount,e.songRecord?.playCount,e.songRecord?.lastPlayedAt,e.artist])];
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
   const titles=songNames(song).map(name=>name.title);
   for(const title of new Set(titles.map(keyOf))){const key=`${chart.mode}:${chart.difficulty}:${title}`;index.set(key,[...(index.get(key)??[]),chart]);}
  }
  return {keyOf,index};
 });
 const matches:PlayMatch[]=data.entries.map((entry,index)=>{
  let candidates:Chart[]=[];
  for(const lookup of lookups){candidates=lookup.index.get(`${entry.mode}:${entry.difficulty}:${lookup.keyOf(entry.title)}`)??[];if(candidates.length)break;}
  if(candidates.length>1&&entry.artist){const exact=candidates.filter(c=>songNames(songMap.get(c.songId)!).some(name=>playTitleKey(name.artist)===playTitleKey(entry.artist!)));if(exact.length)candidates=exact;}
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
 // A song-level CSV row cannot be split across two database songs.
 const groups=new Map<string,PlayMatch[]>();
 for(const m of matches)if(m.entry.songRecord){const key=JSON.stringify([m.entry.mode,m.entry.title,m.entry.artist,m.entry.score.gameVersion]);groups.set(key,[...(groups.get(key)??[]),m]);}
 for(const group of groups.values())if(new Set(group.filter(m=>m.target).map(m=>m.target!.songId)).size>1)for(const m of group){m.target=null;m.reason='ambiguous';}
 return matches;
}

export function applyPlayImport(state:AppState,matches:PlayMatch[],now=new Date().toISOString()):AppState{
 const accepted=matches.filter(m=>m.target);if(!accepted.length)throw new Error('取り込める譜面がありません。');
 const records={...state.playData?.records},imports={...state.playData?.imports},history=collectPlayHistory(state.playData),songRecords={...state.playData?.songRecords};
 for(const match of accepted){
  const id=match.target!.id,score={...match.entry.score,importedAt:now};
  // Bookmarklet imports have no miss count; preserve an existing official value.
  if(score.missCount===null)score.missCount=history[id]?.[playVersionKey(score.gameVersion)]?.missCount??null;
  if(match.entry.songRecord){const songKey=`${match.target!.songId}:${match.entry.mode}`;songRecords[songKey]={...songRecords[songKey],[playVersionKey(score.gameVersion)]:{...match.entry.songRecord,gameVersion:score.gameVersion,importedAt:now}};}
  records[id]=score;history[id]={...history[id],[playVersionKey(score.gameVersion)]:score};
 }
 for(const mode of ['SP','DP'] as const){const rows=accepted.filter(m=>m.entry.mode===mode);if(rows.length){const versions=new Set(rows.map(m=>m.entry.score.gameVersion));imports[mode]={at:now,count:rows.length,gameVersion:versions.size===1?rows[0].entry.score.gameVersion:null};}}
 return {...state,playData:{records,imports,history,...(Object.keys(songRecords).length?{songRecords}:{})}};
}
export function matchesPlayFilter(score:PlayScore|undefined,filter:string){
 if(filter==='scored')return (score?.exScore??0)>0;
 if(filter==='all')return true;if(filter==='missing')return !score;if(filter==='played')return !!score&&(score.lamp!=='NO PLAY'||(score.exScore??0)>0);
 return !!score&&score.lamp===filter;
}
