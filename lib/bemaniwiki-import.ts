import {z} from 'zod';
import {playTitleFormatKey} from './play-title';
import type {CatalogImport,ImportedChart,ImportedSong} from './catalog-import';
import type {Difficulty} from './iidx-data';

export const BEMANIWIKI_CATALOG_URL='https://raw.githubusercontent.com/MASA-6cha/iidx-song-data/main/data/bemaniwiki-iidx34.json';
const difficulties:Record<string,Difficulty>={B:'BEGINNER',N:'NORMAL',H:'HYPER',A:'ANOTHER',L:'LEGGENDARIA'};
const chartSchema=z.object({exists:z.boolean().nullable(),level:z.number().int().min(0).max(12).nullish(),notes:z.number().int().min(0).max(100000).nullish(),flags:z.array(z.string().max(80)).max(30).optional()});
const songSchema=z.object({title:z.string().trim().min(1).max(512),artist:z.string().max(1024).nullish(),genre:z.string().max(512).nullish(),bpm:z.string().max(80).nullish(),series:z.literal(34),availability:z.enum(['listed','planned']),charts:z.object({SP:z.record(chartSchema).optional(),DP:z.record(chartSchema).optional()})});

// The crawl has no official song IDs. Use a separate, stable namespace based on
// series and normalized title; artist corrections do not change stored notes.
function songId(title:string){
 let a=2166136261,b=3335557771;
 for(const char of playTitleFormatKey(title)){const code=char.codePointAt(0)!;a=Math.imul(a^code,16777619);b=Math.imul(b^code,16777619);}
 return `wiki-34-${(a>>>0).toString(16).padStart(8,'0')}${(b>>>0).toString(16).padStart(8,'0')}`;
}
export function isBemaniWikiImport(value:unknown){
 return !!value&&typeof value==='object'&&'schema_version' in value&&'source' in value&&!!value.source&&typeof value.source==='object'&&'name' in value.source&&value.source.name==='BEMANIWiki 2nd';
}
export function parseBemaniWikiImport(value:unknown):CatalogImport{
 const root=z.object({schema_version:z.literal(1),source:z.object({name:z.literal('BEMANIWiki 2nd')}),updated_at:z.string().datetime({offset:true}),songs:z.array(z.unknown()).min(1).max(20000)}).safeParse(value);
 if(!root.success)throw new Error('BEMANIWiki JSONの形式・更新日時を確認してください。');
 const songs:ImportedSong[]=[],seen=new Set<string>();let chartCount=0,skippedEmptyCharts=0,skippedUnnamedSongs=0,skippedPlannedSongs=0,warningCount=0;
 for(const [index,input] of root.data.songs.entries()){
  if(input&&typeof input==='object'&&(!('title' in input)||input.title==null||(typeof input.title==='string'&&!input.title.trim()))){skippedUnnamedSongs++;continue;}
  const parsed=songSchema.safeParse(input);if(!parsed.success)throw new Error(`BEMANIWiki ${index+1}曲目の ${parsed.error.issues[0].path.join('.')} の値が不正です。`);
  const song=parsed.data;if(song.availability==='planned'){skippedPlannedSongs++;continue;}
  const id=songId(song.title);if(seen.has(id))throw new Error(`BEMANIWikiの曲名が重複しています：${song.title}`);seen.add(id);
  const charts:ImportedChart[]=[];
  const bpm=song.bpm?.trim(),numbers=bpm?.match(/^([\d.]+)(?:\s*[-–〜~]\s*([\d.]+))?$/);
  for(const mode of ['SP','DP'] as const)for(const [key,c] of Object.entries(song.charts[mode]??{})){
   if(!Object.hasOwn(difficulties,key))throw new Error(`${song.title}: 未対応の譜面種別 ${mode}${key} です。`);
   if(c.exists!==true||c.level===0){skippedEmptyCharts++;continue;}
   const chart:ImportedChart={mode,difficulty:difficulties[key],level:c.level??null,arcadeAvailability:{status:'included',referenceVersion:34}};
   if(bpm&&numbers&&Number(numbers[1])>0){chart.bpm=bpm;chart.soflan=!!numbers[2]&&Number(numbers[2])>Number(numbers[1]);}
   if(c.notes!=null&&c.notes>0)chart.noteCount=c.notes;
   const features:NonNullable<ImportedChart['features']>={};
   for(const feature of ['CN','HCN','BSS','MSS'] as const)if(c.flags?.includes(feature))features[feature]=true;
   if(Object.keys(features).length)chart.features=features;
   warningCount+=(c.flags??[]).filter(flag=>flag.includes('?')).length;
   charts.push(chart);chartCount++;
  }
  if(charts.length)songs.push({musicId:null,supplementId:id,version:34,title:song.title,artist:song.artist??'アーティスト不明',...(song.genre?{genre:song.genre}:{}),charts});
 }
 if(!chartCount)throw new Error('取り込める配信済みの譜面がありません。予定曲・存在未確認の譜面は除外します。');
 return {kind:'wiki',sourceUpdatedAt:root.data.updated_at,songs,chartCount,warningCount,skippedEmptyCharts,skippedUnnamedSongs,skippedPlannedSongs};
}
