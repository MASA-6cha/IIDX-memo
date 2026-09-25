import {collectPlayPages,formatPlayCharts,parsePlayPage,displayedPlayMode,playDiagnostic} from './play-scraper';
import {playImporterVersion} from './play-format';
import {sendPlayHandoff} from './play-handoff';
import type {Mode} from './iidx-data';

export function showPlayImporter(doc:Document,version:number){
 if(doc.getElementById('iidx-memo-importer'))return;
 const host=doc.createElement('div');host.id='iidx-memo-importer';host.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#000a;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box';
 const root=host.attachShadow({mode:'open'});
 root.innerHTML=`<style>*{box-sizing:border-box}section{font:16px/1.6 -apple-system,BlinkMacSystemFont,sans-serif;color:#edf2fb;background:#192331;padding:20px;border:1px solid #40516a;border-radius:16px;width:440px;max-width:calc(100vw - 24px);max-height:88vh;max-height:88dvh;overflow:auto}h2{font-size:21px;margin:0}p{margin:12px 0;color:#b9c8dc}button,select{font:inherit;border-radius:8px;padding:10px 12px;border:1px solid #40516a;cursor:pointer;color:#edf2fb;background:#233146}button{min-height:44px}button:disabled{opacity:.5}#start,#copy{background:#77e5d2;color:#103c36;font-weight:700}label{display:block;margin:12px 0}select{width:100%;margin-top:5px}header{display:flex;align-items:center;justify-content:space-between;gap:16px}#status{white-space:pre-line}textarea{display:block;width:100%;height:110px;margin:12px 0;font:14px/1.5 monospace;background:#111a26;color:#edf2fb;border:1px solid #40516a;border-radius:8px;padding:10px}.actions{display:flex;gap:10px;flex-wrap:wrap}[hidden]{display:none!important}small{font-size:13px;color:#b9c8dc}details{border-top:1px solid #40516a;margin-top:14px}summary{padding:10px 0;cursor:pointer;min-height:44px}</style>
 <section role="dialog" aria-modal="true" aria-label="IIDX memo データ取得">
 <header><div><h2>IIDX memo</h2><small>取得ツール v${playImporterVersion}</small></div><button id="close" aria-label="閉じる">閉じる</button></header>
 <p>CLEAR TYPE・DJ LEVEL・スコアを取得します。</p>
 <label>取得するモード<select id="mode"><option value="SP">SP</option><option value="DP">DP</option><option value="both">SP・DP 両方</option></select></label>
 <label>取得する範囲<select id="range"><option value="all">全難度（☆1〜12）</option><option value="high">☆11・12のみ</option></select></label>
 <div class="actions"><button id="start">取得開始</button><button id="cancel" hidden>中止</button></div>
 <p id="status" role="status">取得中はこの画面を開いたままにしてください。</p>
 <div id="result" hidden><p><strong>同じブラウザでIIDX memoを使っている場合</strong></p><div class="actions"><button id="send">アプリへ渡す（ブラウザ版）</button></div><p>新しいタブで取り込み内容を確認できます。まだ保存はされません。</p><p><strong>ホーム画面からIIDX memoを使っている場合</strong></p><div class="actions"><button id="copy">結果をコピー</button></div><p>コピー後にホーム画面版へ戻り、全体設定の「貼り付けて確認」を押してください。ブラウザ版と保存先が異なる場合があります。</p><details><summary>取得結果を表示・手動でコピー</summary><textarea id="output" aria-label="取得したプレイデータ" readonly></textarea><button id="select">すべて選択</button></details></div>
 <details id="current-help"><summary>表示中のページだけ取得</summary><p>いま開いている一覧を直接読み取ります。別のページ・別の難度の曲は含まれません。画面と同じSP・DPを選んでください。</p><button id="current">このページを読み取る</button></details>
 <details id="diagnostic" hidden><summary>エラーの診断情報</summary><p>表の構造を表示します。下の「診断情報をコピー」の内容を問い合わせ時に貼り付けてください。曲名・スコア・ログイン情報は含めず、自動送信もしません。</p><textarea id="diagnostic-output" aria-label="診断情報" readonly></textarea><button id="diagnostic-copy">診断情報をコピー</button></details>
 </section>`;
 doc.documentElement.appendChild(host);
 const el=<T=HTMLElement>(id:string)=>root.getElementById(id) as T;
 const mode=el<HTMLSelectElement>('mode'),range=el<HTMLSelectElement>('range'),start=el<HTMLButtonElement>('start'),current=el<HTMLButtonElement>('current'),cancel=el<HTMLButtonElement>('cancel'),status=el('status'),output=el<HTMLTextAreaElement>('output'),result=el('result'),diagnostic=el<HTMLDetailsElement>('diagnostic'),diagnosticOutput=el<HTMLTextAreaElement>('diagnostic-output');
 mode.value=displayedPlayMode(doc)??'SP';
 let controller:AbortController|undefined,running=false,stage='',stopHandoff:(()=>void)|undefined;
 const send=el<HTMLButtonElement>('send');send.style.cssText='background:#77e5d2;color:#103c36;font-weight:700';
 el('close').onclick=()=>{controller?.abort();stopHandoff?.();host.remove();};cancel.onclick=()=>controller?.abort();
 const select=(field:HTMLTextAreaElement)=>{const details=field.closest('details');if(details)details.open=true;field.focus();field.select();field.setSelectionRange(0,field.value.length);};
 const copy=async(field:HTMLTextAreaElement,message:string)=>{try{await navigator.clipboard.writeText(field.value);status.textContent=message;}catch{select(field);status.textContent='テキストを選択しました。長押しのメニューからコピーしてください。';}};
 el('select').onclick=()=>{select(output);status.textContent='すべて選択しました。端末のメニューからコピーできます。';};
 el('copy').onclick=()=>void copy(output,'コピーしました。普段使っているIIDX memoに戻り、全体設定の「貼り付けて確認」を押してください。');
 send.onclick=()=>{
  stopHandoff?.();
  stopHandoff=sendPlayHandoff(doc.defaultView!,output.value,phase=>{
   send.disabled=phase==='waiting';
   status.textContent=phase==='waiting'?'このブラウザのIIDX memoへ渡しています。新しいタブが開いたら、そのままお待ちください。':phase==='received'?'アプリに渡しました。取り込み内容を確認し、「保存」を押してください。':phase==='invalid'?'アプリで結果を確認できませんでした。「結果をコピー」で取り込みをお試しください。':'直接渡せませんでした。「結果をコピー」を押し、IIDX memoの「貼り付けて確認」を使ってください。';
  });
 };
 el('diagnostic-copy').onclick=()=>void copy(diagnosticOutput,'診断情報をコピーしました。問い合わせ時に貼り付けてください。');
 const reset=()=>{stopHandoff?.();send.disabled=false;result.hidden=true;output.value='';diagnostic.hidden=true;diagnosticOutput.value='';};
 const showError=(error:unknown)=>{status.textContent=`${stage}\n${error instanceof Error?error.message:'取得できませんでした。'}\n診断情報を下に表示しました。`;diagnosticOutput.value=playDiagnostic(error,stage,doc);diagnostic.hidden=false;diagnostic.open=true;el<HTMLDetailsElement>('current-help').open=true;};
 current.onclick=()=>{
  if(running)return;reset();stage='表示中のページ';
  try{
   if(mode.value==='both')throw new Error('画面と同じSP・DPを選んでください。');
   const page=parsePlayPage(doc,mode.value as Mode),data=formatPlayCharts(page.charts.map(c=>({...c,mode:mode.value as Mode})),version);
   output.value=data.csv;result.hidden=false;status.textContent=`このページの${mode.value} ${data.count}譜面を読み取りました。全曲取得ではありません。下のボタンでアプリへ渡してください。`;
  }catch(error){showError(error);}
 };
 start.onclick=async()=>{
  if(running)return;running=true;controller=new AbortController();reset();start.disabled=true;current.disabled=true;mode.disabled=true;range.disabled=true;cancel.hidden=false;
  try{const data=await collectPlayPages({modes:mode.value==='both'?['SP','DP']:[mode.value as Mode],levels:range.value==='all'?Array.from({length:12},(_,i)=>i+1):[11,12],version,signal:controller.signal,onProgress:v=>{stage=v;status.textContent=v;}});output.value=data.csv;result.hidden=false;status.textContent=`選択範囲の${data.count}譜面を取得しました。下のボタンでアプリへ渡してください。`;}
  catch(error){if(controller.signal.aborted)status.textContent='取得を中止しました。途中のデータはコピーしていません。';else showError(error);}
  finally{running=false;start.disabled=false;current.disabled=false;mode.disabled=false;range.disabled=false;cancel.hidden=true;}
 };
 start.focus();
}
