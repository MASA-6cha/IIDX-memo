import {type Catalog,type Song} from './iidx-data';

export function songTitleOrigin(song:Song,catalog:Catalog|null){
 if(song.importedInfo){
  const info=song.importedInfo;
  return {name:'解析JSON（iidx info exporter）',label:info.origin?.label??'旧データ：URL・ファイル名は未記録',url:info.origin?.url,sourceId:String(info.musicId),inferred:false};
 }
 if(song.titleSource){const source=song.titleSource;return {name:source.kind==='public'?'IIDX Data Table / TexTage':source.kind==='wiki'?'BEMANIWiki（IIDX34）':'手入力の補完JSON',label:source.label,url:source.url,sourceId:source.sourceId,inferred:false};}
 if(song.supplementBase===null){const saved=catalog?.supplementData;return {name:'手入力の補完JSON',label:saved?.origin.label??'取得元の詳細は未記録',url:saved?.origin.url,sourceId:song.id,inferred:true};}
 if(!catalog)return {name:'アプリ内サンプル',label:'初期表示用データ',sourceId:song.id,inferred:false};
 if(song.id.startsWith('idt-'))return {name:'IIDX Data Table / TexTage',label:'旧データ：既存情報から推定',sourceId:song.id.slice(4),inferred:true};
 return {name:'取得元不明',label:'旧データに取得元の記録がありません',sourceId:song.id,inferred:true};
}
