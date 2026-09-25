import {type AppState,type Catalog,initialState} from './iidx-data';
import {isStoredCatalog} from './iidx-catalog';
import {commonNumbersSchema} from './common-numbers';
import {manualChartsSchema} from './manual-chart';
import {playDataSchema} from './play-data';
let pendingDb:Promise<IDBDatabase>|undefined;
function openDb(){
 if(!pendingDb)pendingDb=new Promise<IDBDatabase>((resolve,reject)=>{
  const r=indexedDB.open('iidx-option-notes',1);
  r.onupgradeneeded=()=>r.result.createObjectStore('app');
  r.onsuccess=()=>{const db=r.result;db.onversionchange=()=>{db.close();pendingDb=undefined;};resolve(db);};
  r.onerror=()=>{pendingDb=undefined;reject(r.error);};
  r.onblocked=()=>reject(new Error('別のタブを閉じて、もう一度開いてください。'));
 });
 return pendingDb;
}
export async function readLibrary():Promise<{state:AppState;catalog:Catalog|null}>{
 const db=await openDb();return new Promise((resolve,reject)=>{
  const t=db.transaction('app','readonly'),store=t.objectStore('app');
  const stateRequest=store.get('state'),catalogRequest=store.get('catalog');
  t.oncomplete=()=>{
   const state=stateRequest.result??initialState(),catalog=catalogRequest.result??null;
   if(state.schemaVersion!==1||!state.notes||!Array.isArray(state.folders)||state.folders.length!==5){reject(new Error('保存データを読み込めませんでした。'));return;}
   if(state.playData&&!playDataSchema.safeParse(state.playData).success){reject(new Error('プレイデータを読み込めませんでした。'));return;}
   if(state.liftVisibility&&(typeof state.liftVisibility.SP!=='boolean'||typeof state.liftVisibility.DP!=='boolean')){reject(new Error('LIFTの表示設定を読み込めませんでした。'));return;}
   if(state.commonNumbers&&!commonNumbersSchema.safeParse(state.commonNumbers).success){reject(new Error('共通の緑数字・白数字を読み込めませんでした。'));return;}
   if(state.manualCharts&&!manualChartsSchema.safeParse(state.manualCharts).success){reject(new Error('手入力の譜面データを読み込めませんでした。'));return;}
   if(catalog&&!isStoredCatalog(catalog)){reject(new Error('保存された楽曲DBを読み込めませんでした。'));return;}
   resolve({state,catalog});
  };
  t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error??new Error('読み込みが中断されました。'));
 });
}
export async function readState():Promise<AppState>{return (await readLibrary()).state;}
export async function writeState(s:AppState,catalog?:Catalog){const db=await openDb();return new Promise<void>((resolve,reject)=>{const t=db.transaction('app','readwrite');t.objectStore('app').put(s,'state');if(catalog)t.objectStore('app').put(catalog,'catalog');t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error??new Error('保存が中断されました。'));});}

// Serialized payload sizes are a reference breakdown, not IndexedDB disk allocation.
export async function readStoredSizes(){
 const db=await openDb();return new Promise<{catalog:number;state:number;other:number}>((resolve,reject)=>{
  const sizes={catalog:0,state:0,other:0},t=db.transaction('app','readonly'),cursor=t.objectStore('app').openCursor();
  cursor.onsuccess=()=>{const row=cursor.result;if(!row)return;const key=row.key==='catalog'?'catalog':row.key==='state'?'state':'other';sizes[key]+=new Blob([JSON.stringify(row.value),String(row.key)]).size;row.continue();};
  t.oncomplete=()=>resolve(sizes);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error??new Error('容量を読み取れませんでした。'));
 });
}
