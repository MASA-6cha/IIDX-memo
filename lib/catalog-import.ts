import {z} from 'zod';
import {normalized,songs as sampleSongs,seriesNames as builtInSeriesNames,type Catalog,type Chart,type Song,type Difficulty,type RadarValues,type ImportedChartInfo,type ImportedSongInfo} from './iidx-data';
import {canonicalSongId} from './iidx-ids';
import {songNames,identityPublicId,publicSongId,rememberSongNames,reconcileSongIdentities,applyAnalyzedChart,resolveSongId} from './song-identity';
import {playTitleFormatKey} from './play-title';
import {isBemaniWikiImport,parseBemaniWikiImport} from './bemaniwiki-import';

export const DEFAULT_CATALOG_IMPORT_URL='https://raw.githubusercontent.com/MASA-6cha/iidx-song-data/main/songs.json';
export const SUPPLEMENT_CATALOG_URL='https://raw.githubusercontent.com/MASA-6cha/iidx-song-data/main/iidx34-songs.json';
export const CATALOG_IMPORT_MAX_BYTES=32*1024*1024;
const schemaName='iidx-info-exporter/songs/1';
const chartTypes={SPB:['SP','BEGINNER'],SPN:['SP','NORMAL'],SPH:['SP','HYPER'],SPA:['SP','ANOTHER'],SPL:['SP','LEGGENDARIA'],DPB:['DP','BEGINNER'],DPN:['DP','NORMAL'],DPH:['DP','HYPER'],DPA:['DP','ANOTHER'],DPL:['DP','LEGGENDARIA']} as const;
const axes=['NOTES','PEAK','SCRATCH','SOF-LAN','CHARGE','CHORD'] as const;
const bpmNumber=z.number().finite().min(0).max(100000),range=z.union([z.object({min:bpmNumber,max:bpmNumber,text:z.string().max(80).nullable().optional()}).refine(x=>x.min<=x.max),z.object({min:z.null(),max:z.null(),text:z.null().optional()}).transform(()=>null)]);
const radarNumber=z.number().finite().min(0).max(200).nullable().optional();
const rawChart=z.object({
 chart_type:z.string().optional(),level:z.number().int().min(0).max(12).nullish().transform(value=>value??null),bpm:range.nullable().optional(),bpm_display:range.nullable().optional(),
 note_count:z.number().int().min(0).max(100000).nullable().optional(),
 CN:z.boolean().nullable().optional(),HCN:z.boolean().nullable().optional(),BSS:z.boolean().nullable().optional(),MSS:z.boolean().nullable().optional(),
 radar:z.object({'NOTES':radarNumber,'PEAK':radarNumber,'SCRATCH':radarNumber,'SOF-LAN':radarNumber,SOFLAN:radarNumber,CHARGE:radarNumber,CHORD:radarNumber}).nullable().optional(),
 status:z.string().max(100).nullable().optional(),status_label:z.string().max(100).nullable().optional(),warnings:z.array(z.string().max(1000)).max(100).optional(),
 arcade_availability:z.object({status:z.enum(['included','not_included','unknown']),reference_version:z.number().int().min(1).max(100)}).nullable().optional(),
});
const rawSong=z.object({music_id:z.number().int().min(1).max(999999999),title:z.string().trim().min(1).max(512).nullable(),artist:z.string().max(1024).nullable(),genre:z.string().max(512).nullable().optional(),charts:z.record(z.unknown())});
export type ImportedChart=Omit<ImportedChartInfo,'importedAt'>&{mode:'SP'|'DP';difficulty:Difficulty};
export type ImportedSong=Omit<ImportedSongInfo,'importedAt'|'musicId'>&{musicId:number|null;supplementId?:string;version?:number;charts:ImportedChart[]};
export type CatalogImport={kind?:'supplement'|'wiki'|'identities';sourceUpdatedAt?:string;skippedPlannedSongs?:number;identityLinks?:{musicId:number;publicId:string}[];songs:ImportedSong[];chartCount:number;warningCount:number;skippedEmptyCharts:number;skippedUnnamedSongs:number};
export type ImportOrigin={label:string;url?:string};
export type CatalogImportIssue={musicId:number|null;title:string;reason:string};

export function parseCatalogImport(text:string):CatalogImport{
 if(text.length>CATALOG_IMPORT_MAX_BYTES)throw new Error('JSONは32MB以下のファイルを選んでください。');
 let value:unknown;try{value=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw new Error('JSONを読み取れませんでした。songs.jsonを選んでください。');}
 if(isBemaniWikiImport(value))return parseBemaniWikiImport(value);
 if(value&&typeof value==='object'&&'schema' in value&&value.schema==='iidx-song-identities/1'){
  const mapped=z.object({schema:z.literal('iidx-song-identities/1'),links:z.array(z.object({music_id:z.number().int().min(1).max(999999999),song_key:z.string().regex(/^iidx-data-table:\d{1,12}$/)})).min(1).max(20000)}).safeParse(value);
  if(!mapped.success)throw new Error('曲ID対応表の形式が不正です。');
  const links=mapped.data.links;if(new Set(links.map(x=>x.music_id)).size!==links.length||new Set(links.map(x=>x.song_key)).size!==links.length)throw new Error('曲ID対応表は1対1で指定してください。');
  return {kind:'identities',identityLinks:links.map(x=>({musicId:x.music_id,publicId:x.song_key.replace('iidx-data-table:','idt-')})),songs:[],chartCount:0,warningCount:0,skippedEmptyCharts:0,skippedUnnamedSongs:0};
 }
 const root=z.object({schema:z.enum([schemaName,'iidx-song-supplement/1']),songs:z.array(z.unknown()).min(1).max(20000)}).safeParse(value);
 if(!root.success)throw new Error(`対応形式は「${schemaName}」「iidx-song-supplement/1」、またはBEMANIWikiのIIDX34 JSONです。`);
 const supplement=root.data.schema==='iidx-song-supplement/1';
 const supplementSong=rawSong.extend({music_id:z.number().int().min(1).max(999999999).nullish(),song_key:z.string().regex(/^iidx-data-table:\d+$/),version:z.number().int().min(1).max(100),excluded_charts:z.array(z.enum(Object.keys(chartTypes) as [string,...string[]])).optional()});
 const songs:ImportedSong[]=[],seen=new Set<string>();let chartCount=0,warningCount=0,skippedEmptyCharts=0,skippedUnnamedSongs=0;
 for(const [index,input] of root.data.songs.entries()){
  if(input&&typeof input==='object'&&('title' in input?input.title==null||(typeof input.title==='string'&&!input.title.trim()):true)){skippedUnnamedSongs++;continue;}
  const parsed=supplement?supplementSong.safeParse(input):rawSong.safeParse(input);
  if(!parsed.success)throw new Error(`${index+1}曲目の ${parsed.error.issues[0].path.join('.')} を読み取れませんでした。`);
  const song={...parsed.data,title:parsed.data.title!,artist:parsed.data.artist??'アーティスト不明'};
  const supplementId='song_key' in song?String(song.song_key).replace('iidx-data-table:','idt-'):undefined;
  const unique=supplementId??String(song.music_id);if(seen.has(unique))throw new Error(`曲ID ${unique} が重複しています。`);seen.add(unique);
  const charts:ImportedChart[]=[];
  for(const [key,inputChart] of Object.entries(song.charts)){
   if(!Object.hasOwn(chartTypes,key))throw new Error(`${song.title}: 未対応の譜面種別 ${key.slice(0,30)} です。`);
   if('excluded_charts' in song&&Array.isArray(song.excluded_charts)&&song.excluded_charts.includes(key)){skippedEmptyCharts++;continue;}
   if(inputChart===null){skippedEmptyCharts++;continue;}
   const parsedChart=rawChart.safeParse(inputChart);
   if(!parsedChart.success)throw new Error(`${song.title} ${key}: ${parsedChart.error.issues[0].path.join('.')} の値が不正です。`);
   const c=parsedChart.data;if(c.chart_type!==undefined&&c.chart_type!==key)throw new Error(`${song.title} ${key}: chart_typeが一致しません。`);
   if(c.level===0){skippedEmptyCharts++;continue;}
   const [mode,difficulty]=chartTypes[key as keyof typeof chartTypes],display=c.bpm_display??c.bpm,actual=c.bpm??display;
   const chart:ImportedChart={mode,difficulty,level:c.level};
   if(display)chart.bpm=display.text?.trim()||(display.min===display.max?String(display.min):`${display.min}–${display.max}`);
   if(actual)chart.soflan=actual.min>0&&actual.max>actual.min;
   if(c.note_count!==undefined)chart.noteCount=c.note_count||null;
   if(c.radar!==undefined)chart.radarValues=c.radar===null?null:axes.map(axis=>axis==='SOF-LAN'?(c.radar!['SOF-LAN']??c.radar!.SOFLAN??null):c.radar![axis]??null) as RadarValues;
   const features:NonNullable<ImportedChartInfo['features']>={};for(const name of ['CN','HCN','BSS','MSS'] as const)if(c[name]!==undefined)features[name]=c[name];
   if(Object.keys(features).length)chart.features=features;
   if(c.status!==undefined)chart.status=c.status;if(c.status_label!==undefined)chart.statusLabel=c.status_label;
   if(c.arcade_availability)chart.arcadeAvailability={status:c.arcade_availability.status,referenceVersion:c.arcade_availability.reference_version};
   if(c.warnings!==undefined){chart.warnings=c.warnings.slice(0,20);warningCount+=c.warnings.length;}
   charts.push(chart);chartCount++;
  }
  songs.push({musicId:song.music_id??null,...(supplementId?{supplementId,version:Number('version' in song?song.version:0)}:{}),title:song.title,artist:song.artist,...(song.genre!==undefined?{genre:song.genre}:{}),charts});
 }
 if(!chartCount)throw new Error('取り込める譜面がありません（曲名のない曲・譜面なしのデータは除外します）。');
 return {...(supplement?{kind:'supplement' as const}:{}),songs,chartCount,warningCount,skippedEmptyCharts,skippedUnnamedSongs};
}

const nameKey=playTitleFormatKey;
const songKey=(song:Pick<Song,'title'|'artist'>)=>JSON.stringify([nameKey(song.title),nameKey(song.artist)]);
const sampleIds=new Map(sampleSongs.map(song=>[songKey(song),canonicalSongId(song.id)]));
function indexSongs(songs:Song[]){
 const keys=new Map<string,Song[]>(),titles=new Map<string,Song[]>(),ids=new Map<number,Song[]>();
 const add=<K>(map:Map<K,Song[]>,key:K,song:Song)=>map.set(key,[...(map.get(key)??[]),song]);
 for(const song of songs){for(const name of songNames(song)){if(!(keys.get(songKey(name))??[]).some(s=>s.id===song.id))add(keys,songKey(name),song);if(!(titles.get(nameKey(name.title))??[]).some(s=>s.id===song.id))add(titles,nameKey(name.title),song);}if(song.importedInfo)add(ids,song.importedInfo.musicId,song);}
 return {keys,titles,ids};
}
const withChartInfo=applyAnalyzedChart;
function withSongInfo(song:Song,info:ImportedSongInfo):Song{return rememberSongNames({...song,title:info.title,artist:info.artist,...(info.genre!==undefined?{genre:info.genre}:{}),importedInfo:info},song);}
function recount(catalog:Catalog):Catalog{
 return {...catalog,...(catalog.additionalData?{additionalData:{...catalog.additionalData,radarCharts:catalog.charts.filter(c=>c.radar&&c.radar.values.some(v=>v!==null)).length}}:{})};
}

export type CatalogImportResult={catalog:Catalog;updatedSongs:number;addedSongs:number;updatedCharts:number;addedCharts:number;acceptedCharts:number;issues:CatalogImportIssue[];examples:{title:string;kind:'更新'|'追加';charts:number}[];linkedSongs?:number};
export function mergeCatalogImport(previous:Catalog|null,data:CatalogImport,origin:ImportOrigin,now=new Date().toISOString()):CatalogImportResult{
 if(data.kind==='identities'){
  if(!previous)throw new Error('先に楽曲DBまたは解析JSONを取り込んでください。');
  const links={...previous.songIdentities?.links};
  for(const row of data.identityLinks??[]){if(links[row.musicId]&&links[row.musicId]!==row.publicId)throw new Error(`music_id ${row.musicId} は別の曲に対応済みです。`);links[row.musicId]=row.publicId;}
  if(new Set(Object.values(links)).size!==Object.keys(links).length)throw new Error('同じ通常DB曲に複数のmusic_idを指定できません。');
  for(const song of previous.songs)if(song.importedInfo&&publicSongId(song)&&links[song.importedInfo.musicId]&&links[song.importedInfo.musicId]!==publicSongId(song))throw new Error(`${song.title} は別の通常DB曲に対応済みです。`);
  const catalog=applySavedSupplement(reconcileSongIdentities({...stripSupplement(previous)!,songIdentities:{links,redirects:{...previous.songIdentities?.redirects}}}),previous.songs);
  return {catalog,updatedSongs:0,addedSongs:0,updatedCharts:0,addedCharts:0,acceptedCharts:0,linkedSongs:data.identityLinks?.length??0,issues:[],examples:[]};
 }
 previous=previous?reconcileStoredCatalog(previous):null;
 if(data.kind==='supplement'||data.kind==='wiki'){
  const catalog:Catalog=previous??{schemaVersion:1,source:'iidx-data-table',fetchedAt:now,sourceUpdatedAt:null,seriesNames:{},songs:[],charts:[]};
  const saved={data,origin,importedAt:now};
  const redirects={...catalog.songIdentities?.redirects};
  // Keep IDs already used by a saved manual supplement before adding the crawl.
  if(data.kind==='wiki'){
   const lookup=indexSongs(catalog.songs);
   for(const song of data.songs){const matches=(lookup.keys.get(songKey(song))??[]).filter(old=>old.series===song.version||old.series===-2);if(song.supplementId&&matches.length===1&&song.supplementId!==matches[0].id)redirects[song.supplementId]=resolveSongId(matches[0].id,redirects);}
  }
  const applied=applyFallbackSources({...catalog,songIdentities:{links:{...catalog.songIdentities?.links},redirects},...(data.kind==='wiki'?{wikiData:saved}:{supplementData:saved})},data.kind);
  return {...applied.result!,catalog:applied.catalog};
 }
 const identities=previous?.songs??[];
 previous=stripSupplement(previous);
 const catalog:Catalog=previous??{schemaVersion:1,source:'iidx-info-exporter',fetchedAt:now,sourceUpdatedAt:null,seriesNames:{[-2]:'シリーズ不明'},songs:[],charts:[]};
 const songs=new Map(catalog.songs.map(s=>[s.id,s])),charts=new Map(catalog.charts.map(c=>[c.id,c])),lookup=indexSongs([...catalog.songs,...identities.filter(song=>!catalog.songs.some(base=>base.id===song.id))]),claimed=new Set<string>();
 const issues:CatalogImportIssue[]=[],examples:{title:string;kind:'更新'|'追加';charts:number}[]=[];
 let updatedSongs=0,addedSongs=0,updatedCharts=0,addedCharts=0,acceptedCharts=0;
 for(const input of data.songs){
  if(!input.charts.length)continue;
  const mapped=input.musicId===null?undefined:identityPublicId(input.musicId,catalog);
  const byId=input.musicId===null?[]:lookup.ids.get(input.musicId)??[],byName=mapped?catalog.songs.filter(s=>publicSongId(s)===mapped):lookup.keys.get(songKey(input))??[];
  const candidates=byId.length?byId:byName;
  const reject=(reason:string)=>issues.push({musicId:input.musicId,title:input.title,reason});
  if(candidates.length>1){reject('対応する既存曲が複数あります');continue;}
  const old=candidates[0]?{...candidates[0]}:undefined;
  if(old)delete old.supplementBase;
  if(!old&&(lookup.titles.get(nameKey(input.title))?.length)){reject('曲名は一致しますが、アーティストが異なります');continue;}
  if(old?.importedInfo&&old.importedInfo.musicId!==input.musicId){reject('既存曲に別のmusic_idが登録されています');continue;}
  const id=old?.id??(!previous?sampleIds.get(songKey(input)):undefined)??`arcade-${input.musicId}`;
  if(claimed.has(id)||(!old&&songs.has(id))){reject('同じ曲への重複した対応を検出しました');continue;}claimed.add(id);
  const info:ImportedSongInfo={...old?.importedInfo,origin:{...origin},musicId:input.musicId!,title:input.title,artist:input.artist,...(input.genre!==undefined?{genre:input.genre}:{}),importedAt:now};
  const first=input.charts[0];
  const song=withSongInfo(old??{id,series:-2,title:input.title,artist:input.artist,bpm:first.bpm??'—',soflan:input.charts.some(c=>c.soflan),removed:false,availabilityUnknown:true},info);
  if(first.bpm!==undefined)song.bpm=first.bpm;
  songs.set(id,song);if(old)updatedSongs++;else addedSongs++;
  if(examples.length<12)examples.push({title:input.title,kind:old?'更新':'追加',charts:input.charts.length});
  for(const c of input.charts){
   const chartId=`${id}:${c.mode}:${c.difficulty}`,oldChart=charts.get(chartId),{mode,difficulty,...fields}=c;
   const details:ImportedChartInfo={...oldChart?.importedInfo,...fields,...(fields.features?{features:{...oldChart?.importedInfo?.features,...fields.features}}:{}),importedAt:now};
   charts.set(chartId,withChartInfo(oldChart??{id:chartId,songId:id,mode,difficulty,level:c.level??0,unofficialRatings:{}},details));
   if(oldChart)updatedCharts++;else addedCharts++;acceptedCharts++;
  }
 }
 const result=recount({...catalog,seriesNames:{...catalog.seriesNames,[-2]:'シリーズ不明'},songs:[...songs.values()],charts:[...charts.values()],importedData:{...origin,importedAt:now}});
 return {catalog:applySavedSupplement(reconcileSongIdentities(result),identities),updatedSongs,addedSongs,updatedCharts,addedCharts,acceptedCharts,issues,examples};
}

// A later public DB refresh supplies series/availability/community ratings, while
// explicitly imported chart fields remain authoritative. Preserve existing IDs
// when a previously new imported song becomes available in the public catalog.
export function preserveImportedCatalog(previous:Catalog|null,incoming:Catalog):Catalog{
 if(!previous?.importedData)return incoming;
 const importedIds=new Set(previous.songs.filter(s=>s.importedInfo).map(s=>s.id));
 return recount(reconcileSongIdentities({...incoming,
  songs:[...incoming.songs,...previous.songs.filter(s=>s.importedInfo)],
  charts:[...incoming.charts,...previous.charts.filter(c=>importedIds.has(c.songId))],
  songIdentities:{links:{...previous.songIdentities?.links,...incoming.songIdentities?.links},redirects:{...previous.songIdentities?.redirects,...incoming.songIdentities?.redirects}},
  importedData:previous.importedData,
 }));
}

export function normalizeCatalogImportUrl(input:string){
 let url:URL;try{url=new URL(input.trim());}catch{throw new Error('GitHubのJSONファイルのURLを入力してください。');}
 if(url.protocol!=='https:'||url.username||url.password||url.port)throw new Error('認証情報を含まないHTTPSのURLを入力してください。');
 if(url.hostname==='github.com'){
  const parts=url.pathname.split('/').filter(Boolean);
  if(parts.length<5||parts[2]!=='blob')throw new Error('GitHubのsongs.jsonページ、またはRawのURLを入力してください。');
  url=new URL(`https://raw.githubusercontent.com/${parts[0]}/${parts[1]}/${parts.slice(3).join('/')}`);
 }
 if(url.hostname!=='raw.githubusercontent.com'&&!/^[a-z0-9-]+\.github\.io$/i.test(url.hostname))throw new Error('GitHubのRaw URLまたはGitHub PagesのURLを入力してください。');
 url.hash='';url.search='';return url.href;
}

// Keep the unfilled source alongside each supplemented entry so later source
// updates can take precedence, and repeated supplement imports can be corrected.
export function stripSupplement(catalog:Catalog|null):Catalog|null{
 if(!catalog)return null;
 return {...catalog,songs:catalog.songs.flatMap(song=>song.supplementBase===undefined?[song]:song.supplementBase?[song.supplementBase]:[]),charts:catalog.charts.flatMap(chart=>chart.supplementBase===undefined?[chart]:chart.supplementBase?[chart.supplementBase]:[])};
}
export function applySavedSupplement(catalog:Catalog,identityHints:Song[]=catalog.songs):Catalog{
 return catalog.wikiData||catalog.supplementData?applyFallbackSources(catalog,undefined,identityHints).catalog:catalog;
}
function applyFallbackSources(catalog:Catalog,target?:'wiki'|'supplement',identityHints:Song[]=catalog.songs){
 let combined=stripSupplement(catalog)!,result:CatalogImportResult|undefined;
 for(const saved of [catalog.wikiData,catalog.supplementData])if(saved){
  const applied=mergeSupplement(combined,saved.data,saved.origin,saved.importedAt,identityHints);combined=applied.catalog;
  if(!target||saved.data.kind===target)result=applied;
 }
 return {catalog:combined,result};
}
function mergeSupplement(base:Catalog,data:CatalogImport,origin:ImportOrigin,now:string,identityHints:Song[]):CatalogImportResult{
 const songs=new Map(base.songs.map(song=>[song.id,song])),charts=new Map(base.charts.map(chart=>[chart.id,chart])),lookup=indexSongs(base.songs),claimed=new Set<string>();
 const hints=indexSongs(identityHints),hintsById=new Map(identityHints.map(song=>[song.id,song]));
 const issues:CatalogImportIssue[]=[],examples:{title:string;kind:'更新'|'追加';charts:number}[]=[];
 let updatedSongs=0,addedSongs=0,updatedCharts=0,addedCharts=0,acceptedCharts=0;
 const seriesNames={...base.seriesNames},redirects={...base.songIdentities?.redirects};
 const knownBpm=(bpm:string|undefined)=>!!bpm&&/\d/.test(bpm)&&bpm!=='0';
 for(const input of data.songs){
  if(!input.charts.length||!input.supplementId)continue;
  const byId=songs.get(resolveSongId(input.supplementId,redirects)),byName=(lookup.keys.get(songKey(input))??[]).filter(song=>data.kind!=='wiki'||song.series===input.version||song.series===-2);
  const byMusicId=input.musicId===null?[]:lookup.ids.get(input.musicId)??[];
  const matches=byMusicId.length?byMusicId:byName;
  const reject=(reason:string)=>issues.push({musicId:input.musicId,title:input.title,reason});
  if(data.kind==='wiki'&&!byId&&!matches.length&&(hints.keys.get(songKey(input))??[]).length>1){reject('保存済みの対応候補が複数あります');continue;}
  if(data.kind==='wiki'&&!byId&&!matches.length&&hints.titles.has(nameKey(input.title))&&!hints.keys.has(songKey(input))){reject('保存済みの曲名は一致しますが、アーティストが異なります');continue;}
  if(byId&&!songNames(byId).some(name=>nameKey(name.title)===nameKey(input.title))){reject('曲IDと曲名が一致しません');continue;}
  if(byId&&data.kind==='wiki'&&byId.series!==input.version&&byId.series!==-2){reject('既存曲のシリーズがIIDX34と一致しません');continue;}
  if(!byId&&matches.length>1){reject('対応する既存曲が複数あります');continue;}
  const old=byId??matches[0];
  if(!old&&(lookup.titles.get(nameKey(input.title))?.length)){reject('曲名は一致しますが、アーティストが異なります');continue;}
  const id=old?.id??resolveSongId(input.supplementId,redirects);
  if(data.kind==='wiki'&&id!==input.supplementId)redirects[input.supplementId]=id;
  if(claimed.has(id)){reject('同じ曲への重複した対応を検出しました');continue;}claimed.add(id);
  const first=input.charts.find(chart=>knownBpm(chart.bpm));
  const song:Song={...(old??{id,titleSource:{kind:data.kind==='wiki'?'wiki':'supplement',...origin,sourceId:input.supplementId},title:input.title,artist:input.artist,series:input.version??-2,bpm:first?.bpm??'—',soflan:input.charts.some(chart=>chart.soflan),removed:false}),supplementBase:old?.supplementBase===undefined?old??null:old.supplementBase};
  if(song.series===-2&&input.version)song.series=input.version;
  if(!knownBpm(song.bpm)&&first?.bpm){song.bpm=first.bpm;song.soflan=!!first.soflan;}
  if(!song.genre&&input.genre)song.genre=input.genre;
  const oldHint=hintsById.get(id);
  songs.set(id,rememberSongNames(song,...(old?[{...old,title:input.title,artist:input.artist}]:[]),...(oldHint?[oldHint]:[])));
  if(input.version&&!seriesNames[input.version])seriesNames[input.version]=builtInSeriesNames[input.version]??`IIDX ${input.version}`;
  if(old)updatedSongs++;else addedSongs++;
  if(examples.length<12)examples.push({title:input.title,kind:old?'更新':'追加',charts:input.charts.length});
  for(const item of input.charts){
   const chartId=`${id}:${item.mode}:${item.difficulty}`,oldChart=charts.get(chartId);
   const chart:Chart={...(oldChart??{id:chartId,songId:id,mode:item.mode,difficulty:item.difficulty,level:0,unofficialRatings:{}}),supplementBase:oldChart?.supplementBase===undefined?oldChart??null:oldChart.supplementBase};
   if(!chart.level&&item.level)chart.level=item.level;
   if(!knownBpm(chart.bpm)&&knownBpm(item.bpm)){chart.bpm=item.bpm;chart.soflan=item.soflan;}
   if(chart.noteCount==null&&item.noteCount!=null)chart.noteCount=item.noteCount;
   const values=axes.map((_,i)=>chart.radar?.values[i]??item.radarValues?.[i]??null) as RadarValues;
   if(values.some(value=>value!==null))chart.radar={values,notes:chart.noteCount??chart.radar?.notes??0};
   const features={...chart.importedInfo?.features};
   for(const key of ['CN','HCN','BSS','MSS'] as const)if(features[key]==null&&item.features?.[key]!=null)features[key]=item.features[key];
   const availability=chart.importedInfo?.arcadeAvailability??item.arcadeAvailability;
   if(Object.keys(features).length||availability)chart.importedInfo={level:chart.level,...chart.importedInfo,...(Object.keys(features).length?{features}:{}),...(availability?{arcadeAvailability:availability}:{}),importedAt:chart.importedInfo?.importedAt??now};
   charts.set(chartId,chart);if(oldChart)updatedCharts++;else addedCharts++;acceptedCharts++;
  }
 }
 return {catalog:recount({...base,seriesNames,songs:[...songs.values()],charts:[...charts.values()],songIdentities:{links:{...base.songIdentities?.links},redirects}}),updatedSongs,addedSongs,updatedCharts,addedCharts,acceptedCharts,issues,examples};
}

export async function fetchCatalogImportText(input:string,signal:AbortSignal,onProgress:(bytes:number)=>void=()=>{},fetcher:typeof fetch=fetch){
 const url=normalizeCatalogImportUrl(input),response=await fetcher(url,{signal,credentials:'omit',mode:'cors',cache:'no-cache',referrerPolicy:'no-referrer'});
 if(!response.ok)throw new Error(`JSONを取得できませんでした（HTTP ${response.status}）。公開URLを確認してください。`);
 if(Number(response.headers.get('content-length'))>CATALOG_IMPORT_MAX_BYTES)throw new Error('JSONは32MB以下のファイルを選んでください。');
 const reader=response.body?.getReader();if(!reader)throw new Error('取得したファイルを読み取れませんでした。ファイル選択をお試しください。');
 const decoder=new TextDecoder('utf-8',{fatal:true}),parts:string[]=[];let bytes=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>CATALOG_IMPORT_MAX_BYTES)throw new Error('JSONは32MB以下のファイルを選んでください。');parts.push(decoder.decode(value,{stream:true}));onProgress(bytes);}parts.push(decoder.decode());}
 catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
 return {text:parts.join(''),url};
}

export function reconcileStoredCatalog(catalog:Catalog):Catalog{return applySavedSupplement(reconcileSongIdentities(stripSupplement(catalog)!),catalog.songs);}
