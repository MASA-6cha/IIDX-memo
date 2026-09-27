import {type Catalog,type Song} from '@/lib/iidx-data';
import {songTitleOrigin} from '@/lib/catalog-title-debug';

export function CatalogTitleSource({song,catalog}:{song:Song;catalog:Catalog|null}){
 const origin=songTitleOrigin(song,catalog);
 return <span className="track-title-source" aria-label="曲名の取得元">
  <span>曲名元：{origin.name}{origin.inferred?'（推定）':''}</span>
  <span title={origin.url}>{origin.label}</span>
  <span>ID：{song.id} / 元ID：{origin.sourceId}</span>{song.publicId&&<span>通常DB ID：{song.publicId}</span>}{!!song.nameAliases?.length&&<span>別名：{Array.from(new Set(song.nameAliases.map(name=>name.title))).join(' / ')}</span>}
 </span>;
}
