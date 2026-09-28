import bundledIdentities from './song-identities.json';
import {z} from 'zod';
import {seriesNames as builtInSeriesNames,type Catalog,type Chart,type Song,type ImportedChartInfo} from './iidx-data';
import {officialPlayTitleAliases,playTitleFormatKey} from './play-title';

export const identityStateSchema=z.object({
 links:z.record(z.string().regex(/^[1-9]\d{0,8}$/),z.string().regex(/^idt-\d{1,12}$/)),
 redirects:z.record(z.string().min(1).max(160).regex(/^[^:\s]+$/),z.string().min(1).max(160).regex(/^[^:\s]+$/)),
}).strict();
export type SongIdentities=z.infer<typeof identityStateSchema>;
const bundledLinks:Record<string,string>=Object.fromEntries(bundledIdentities.links.map(row=>[String(row.music_id),row.song_key.replace('iidx-data-table:','idt-')]));
export const identityPublicId=(musicId:number,catalog:Catalog)=>catalog.songIdentities?.links[String(musicId)]??bundledLinks[String(musicId)];
export const publicSongId=(song:Song)=>song.publicId??(/^idt-\d+$/.test(song.id)?song.id:undefined);
// The exporter encodes the debut series in the first two digits of a five-digit music_id.
// Other ID formats have no guaranteed series encoding.
export function seriesFromMusicId(musicId:number):number|null{
 if(!Number.isInteger(musicId)||musicId<10000||musicId>99999)return null;
 const series=Math.floor(musicId/1000);
 return series>=1&&series<=99?series:null;
}
export function songNames(song:Song){
 const names=[{title:song.title,artist:song.artist},...(song.nameAliases??[]),...(officialPlayTitleAliases[publicSongId(song)??song.id]??[]).map(title=>({title,artist:song.artist}))];
 return [...new Map(names.map(name=>[JSON.stringify(name),name])).values()];
}
const key=(name:{title:string;artist:string})=>JSON.stringify([playTitleFormatKey(name.title),playTitleFormatKey(name.artist)]);
export function resolveSongId(id:string,redirects:Record<string,string>={}){const seen=new Set<string>();while(redirects[id]&&!seen.has(id)){seen.add(id);id=redirects[id];}return id;}
export function resolveChartId(id:string,redirects:Record<string,string>={}){const [song,...rest]=id.split(':');return [resolveSongId(song,redirects),...rest].join(':');}
export function rememberSongNames(song:Song,...sources:Song[]):Song{
 const names=sources.flatMap(songNames);
 return {...song,nameAliases:[...new Map(names.map(name=>[JSON.stringify(name),name])).values()].filter(name=>name.title!==song.title||name.artist!==song.artist)};
}
export function applyAnalyzedChart(chart:Chart,info:ImportedChartInfo):Chart{
 const result={...chart,level:info.level??chart.level,importedInfo:info};
 if(info.bpm!==undefined)result.bpm=info.bpm;if(info.soflan!==undefined)result.soflan=info.soflan;
 if(info.noteCount!==undefined)result.noteCount=info.noteCount;
 if(info.radarValues!==undefined)result.radar=info.radarValues===null?null:{values:info.radarValues,notes:result.noteCount??0};
 return result;
}
function combineSongs(group:Song[],id:string):Song{
 const publicSong=group.find(song=>publicSongId(song)),latest=group.filter(song=>song.importedInfo).sort((a,b)=>b.importedInfo!.importedAt.localeCompare(a.importedInfo!.importedAt))[0];
 const base=publicSong??group[0],info=latest?.importedInfo;
 const inferred=info?seriesFromMusicId(info.musicId):null;
 const result:Song={...base,id,...(base.series===-2&&inferred!==null?{series:inferred}:{}),...(publicSong?{publicId:publicSongId(publicSong)}:{}),...(info?{title:info.title,artist:info.artist,importedInfo:info,bpm:latest!.bpm,soflan:latest!.soflan,...(info.genre!==undefined?{genre:info.genre}:{})}:{}),...(publicSong?{availabilityUnknown:false}:{})};
 return rememberSongNames(result,...group);
}
// Titles help establish a unique correspondence once. Later refreshes use IDs.
// Different music IDs, multiple public IDs and ambiguous names are never merged.
export function reconcileSongIdentities(catalog:Catalog):Catalog{
 const links={...bundledLinks,...catalog.songIdentities?.links},redirects={...catalog.songIdentities?.redirects};
 const sameId=new Map<string,Song[]>();for(const s of catalog.songs)sameId.set(s.id,[...(sameId.get(s.id)??[]),s]);
 const songs=[...sameId].map(([id,group])=>combineSongs(group,id)),byId=new Map(songs.map(s=>[s.id,s]));
 const parent=new Map(songs.map(s=>[s.id,s.id])),issues=new Set<string>();
 const root=(id:string):string=>{let next=parent.get(id)!;while(next!==parent.get(next))next=parent.get(next)!;return next;};
 const members=(id:string)=>songs.filter(s=>root(s.id)===root(id));
 const join=(a:Song,b:Song)=>{
  if(root(a.id)===root(b.id))return;
  const group=[...members(a.id),...members(b.id)],music=new Set(group.flatMap(s=>s.importedInfo?[s.importedInfo.musicId]:[])),pub=new Set(group.flatMap(s=>publicSongId(s)?[publicSongId(s)!]:[]));
  if(music.size>1||pub.size>1){issues.add(`${a.title} / ${b.title}：曲IDの対応が競合しています`);return;}
  parent.set(root(b.id),root(a.id));
 };
 const musicIndex=new Map<number,Song[]>(),publicIndex=new Map<string,Song[]>(),names=new Map<string,Song[]>();
 const add=<K>(index:Map<K,Song[]>,k:K,s:Song)=>{const list=index.get(k)??[];if(!list.includes(s))index.set(k,[...list,s]);};
 for(const s of songs){if(s.importedInfo)add(musicIndex,s.importedInfo.musicId,s);const pub=publicSongId(s);if(pub)add(publicIndex,pub,s);for(const name of songNames(s))add(names,key(name),s);}
 for(const group of [...musicIndex.values(),...publicIndex.values()])for(const s of group.slice(1))join(group[0],s);
 for(const [music,pub] of Object.entries(links))for(const a of musicIndex.get(Number(music))??[])for(const b of publicIndex.get(pub)??[]){if(publicSongId(a)&&publicSongId(a)!==pub)issues.add(`${a.title}：保存された曲ID対応が競合しています`);else join(a,b);}
 const choices=new Map<string,Song[]>();
 for(const s of songs.filter(s=>s.importedInfo&&!publicSongId(s))){
  if(links[String(s.importedInfo!.musicId)])continue;
  const candidates=[...new Map(songNames(s).flatMap(name=>names.get(key(name))??[]).filter(other=>publicSongId(other)&&(!other.importedInfo||other.importedInfo.musicId===s.importedInfo!.musicId)).map(other=>[other.id,other])).values()];
  choices.set(s.id,candidates);
 }
 for(const [id,candidates] of choices){
  const s=byId.get(id)!;
  if(candidates.length===1){const candidate=candidates[0],claimants=[...choices].filter(([,list])=>list.some(x=>x.id===candidate.id));if(claimants.length===1)join(s,candidate);else issues.add(`${s.title}：同じ通常DB曲に複数の解析曲が対応します`);}
  else if(candidates.length>1)issues.add(`${s.title}：対応候補が複数あります`);
 }
 const groups=new Map<string,Song[]>();for(const s of songs){const id=root(s.id);groups.set(id,[...(groups.get(id)??[]),s]);}
 const result:Song[]=[];
 for(const group of groups.values()){
  // Keep an established analyzed identity, including arcade-* IDs already in use.
  const preferred=group.find(s=>s.importedInfo),id=preferred?.id??group[0].id,song=combineSongs(group,id);
  result.push(song);for(const s of group)if(s.id!==id)redirects[s.id]=id;
  const pub=publicSongId(song);if(pub&&song.importedInfo){const music=String(song.importedInfo.musicId);if(!links[music]||links[music]===pub)links[music]=pub;else issues.add(`${song.title}：保存された曲ID対応が競合しています`);}
 }
 for(const id of Object.keys(redirects)){redirects[id]=resolveSongId(redirects[id],redirects);if(id===redirects[id])delete redirects[id];}
 const chartGroups=new Map<string,Chart[]>();for(const chart of catalog.charts){const id=resolveChartId(chart.id,redirects);chartGroups.set(id,[...(chartGroups.get(id)??[]),chart]);}
 const charts=[...chartGroups].map(([id,group])=>{
  // Incoming public data is first; refresh ratings independently of analyzed fields.
  const base=group.find(c=>!c.importedInfo)??group[0],community=group.find(c=>c.community)?.community;
  let chart:Chart={...base,id,songId:id.split(':')[0],...(community?{community}:{})};
  for(const c of group.filter(c=>c.importedInfo).sort((a,b)=>a.importedInfo!.importedAt.localeCompare(b.importedInfo!.importedAt)))chart=applyAnalyzedChart(chart,{...chart.importedInfo,...c.importedInfo!});
  return chart;
 });
 const seriesNames={...catalog.seriesNames};
 for(const song of result)if(song.series>0&&!seriesNames[song.series])seriesNames[song.series]=builtInSeriesNames[song.series]??`IIDX ${song.series}`;
 return {...catalog,seriesNames,songs:result,charts,songIdentities:{links:Object.fromEntries(Object.entries(links).filter(([music])=>musicIndex.has(Number(music))||Object.hasOwn(catalog.songIdentities?.links??{},music))),redirects},identityIssues:[...issues]};
}
