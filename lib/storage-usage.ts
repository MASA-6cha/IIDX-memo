import {readStoredSizes} from './iidx-storage';

export type UsageReport={app:number|null;catalog:number|null;state:number|null;settings:number|null;other:number|null;browserUsage:number|null;quota:number|null;cacheVersions:number|null};

export function formatBytes(bytes:number|null){
 if(bytes===null)return '取得できません';
 if(bytes===0)return '0 B';
 const units=['B','KB','MB','GB'],index=Math.min(3,Math.floor(Math.log(Math.max(1,bytes))/Math.log(1024)));
 return `${(bytes/1024**index).toLocaleString('ja-JP',{maximumFractionDigits:index?2:0})} ${units[index]}`;
}
export function usageTotal(report:UsageReport){
 const parts=[report.app,report.catalog,report.state,report.settings,report.other],known=parts.filter((n):n is number=>n!==null);
 return {bytes:known.length?known.reduce((sum,n)=>sum+n,0):null,complete:known.length===parts.length};
}
async function cacheUsage(){
 if(typeof caches==='undefined')throw new Error('Cache API unavailable');
 const names=(await caches.keys()).filter(name=>name.startsWith('iidx-app-'));let bytes=0;
 // Include installed, waiting and retained app versions; reading never downloads or deletes files.
 for(const name of names){const cache=await caches.open(name);for(const request of await cache.keys()){
  const response=await cache.match(request);if(!response||response.type==='opaque')throw new Error('Unreadable cache');
  bytes+=(await response.blob()).size;
 }}
 return {bytes,versions:names.length};
}
function settingsUsage(){
 let bytes=0;for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith('iidx-option-notes'))bytes+=2*(key.length+(localStorage.getItem(key)?.length??0));}
 return bytes;
}
const finiteSize=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0?n:null;
export async function measureStorage():Promise<UsageReport>{
 const [app,data,settings,browser]=await Promise.allSettled([
  cacheUsage(),readStoredSizes(),Promise.resolve().then(settingsUsage),
  Promise.resolve().then(()=>navigator.storage?.estimate?.()),
 ]);
 return {
  app:app.status==='fulfilled'?app.value.bytes:null,cacheVersions:app.status==='fulfilled'?app.value.versions:null,
  catalog:data.status==='fulfilled'?data.value.catalog:null,state:data.status==='fulfilled'?data.value.state:null,other:data.status==='fulfilled'?data.value.other:null,
  settings:settings.status==='fulfilled'?settings.value:null,
  browserUsage:browser.status==='fulfilled'?finiteSize(browser.value?.usage):null,quota:browser.status==='fulfilled'?finiteSize(browser.value?.quota):null,
 };
}
