import {type Folder,type Chart} from './iidx-data';
export type FavoriteScope='song'|'chart';
export const isFavorite=(folder:Folder,chart:Pick<Chart,'id'|'songId'>)=>folder.songIds.includes(chart.songId)||(folder.chartIds??[]).includes(chart.id);
export function toggleFavoriteEntry(folder:Folder,scope:FavoriteScope,id:string):Folder{
 const key=scope==='song'?'songIds':'chartIds',ids=folder[key]??[];
 return {...folder,[key]:ids.includes(id)?ids.filter(value=>value!==id):[...ids,id]};
}
export function addFavoriteFolder(folders:Folder[],name:string,id:string):Folder[]{
 const trimmed=name.trim();if(!trimmed||trimmed.length>20)throw new Error('フォルダー名を1〜20文字で入力してください。');
 if(folders.length>=100)throw new Error('フォルダーは100個まで追加できます。');
 if(folders.some(folder=>folder.id===id))throw new Error('フォルダーIDが重複しています。');
 const colors=['#efd170','#77ecd3','#f59a67','#aab1ff','#ed9bc9'];
 return [...folders,{id,name:trimmed,color:colors[folders.length%colors.length],songIds:[],chartIds:[]}];
}
