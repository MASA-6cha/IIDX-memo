// Score table selectors and request parameters adapted from BPIM2's MIT-licensed
// IIDX-Scraping-Bookmarklet. See public/licenses/iidx-scraping-bookmarklet.txt.
import {playCsvHeaders} from './play-format';
import type {Mode} from './iidx-data';
import {parsePlayPage,type ScrapedChart,type ScrapedPage} from './play-page';
export {parsePlayPage,PlayReadError,playDiagnostic,displayedPlayMode} from './play-page';
export type {ScrapedChart,ScrapedPage} from './play-page';
type PageRequest={mode:Mode;level:number;offset:number;version:number;signal:AbortSignal};
export async function fetchPlayPage({mode,level,offset,version,signal}:PageRequest):Promise<ScrapedPage>{
 const controller=new AbortController(),abort=()=>controller.abort();signal.addEventListener('abort',abort,{once:true});if(signal.aborted)controller.abort();
 const timeout=setTimeout(abort,30000);
 try{
  const path=`https://p.eagate.573.jp/game/2dx/${version}/djdata/music/difficulty.html`;
  const body=new URLSearchParams({difficult:String(level-1),style:mode==='SP'?'0':'1',disp:'1'});if(offset)body.set('offset',String(offset));
  const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,credentials:'include',signal:controller.signal});
  if(!response.ok)throw new Error(`公式サイトの取得に失敗しました（${response.status}）。`);
  if(response.url&&new URL(response.url).pathname!==new URL(path).pathname)throw new Error('公式サイトのログイン状態を確認してください。');
  return parsePlayPage(new DOMParser().parseFromString(await response.text(),'text/html'),mode,level);
 }catch(error){if(controller.signal.aborted)throw new Error(signal.aborted?'取得を中止しました。':'通信が時間内に完了しませんでした。もう一度お試しください。');throw error;}
 finally{clearTimeout(timeout);signal.removeEventListener('abort',abort);}
}
export function waitForPage(signal:AbortSignal){return new Promise<void>((resolve,reject)=>{
 const abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(new Error('取得を中止しました。'));};
 const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},500);signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
});}
export async function collectPlayPages({modes,levels,version,signal,onProgress}:{modes:Mode[];levels:number[];version:number;signal:AbortSignal;onProgress:(message:string)=>void},readPage=fetchPlayPage,pause=waitForPage){
 const rows:(ScrapedChart&{mode:Mode})[]=[],seen=new Set<string>();
 for(const mode of modes)for(const level of levels){
  let ended=false;
  for(let page=0;page<100;page++){
   if(signal.aborted)throw new Error('取得を中止しました。');
   onProgress(`${mode} ☆${level} · ${page+1}ページ / ${rows.length}譜面を確認`);
   await pause(signal);
   const result=await readPage({mode,level,offset:page*50,version,signal});
   if(!result.charts.length){ended=true;break;}
   for(const chart of result.charts){
    // The official link index restarts on every page; use chart identity instead.
    const key=JSON.stringify([mode,level,chart.title,chart.difficulty]);
    if(seen.has(key))throw new Error('同じ譜面が繰り返し返されました。未完了のためコピーは作成していません。');
    seen.add(key);rows.push({...chart,mode});
   }
   if(rows.length>25000)throw new Error('取得件数が上限を超えました。');
   if(result.hasNext===false){ended=true;break;}
  }
  if(!ended)throw new Error('取得を完了できませんでした。公式サイトのページ送りを確認してください。');
 }
 if(signal.aborted)throw new Error('取得を中止しました。');
 if(!rows.length)throw new Error('プレイデータがありませんでした。公式サイトで参照中のe-amusement passを確認してください。');
 return formatPlayCharts(rows,version);
}
export function formatPlayCharts(rows:(ScrapedChart&{mode:Mode})[],version:number){
 if(!rows.length)throw new Error('このページには取り込める譜面がありません。');
 const now=new Date().toISOString(),escape=(v:string)=>/[",\r\n]/.test(v)?`"${v.replace(/"/g,'""')}"`:v;
 const csv=[playCsvHeaders,...rows.map(r=>[r.mode,r.title,r.difficulty,String(r.level),r.exScore,r.pgreat,r.great,r.lamp,r.djLevel,String(version),now])].map(r=>r.map(escape).join(',')).join('\r\n');
 return {csv,count:rows.length};
}
