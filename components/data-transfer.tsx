"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowDownToLine,ArrowUpFromLine,Check,Copy,Loader2,NotebookPen} from 'lucide-react';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {Textarea} from '@/components/ui/textarea';
import {AlertDialog,AlertDialogContent,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {backupCounts,makeBackup,parseBackup,type Backup} from '@/lib/iidx-backup';
import {type AppState,type Chart} from '@/lib/iidx-data';
import {canonicalChartId} from '@/lib/iidx-catalog';

export function DataTransfer({state,charts,disabled,dirty,onRestore}:{state:AppState;charts:Chart[];disabled:boolean;dirty:boolean;onRestore:(s:AppState)=>Promise<void>}){
 const knownNoteKeys=useMemo(()=>new Set(charts.flatMap(c=>c.mode==='SP'?[`${c.id}:1P`,`${c.id}:2P`]:[c.id])),[charts]);
 const [tab,setTab]=useState('export');
 const [exportText,setExportText]=useState(''),[input,setInput]=useState('');
 const [preview,setPreview]=useState<Backup|null>(null),[confirm,setConfirm]=useState(false);
 const [error,setError]=useState(''),[status,setStatus]=useState(''),[restoring,setRestoring]=useState(false);
 const exportField=useRef<HTMLTextAreaElement>(null);
 useEffect(()=>{setExportText('');},[state]);
 const counts=backupCounts(state),incoming=preview?backupCounts(preview.data):null;
 const unknownCount=preview?Object.keys(preview.data.notes).filter(key=>!knownNoteKeys.has(key)&&!knownNoteKeys.has(canonicalChartId(key))).length:0;
 const selectText=()=>{const el=exportField.current;if(el){el.focus();el.select();el.setSelectionRange(0,el.value.length);}};
 const copy=async()=>{
  try{if(!navigator.clipboard?.writeText)throw new Error();await navigator.clipboard.writeText(exportText);setStatus('コピーしました。「メモ」アプリを開いて貼り付けてください。');}
  catch{selectText();setStatus('自動コピーができませんでした。選択したテキストを長押しし、「コピー」を選んでください。');}
 };
 const inspect=()=>{
  setStatus('');setError('');setPreview(null);
  try{setPreview(parseBackup(input));}catch(e){setError(e instanceof Error?e.message:'読み取れませんでした。');}
 };
 const restore=async()=>{
  if(!preview||disabled||dirty||restoring)return;
  setRestoring(true);setError('');
  try{await onRestore(preview.data);setConfirm(false);setStatus(`${backupCounts(preview.data).total}件の設定と、お気に入り・プレイデータ・全体設定を復元しました。`);setPreview(null);setInput('');}
  catch(e){setError(e instanceof Error?e.message:'保存できませんでした。もう一度お試しください。');}
  finally{setRestoring(false);}
 };
 return <section className="data-transfer">
  <h3><NotebookPen size={17}/>データ移行・バックアップ</h3>
  <p className="transfer-intro">保存済み設定 {counts.total}件。SP両サイド・DPのオプション、コメント、お気に入り5種類、プレイデータ {counts.scores}譜面（シリーズ別の履歴を含む）、手入力の譜面データ {counts.manualCharts}譜面、全体設定をまとめて移せます。</p>
  <Tabs value={tab} onValueChange={v=>{setTab(v);setStatus('');setError('');}}><TabsList aria-label="データ移行の操作"><TabsTrigger value="export">エクスポート</TabsTrigger><TabsTrigger value="import">インポート</TabsTrigger></TabsList></Tabs>
  {tab==='export'?<div className="transfer-panel">
   {dirty&&<p className="transfer-notice">編集中の未保存の変更は含まれません。必要な変更は先に保存してください。</p>}
   <button className="secondary-button" disabled={disabled} onClick={()=>{setExportText(makeBackup(state));setStatus('');setError('');}}><ArrowUpFromLine size={16}/>{exportText?'テキストを作り直す':'テキストを作成'}</button>
   {exportText&&<><label className="field-label" htmlFor="backup-export">バックアップ用テキスト</label><Textarea ref={exportField} id="backup-export" value={exportText} readOnly spellCheck={false} autoCapitalize="off" className="transfer-textarea"/><div className="transfer-actions"><button className="save-button" onClick={()=>void copy()}><Copy size={16}/>コピー</button><button className="secondary-button" onClick={()=>{selectText();setStatus('すべて選択しました。端末のメニューからコピーできます。');}}>すべて選択</button></div></>}
  </div>:<div className="transfer-panel">
   <label className="field-label" htmlFor="backup-import">メモからコピーしたテキストを貼り付け</label><Textarea id="backup-import" value={input} onChange={e=>{setInput(e.target.value);setPreview(null);setError('');setStatus('');}} disabled={restoring} spellCheck={false} autoCapitalize="off" autoCorrect="off" placeholder="このアプリで作成したバックアップを貼り付けてください" className="transfer-textarea"/>
   <button className="secondary-button" onClick={inspect} disabled={disabled||restoring||!input.trim()}><ArrowDownToLine size={16}/>内容を確認</button>
   {preview&&incoming&&<div className="backup-preview"><h4><Check size={15}/>読み取りできました</h4><p>作成日時：{new Date(preview.exportedAt).toLocaleString('ja-JP')}</p><dl><div><dt>SP 1P / SP 2P</dt><dd>{incoming.sp1}件 / {incoming.sp2}件</dd></div><div><dt>DP</dt><dd>{incoming.dp}件</dd></div><div><dt>プレイデータ</dt><dd>{incoming.scores}譜面</dd></div><div><dt>手入力の譜面データ</dt><dd>{incoming.manualCharts}譜面</dd></div><div><dt>お気に入り</dt><dd>5種類・延べ{incoming.favorites}曲</dd></div></dl>{unknownCount>0&&<p>現在の楽曲DBにない設定 {unknownCount}件もそのまま保持します。</p>}<p className="transfer-notice">この端末の保存済み設定 {counts.total}件・プレイデータ {counts.scores}譜面・手入力の譜面データ {counts.manualCharts}譜面・お気に入り・全体設定を、貼り付けた内容で置き換えます。</p><button className="save-button" disabled={disabled||dirty||restoring} onClick={()=>{setError('');setConfirm(true);}}>この内容で復元する</button></div>}
   {dirty&&<p className="transfer-notice">復元する前に、編集中の内容を保存するか、編集を終了してください。</p>}
  </div>}
  {error&&!confirm&&<p className="transfer-error" role="alert">{error}</p>}
  {status&&<p className="transfer-status" role="status">{status}</p>}
  <details className="transfer-guide"><summary>iPhoneの「メモ」でデータを移す手順</summary><ol>
   <li>移行元で編集内容を保存し、「全体設定」→「エクスポート」→「テキストを作成」→「コピー」を押します。</li>
   <li>iPhoneの「メモ」に新しいメモを作り、そのまま貼り付けて残します。</li>
   <li>移行先の端末で、そのメモのバックアップ部分を先頭から末尾まですべてコピーします。</li>
   <li>移行先でこのアプリを開き、先に「楽曲DBを更新」を押します。その後「全体設定」→「インポート」の欄に長押しで貼り付け、「内容を確認」を押します。</li>
   <li>件数を確認して復元し、曲一覧で設定が戻ったことを確認します。移行先にデータがある場合は、先にエクスポートして残してください。</li>
  </ol><p>同じiPhoneで別のブラウザやホーム画面のアプリへ移す場合も同じ手順です。自動同期はされません。</p><p>このテキストの対象は個人の設定データです。楽曲DBは含まれないため、移行先の更新ボタンで取得してください。</p></details>
  <AlertDialog open={confirm} onOpenChange={v=>{if(!restoring)setConfirm(v);}}><AlertDialogContent className="save-confirm"><AlertDialogTitle>保存データを復元しますか？</AlertDialogTitle><AlertDialogDescription>この端末の設定 {counts.total}件を、バックアップの設定 {incoming?.total??0}件に置き換えます。プレイデータ {counts.scores}譜面も {incoming?.scores??0}譜面に置き換えます。お気に入り5種類と全体設定も置き換わります。</AlertDialogDescription><p className="transfer-notice">今の内容を残す場合は、キャンセルして先にエクスポートしてください。</p>{error&&<p className="transfer-error" role="alert">{error}</p>}<AlertDialogFooter className="save-confirm-actions"><AlertDialogAction disabled={disabled||dirty||restoring} onClick={e=>{e.preventDefault();void restore();}}>{restoring?<><Loader2 size={16} className="spin"/>復元中…</>:'置き換えて復元'}</AlertDialogAction><AlertDialogCancel disabled={restoring}>キャンセル</AlertDialogCancel></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </section>;
}
