"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import {Check,ClipboardPaste,Copy,ExternalLink,Loader2,Trophy} from 'lucide-react';
import {Textarea} from '@/components/ui/textarea';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {playBookmarklet} from '@/lib/play-bookmarklet-code';
import {previousPlayBookmarklet} from '@/lib/play-bookmarklet-previous';
import {toast} from 'sonner';
import {officialPlayUrl,playImporterVersion} from '@/lib/play-format';
import {matchPlayImport,parsePlayImport,playEntriesCsv,playMatchIssue,PlayModeRequired,type PlayImport,type PlayMatch} from '@/lib/play-data';
import type {AppState,Chart,Mode,Song} from '@/lib/iidx-data';
import type {PlayHandoffInput,PlayHandoffPhase} from '@/lib/play-handoff';

export function PlayImportSettings({state,songs,charts,disabled,onImport,incoming,handoffPhase='idle',onHandoffDone}:{state:AppState;songs:Song[];charts:Chart[];disabled:boolean;onImport:(matches:PlayMatch[])=>Promise<void>;incoming?:PlayHandoffInput|null;handoffPhase?:PlayHandoffPhase;onHandoffDone?:()=>void}){
 const [input,setInput]=useState(''),[preview,setPreview]=useState<PlayImport|null>(null),[choices,setChoices]=useState<Record<number,string>>({});
 const [unknownVersion,setUnknownVersion]=useState('');
 const versionValid=unknownVersion===''||/^[1-9]\d{0,2}$/.test(unknownVersion);
 const [error,setError]=useState(''),[status,setStatus]=useState(''),[saving,setSaving]=useState(false),[needsMode,setNeedsMode]=useState(false),[legacyMode,setLegacyMode]=useState<Mode|undefined>();
 const [unresolvedText,setUnresolvedText]=useState(''),[showReceivedText,setShowReceivedText]=useState(false);
 const [codeKind,setCodeKind]=useState<'current'|'previous'>('current'),[codeFeedback,setCodeFeedback]=useState<{kind:'current'|'previous';state:'copying'|'copied'|'manual'}|null>(null);
 const displayedCode=codeKind==='previous'?previousPlayBookmarklet:playBookmarklet;
 const [showCode,setShowCode]=useState(false),[showAll,setShowAll]=useState(false),codeField=useRef<HTMLTextAreaElement>(null),inputField=useRef<HTMLTextAreaElement>(null),lock=useRef(false);
 const importData=useMemo(()=>preview?{...preview,entries:preview.entries.map(entry=>entry.score.gameVersion===null&&unknownVersion&&versionValid?{...entry,score:{...entry.score,gameVersion:Number(unknownVersion)}}:entry)}:null,[preview,unknownVersion,versionValid]);
 const matches=useMemo(()=>importData?matchPlayImport(importData,songs,charts,choices):[],[importData,songs,charts,choices]);
 const accepted=matches.filter(m=>m.target),unresolved=matches.filter(m=>!m.target),songById=useMemo(()=>new Map(songs.map(s=>[s.id,s])),[songs]);
 const changeInput=(value:string)=>{setInput(value);setPreview(null);setUnknownVersion('');setChoices({});setError('');setStatus('');setNeedsMode(false);setLegacyMode(undefined);setShowAll(false);setUnresolvedText('');};
 const selectCode=()=>{codeField.current?.focus();codeField.current?.select();codeField.current?.setSelectionRange(0,codeField.current.value.length);};
 const copyCode=async(kind:'current'|'previous'='current')=>{
  setCodeKind(kind);setCodeFeedback({kind,state:'copying'});
  try{await navigator.clipboard.writeText(kind==='previous'?previousPlayBookmarklet:playBookmarklet);setCodeFeedback({kind,state:'copied'});toast.success('コピーしました');}
  catch{setCodeFeedback({kind,state:'manual'});setShowCode(true);requestAnimationFrame(selectCode);toast.error('自動コピーできませんでした。表示したコードを手動でコピーしてください。');}
 };
 const feedback=(kind:'current'|'previous')=>codeFeedback?.kind===kind?<p className={`play-code-feedback ${codeFeedback.state==='manual'?'is-error':''}`} role="status" aria-live="polite">{codeFeedback.state==='copied'?'コピーしました。ブックマークのURL欄に貼り付けてください。':codeFeedback.state==='copying'?'コピーしています…':'自動コピーできませんでした。コードをすべて選択してコピーしてください。'}</p>:null;
 const inspectText=(text:string,mode?:Mode)=>{setError('');setStatus('');setPreview(null);setChoices({});setNeedsMode(false);try{const data=parsePlayImport(text,mode);setPreview(data);setNeedsMode(data.legacy);}catch(e){if(e instanceof PlayModeRequired)setNeedsMode(true);else setError(e instanceof Error?e.message:'読み取れませんでした。');}};
 const paste=async()=>{try{const text=await navigator.clipboard.readText();changeInput(text);inspectText(text);}catch{setStatus('貼り付け欄を長押しして「ペースト」を選び、「内容を確認」を押してください。');inputField.current?.focus();}};
 const inspect=(mode=legacyMode)=>inspectText(input,mode);
 useEffect(()=>{if(incoming){changeInput(incoming.text);inspectText(incoming.text);}},[incoming]);
 const copyIncoming=async()=>{try{await navigator.clipboard.writeText(input);setStatus('コピーしました。ホーム画面版の全体設定で「貼り付けて確認」を押してください。');}catch{setStatus('下の取得結果を長押ししてコピーし、ホーム画面版へ戻ってください。');setShowReceivedText(true);}};
 const copyUnresolved=async()=>{const text=playEntriesCsv(unresolved.map(m=>m.entry));try{await navigator.clipboard.writeText(text);setStatus(`未対応の${unresolved.length}件をコピーしました。`);}catch{setUnresolvedText(text);setStatus('未対応データの欄を長押しし、すべて選択してコピーしてください。');}};
 const save=async()=>{
  if(disabled||lock.current||!accepted.length||!versionValid)return;lock.current=true;setSaving(true);setError('');
  try{await onImport(matches);setStatus(`${accepted.length.toLocaleString()}譜面のプレイデータを保存しました。${unresolved.length?`対応できなかった${unresolved.length}件は取り込んでいません。`:''}`);if(!unresolved.length){setPreview(null);setInput('');setChoices({});setNeedsMode(false);setLegacyMode(undefined);setUnresolvedText('');onHandoffDone?.();}}
  catch(e){setError(e instanceof Error?e.message:'保存できませんでした。内容は残っています。');}finally{lock.current=false;setSaving(false);}
 };
 return <section className="play-import">
  <h3><Trophy size={17}/>プレイデータ取込</h3>
  <p>公式サイトで自動取得 → アプリへ渡す → 内容を確認して保存。CLEAR TYPE・DJ LEVEL・スコアを一覧に反映します。</p>
  {handoffPhase==='waiting'&&<p className="transfer-status" role="status">公式ページから結果を受け取っています…</p>}
  {(handoffPhase==='unavailable'||handoffPhase==='invalid')&&<p className="transfer-error" role="alert">{handoffPhase==='invalid'?'取得結果を読み取れませんでした。':'直接受け渡しできませんでした。'}公式ページに戻って「結果をコピー」を押し、ここで「貼り付けて確認」を押してください。</p>}
  {incoming&&<div className="play-handoff-notice"><strong>取得結果を受け取りました。まだ保存していません。</strong><p>この画面で保存すると、いま開いているブラウザ版に反映されます。ホーム画面版をお使いの場合は、下のボタンでコピーしてホーム画面版へ戻ってください。</p><button className="secondary-button" onClick={()=>void copyIncoming()} disabled={saving}><Copy size={16}/>ホーム画面版へコピー</button></div>}
  {!incoming&&<><details className="transfer-guide play-setup" open={!state.playData&&handoffPhase==='idle'}><summary>取得ツールを登録・更新（Safari / Chrome）</summary><p>取得ツール v{playImporterVersion}。登録済みのブックマークは、URLを下のコードに置き換えて更新します。アプリの更新だけではブックマークは更新されません。</p>
   <ol><li>下の「取得用コードをコピー」を押します。</li><li>取得に使うブラウザで公式サイトをブックマークに追加し、名前を <strong>IIDXデータ取得</strong> にします。</li><li>そのブックマークを編集し、URLをすべて消してコピーしたコードを貼り付け、保存します。</li></ol>
   <div className="play-guide-actions"><button className="secondary-button" disabled={codeFeedback?.state==='copying'} onClick={()=>void copyCode()}>{codeFeedback?.kind==='current'&&codeFeedback.state==='copied'?<Check size={16}/>:<Copy size={16}/>}取得用コードをコピー</button><button className="text-button" onClick={()=>{setCodeKind('current');setShowCode(v=>codeKind==='current'?!v:true);}}>{showCode&&codeKind==='current'?'コードを閉じる':'手動でコピー'}</button></div>
   {feedback('current')}
   <details className="play-recovery"><summary>更新後に取得できない場合：以前のコードに戻す</summary><p>直接受け渡しを追加する前の取得コード（v1.18.2）です。ブックマークのURLをこのコードに置き換えてください。取得後は「結果をコピー」→ アプリで「貼り付けて確認」を使います。</p><div className="play-guide-actions"><button className="secondary-button" disabled={codeFeedback?.state==='copying'} onClick={()=>void copyCode('previous')}>{codeFeedback?.kind==='previous'&&codeFeedback.state==='copied'?<Check size={16}/>:<Copy size={16}/>}以前の取得コードをコピー</button><button className="text-button" onClick={()=>{setCodeKind('previous');setShowCode(true);}}>以前のコードを表示</button></div>{feedback('previous')}</details>
   {showCode&&<div className="play-guide-actions"><p>{codeKind==='previous'?'以前の取得コード（v1.18.2・コピー取込）':`取得コード（v${playImporterVersion}・直接受け渡し）`}</p><Textarea ref={codeField} aria-label="ブックマーク登録用コード" readOnly value={displayedCode} spellCheck={false} className="transfer-textarea"/><button className="secondary-button" onClick={selectCode}>コードをすべて選択</button></div>}
   <p>URLの先頭が「javascript:」になっていれば準備完了です。</p>
  </details>
  <div className="play-import-step"><span className="play-step-number">1</span><div><h4>公式サイトで取得</h4><p>取得に使うSafariまたはChromeでログインし、楽曲一覧を表示します。ブックマークの「IIDXデータ取得」を起動し、モード・範囲を選んで「取得開始」。ページ巡回は自動です。</p><a className="secondary-button play-official" href={officialPlayUrl} target="_blank" rel="noreferrer">公式の楽曲データを開く<ExternalLink size={15}/></a><small>同じブラウザでこのアプリを使う場合：取得後に「アプリへ渡す（ブラウザ版）」を押すと、取り込み内容が開きます。<br/>ホーム画面版を使う場合：「結果をコピー」を押してホーム画面版へ戻り、下の「貼り付けて確認」を押してください。</small></div></div>
  <div className="play-import-step"><span className="play-step-number">2</span><div><label className="field-label" htmlFor="play-import-data">コピーした結果を取り込む</label><Textarea ref={inputField} id="play-import-data" value={input} onChange={e=>changeInput(e.target.value)} disabled={saving} className="transfer-textarea" placeholder="長押し → ペースト" spellCheck={false} autoCapitalize="off" autoCorrect="off"/><div className="play-actions"><button className="secondary-button" onClick={()=>void paste()} disabled={saving||disabled}><ClipboardPaste size={16}/>貼り付けて確認</button><button className="secondary-button" onClick={()=>inspect()} disabled={!input.trim()||disabled||saving}>内容を確認</button></div></div></div></>}
  {needsMode&&<div className="play-legacy"><p>以前の取得ツールのCSVです。取得したモードを選んでください。</p><Tabs value={legacyMode??''} onValueChange={v=>{setLegacyMode(v as Mode);inspect(v as Mode);}}><TabsList aria-label="取り込みデータのモード"><TabsTrigger value="SP" disabled={saving}>SP</TabsTrigger><TabsTrigger value="DP" disabled={saving}>DP</TabsTrigger></TabsList></Tabs></div>}
  {preview&&<div className="backup-preview play-preview"><h4><Check size={16}/>取り込み内容</h4><dl><div><dt>SP / DP</dt><dd>{accepted.filter(m=>m.entry.mode==='SP').length.toLocaleString()} / {accepted.filter(m=>m.entry.mode==='DP').length.toLocaleString()} 譜面</dd></div><div><dt>うち未プレー</dt><dd>{accepted.filter(m=>m.entry.score.lamp==='NO PLAY').length.toLocaleString()} 譜面</dd></div><div><dt>対応できていないデータ</dt><dd>{unresolved.length.toLocaleString()} 件</dd></div></dl>
   <p>取得元のシリーズごとに保存します。同じシリーズ・同じ譜面は更新し、別シリーズの記録とオプションメモは残します。</p>
   {preview.entries.some(entry=>entry.score.gameVersion===null)&&<div className="import-series-field"><label className="field-label" htmlFor="import-game-version">取得元のシリーズ番号（不明なデータのみ）</label><input id="import-game-version" type="number" inputMode="numeric" min="1" max="999" step="1" value={unknownVersion} disabled={saving} placeholder="例：33" onChange={event=>setUnknownVersion(event.target.value)}/><p>取得した作品番号が分かる場合に入力してください。空欄では「シリーズ不明」として保存します。</p>{!versionValid&&<p role="alert" className="transfer-error">1〜999の整数を入力してください。</p>}</div>}
   <p>保存先：{Array.from(new Set(importData!.entries.map(e=>e.score.gameVersion===null?'シリーズ不明':`#${e.score.gameVersion}`))).join(' / ')} · {new Date(preview.entries[0].score.fetchedAt).toLocaleString('ja-JP')}</p>
   {preview.duplicates>0&&<p>同一内容の重複 {preview.duplicates}件をまとめました。</p>}
   {matches.some(m=>m.reason!=='matched'||Object.hasOwn(choices,m.index))&&<details className="play-matching"><summary>対応先を確認する</summary><p>空白・記号などの表記差を照合し、旧譜面より現行AC譜面を優先します。難度が異なる場合や候補が複数残る場合は、対応先を確認してください。</p><div className="play-match-list">{matches.filter(m=>m.reason!=='matched'||Object.hasOwn(choices,m.index)).slice(0,showAll?25000:50).map(m=><div key={m.index} className="play-match"><strong>{m.entry.title}</strong><span>{m.entry.mode} {m.entry.difficulty} ☆{m.entry.level}{songById.get(m.target?.songId??'')?.removed?' · 削除曲':''}</span>{!m.target&&<small>{playMatchIssue(m)}</small>}{m.candidates.length?<Select value={Object.hasOwn(choices,m.index)?choices[m.index]||'skip':'pending'} onValueChange={v=>setChoices(c=>({...c,[m.index]:v==='skip'?'':v}))} disabled={saving}><SelectTrigger className="choice" aria-label={`${m.entry.title} ${m.entry.mode} ${m.entry.difficulty}の対応先`}><SelectValue/></SelectTrigger><SelectContent className="choice-menu"><SelectItem value="pending" disabled>対応先を選択</SelectItem><SelectItem value="skip">取り込まない</SelectItem>{m.candidates.map(c=><SelectItem key={c.id} value={c.id}>{songById.get(c.songId)?.title} · {songById.get(c.songId)?.artist} / {songById.get(c.songId)?.series}作目 ☆{c.level}{songById.get(c.songId)?.removed?' · 削除／旧譜面':c.retained||songById.get(c.songId)?.retained?' · 保持データ':' · 現行AC'}</SelectItem>)}</SelectContent></Select>:null}</div>)}</div>{!showAll&&matches.filter(m=>m.reason!=='matched'||Object.hasOwn(choices,m.index)).length>50&&<button className="secondary-button" onClick={()=>setShowAll(true)}>残りも表示</button>}</details>}
   {unresolved.length>0&&<div className="play-guide-actions"><p>未登録 {matches.filter(m=>m.reason==='missing').length}件 · 要確認 {matches.filter(m=>m.reason==='ambiguous').length}件 · 競合 {matches.filter(m=>m.reason==='duplicate').length}件</p><button className="secondary-button" onClick={()=>void copyUnresolved()} disabled={saving}><Copy size={16}/>未対応のデータだけコピー</button>{unresolvedText&&<Textarea aria-label="未対応のプレイデータ" readOnly value={unresolvedText} className="transfer-textarea" spellCheck={false}/>}</div>}
   <button className="save-button" disabled={disabled||saving||!accepted.length||!versionValid} onClick={()=>void save()}>{saving?<Loader2 className="spin" size={17}/>:<Check size={17}/>} {saving?'保存中…':`${accepted.length.toLocaleString()}譜面を保存`}</button>
  </div>}
  {incoming&&showReceivedText&&<Textarea aria-label="ホーム画面版へ渡す取得結果" readOnly value={input} className="transfer-textarea"/>}
  {error&&<p className="transfer-error" role="alert">{error}</p>}{status&&<p className="transfer-status" role="status">{status}</p>}
  {state.playData&&<dl className="play-last-import">{(['SP','DP'] as const).map(mode=>{const stamp=state.playData?.imports[mode];return stamp?<div key={mode}><dt>{mode} 最終取込</dt><dd>{new Date(stamp.at).toLocaleString('ja-JP')} · {stamp.count.toLocaleString()}譜面</dd></div>:null;})}</dl>}
  <p>公式サイトで「難易度別の楽曲データ」を閲覧できるログイン・契約状態で利用します。追加料金のCSV出力機能は使いません。取得中は公式サイトの取得画面を開いたままにしてください。</p>
  <details className="transfer-guide"><summary>取得できないとき・データの扱い</summary><p>公式サイトで参照するe-amusement passと、スコア一覧が表示できるかを確認してください。自動取得が失敗した場合は、取得ツールの「表示中のページだけ取得」→「このページを読み取る」を試してください。これは画面に出ている譜面だけの取り込みです。読み取れない場合は「診断情報をコピー」の内容で原因を調べられます。</p><p>直接受け渡しで別のタブが開かない・結果が届かない場合は、公式ページの「結果をコピー」を使ってください。ホーム画面版にはコピーして取り込みます。このアプリにはログイン情報を入力しません。直接受け渡しでも結果をサーバーに保管せず、確認後に「保存」を押した端末のブラウザへ保存します。「未取得」は「未プレー」と区別します。</p><p>取得機能は <a href="https://github.com/BPIManager/IIDX-Scraping-Bookmarklet" target="_blank" rel="noreferrer">IIDX-Scraping-Bookmarklet</a> を参考にしています。<a href="/licenses/iidx-scraping-bookmarklet.txt" target="_blank" rel="noreferrer">MITライセンス</a></p></details>
 </section>;
}
