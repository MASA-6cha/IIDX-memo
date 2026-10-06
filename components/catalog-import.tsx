"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import {FileJson,Loader2,Download,Check} from 'lucide-react';
import {Tabs,TabsContent,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {type Catalog,type Chart,type Song} from '@/lib/iidx-data';
import {publicSongId} from '@/lib/song-identity';
import {DEFAULT_CATALOG_IMPORT_URL,SUPPLEMENT_CATALOG_URL,mergeCatalogImport,type CatalogImport,type ImportOrigin} from '@/lib/catalog-import';
import {BEMANIWIKI_CATALOG_URL} from '@/lib/bemaniwiki-import';
import CatalogImportWorker from '../lib/catalog-import.worker?worker';

export function CatalogImportSettings({catalog,disabled,dirty,onBusy,onImport}:{catalog:Catalog|null;disabled:boolean;dirty:boolean;onBusy:(value:boolean)=>void;onImport:(data:CatalogImport,origin:ImportOrigin)=>Promise<void>}){
 const [tab,setTab]=useState('github'),[url,setUrl]=useState(catalog?.importedData?.url??DEFAULT_CATALOG_IMPORT_URL),[phase,setPhase]=useState(''),[error,setError]=useState(''),[status,setStatus]=useState(''),[saving,setSaving]=useState(false);
 const [input,setInput]=useState<{data:CatalogImport;origin:ImportOrigin}|null>(null),worker=useRef<Worker|null>(null),file=useRef<HTMLInputElement>(null),lock=useRef(false);
 useEffect(()=>()=>{worker.current?.terminate();onBusy(false);},[onBusy]);
 useEffect(()=>{if(catalog?.importedData?.url)setUrl(catalog.importedData.url);},[catalog?.importedData?.url]);
 const checked=useMemo(()=>{try{return {preview:input?mergeCatalogImport(catalog,input.data,input.origin):null,error:''};}catch(e){return {preview:null,error:e instanceof Error?e.message:'照合できませんでした。'};}},[catalog,input]);const preview=checked.preview;
 const unlinked=catalog?.songs.filter(song=>song.importedInfo&&!publicSongId(song))??[];
 const stop=()=>{worker.current?.terminate();worker.current=null;lock.current=false;setPhase('');onBusy(false);};
 const read=(request:{file?:File;url?:string})=>{
  if(disabled||lock.current)return;lock.current=true;setInput(null);setError('');setStatus('');setPhase('読み込みを開始しています…');onBusy(true);
  try{
   const task=new CatalogImportWorker();worker.current=task;
   task.onmessage=(event:MessageEvent)=>{
    if(worker.current!==task)return;
    const message=event.data;
    if(message.type==='progress')setPhase(message.message);
    else if(message.type==='complete'){setInput({data:message.data,origin:message.origin});stop();}
    else if(message.type==='error'){setError(message.message);stop();}
   };
   task.onerror=()=>{setError('読み込みを開始できませんでした。アプリを更新してから再度お試しください。');stop();};
   task.postMessage(request);
  }catch{setError('この環境ではファイルの読み込みを開始できませんでした。再読み込みしてお試しください。');stop();}
 };
 const save=async()=>{
  if(!input||!(preview?.acceptedCharts||preview?.linkedSongs)||disabled||dirty||lock.current)return;lock.current=true;setSaving(true);setError('');
  try{await onImport(input.data,input.origin);setStatus(input.data.kind==='identities'?`曲ID対応表 ${preview.linkedSongs}組を取り込みました。`:`${preview.updatedSongs+preview.addedSongs}曲・${preview.acceptedCharts}譜面を取り込みました。${preview.issues.length?`照合保留 ${preview.issues.length}曲は取り込んでいません。`:''}`);setInput(null);}
  catch(e){setError(e instanceof Error?e.message:'端末に保存できませんでした。');}
  finally{lock.current=false;setSaving(false);}
 };
 return <section className="catalog-import-settings"><h3><FileJson size={17}/>楽曲JSON・目視確認データの取り込み</h3>
  <p>楽曲JSON・BEMANIWikiのIIDX34 JSON・曲ID対応表を、ファイルまたはGitHubの公開URLから読み込めます。最大32MB。ファイルはこの端末で処理します。</p>
  <Tabs value={tab} onValueChange={setTab}><TabsList aria-label="楽曲JSONの読み込み方法"><TabsTrigger value="file" disabled={!!phase||saving}>ファイル</TabsTrigger><TabsTrigger value="github" disabled={!!phase||saving}>GitHub</TabsTrigger></TabsList>
   <TabsContent value="file"><input ref={file} type="file" accept=".json,application/json" aria-label="楽曲JSONファイル" disabled={disabled||!!phase||saving} onChange={event=>{const selected=event.target.files?.[0];event.target.value='';if(selected)read({file:selected});}}/></TabsContent>
   <TabsContent value="github"><label className="field-label" htmlFor="catalog-json-url">JSONファイルの公開URL</label><input id="catalog-json-url" type="url" value={url} onChange={event=>setUrl(event.target.value)} disabled={disabled||!!phase||saving} placeholder={DEFAULT_CATALOG_IMPORT_URL} autoCapitalize="none" spellCheck={false}/><button className="secondary-button" onClick={()=>read({url})} disabled={!url.trim()||disabled||!!phase||saving}><Download size={15}/>URLから読み込む</button><button className="secondary-button" disabled={disabled||!!phase||saving} onClick={()=>setUrl(DEFAULT_CATALOG_IMPORT_URL)}>解析データのURLを使用</button><button className="secondary-button" disabled={disabled||!!phase||saving} onClick={()=>setUrl(BEMANIWIKI_CATALOG_URL)}>BEMANIWiki IIDX34のURLを使用</button><button className="secondary-button" disabled={disabled||!!phase||saving} onClick={()=>setUrl(SUPPLEMENT_CATALOG_URL)}>IIDX 34 目視確認データのURLを使用</button><button className="secondary-button" disabled={disabled||!!phase||saving} onClick={()=>setUrl('https://raw.githubusercontent.com/MASA-6cha/IIDX-memo/main/lib/song-identities.json')}>曲ID対応表のURLを使用</button><p>ファイルページ・Raw・GitHub Pagesに対応。読み込みボタンを押すと取得します。非公開リポジトリはファイル選択をご利用ください。</p></TabsContent>
  </Tabs>
  {phase&&<div className="catalog-import-progress"><p role="status"><Loader2 className="spin" size={16}/>{phase}</p><button className="secondary-button" onClick={()=>{stop();setStatus('読み込みを中止しました。');}}>中止</button></div>}
  {(error||checked.error)&&<p className="transfer-error" role="alert">{error||checked.error}</p>}{status&&<p className="catalog-notice" role="status">{status}</p>}
  <p>IIDX 34の目視確認JSONは、既存DBにない曲・譜面と未取得の項目だけを補完します。通常DB・解析データの既存値（0を含む）を優先し、DBにない項目だけアプリ内の手入力を使います。</p>
  <p>BEMANIWikiのIIDX34 JSONは、掲載済みの曲・確認済みの譜面をベースデータとして補完します。レーダーは別の取り込みデータを保持します。予定曲・存在未確認の譜面・「?」付きの譜面要素は確定値にしません。</p>
  {input&&preview&&<div className="catalog-import-preview"><h4>取り込み内容の確認</h4><p className="catalog-import-filename">{input.origin.label} · {input.data.kind==='identities'?`${input.data.identityLinks?.length}組の曲ID対応表`:`${input.data.songs.length.toLocaleString()}曲 / ${input.data.chartCount.toLocaleString()}譜面`}</p>
   <p>曲名なしで除外：{input.data.skippedUnnamedSongs??0}曲。曲名が未設定・空欄の曲は取り込みません。</p><dl className="catalog-facts"><div><dt>既存曲を更新</dt><dd>{preview.updatedSongs.toLocaleString()}曲</dd></div><div><dt>新しい曲を追加</dt><dd>{preview.addedSongs.toLocaleString()}曲</dd></div><div><dt>譜面を更新 / 追加</dt><dd>{preview.updatedCharts.toLocaleString()} / {preview.addedCharts.toLocaleString()}</dd></div><div><dt>照合保留</dt><dd>{preview.issues.length.toLocaleString()}曲</dd></div></dl>
   {input.data.kind==='wiki'&&<p>元データ更新：{new Date(input.data.sourceUpdatedAt!).toLocaleString('ja-JP')}。予定曲の除外：{input.data.skippedPlannedSongs??0}曲。曲IDがないため、曲名・アーティストと保存済みの対応で照合します。既存の曲ID、メモ、スコア、レーダーは保持します。</p>}
   {input.data.kind==='wiki'?<p>IIDX34の基本情報を不足分に反映します。既存の取り込みJSON・通常DBの値が優先されます。目視確認JSONと併用でき、一意に照合できる曲は読み込む順序に関係なく別途保存したレーダー値を利用します。一致しない曲は照合保留にします。</p>:input.data.kind==='identities'?<p>解析側のmusic_idと通常DB側の曲IDを対応付けます。曲名は解析データを優先し、別名と非公式難易度表の連動を保持します。既存の対応と競合する表は取り込みません。</p>:input.data.kind==='supplement'?<p>目視確認データとして不足分だけを補完します。既存の値は上書きしません。通常DB・解析JSONを更新した際は、新しく取得できた値を優先します。曲名なし・照合が曖昧な曲は取り込みません。</p>:<p>取り込んだ曲名・アーティスト・難度・BPM・ノーツ数・レーダーを優先します。解析データ、通常DB、目視確認JSONの順に優先し、未取得の項目だけアプリ内の手入力で補います。難度値が不明な譜面は既存の難度値を引き継ぎ、値がなければ「難度不明」にします。その他のnullは未取得として反映します。メモ・お気に入り・スコアは引き継ぎます。</p>}
   {input.data.kind!=='supplement'&&input.data.kind!=='wiki'&&preview.addedSongs>0&&<p>新規追加曲のシリーズ・AC収録状況は不明です。一覧の収録状況を「すべて」にすると表示できます。後日、保存されたID対応・別名または曲名とアーティストの一意な一致で通常DBと連動します。</p>}
   {(input.data.warningCount>0||input.data.skippedEmptyCharts>0)&&<p>{input.data.kind==='wiki'?'未確定の譜面要素':'元データの警告'}：{input.data.warningCount.toLocaleString()}件。{input.data.kind==='wiki'?'存在しない・未確認の譜面':'譜面なし（null / level 0）'}：{input.data.skippedEmptyCharts.toLocaleString()}件。{input.data.kind!=='wiki'&&'警告は曲編集の「取り込みデータ」で確認できます。'}</p>}
   <details><summary>対象曲を確認（先頭12曲）</summary><ul>{preview.examples.map((item,i)=><li key={i}>{item.kind} · {item.title} · {item.charts}譜面</li>)}</ul></details>
   {preview.issues.length>0&&<details open><summary>取り込めない曲（先頭20曲）</summary><ul>{preview.issues.slice(0,20).map(item=><li key={`${item.musicId}:${item.title}`}>{item.title}（{item.musicId}）：{item.reason}</li>)}</ul></details>}
   {dirty&&<p>曲編集の変更を保存するか、編集を終了してから取り込んでください。</p>}
   <div className="catalog-import-actions"><button className="save-button" disabled={disabled||dirty||saving||!(preview.acceptedCharts||preview.linkedSongs)} onClick={()=>void save()}>{saving?<Loader2 className="spin" size={16}/>:<Check size={16}/>} {saving?'保存中…':input.data.kind==='identities'?`${preview.linkedSongs}組の対応を取り込む`:`${preview.acceptedCharts.toLocaleString()}譜面を取り込む`}</button><button className="secondary-button" disabled={saving||disabled} onClick={()=>setInput(null)}>取り消す</button></div>
  </div>}
  {catalog?.importedData&&<dl className="catalog-facts"><div><dt>最終取り込み</dt><dd>{new Date(catalog.importedData.importedAt).toLocaleString('ja-JP')}</dd></div><div><dt>取り込み情報あり</dt><dd>{catalog.songs.filter(s=>s.importedInfo).length.toLocaleString()}曲 / {catalog.charts.filter(c=>c.importedInfo).length.toLocaleString()}譜面</dd></div></dl>}
  {catalog?.wikiData&&<p>BEMANIWiki IIDX34：{new Date(catalog.wikiData.importedAt).toLocaleString('ja-JP')} 取り込み · {catalog.wikiData.data.songs.length}曲。元データ更新：{catalog.wikiData.data.sourceUpdatedAt?new Date(catalog.wikiData.data.sourceUpdatedAt).toLocaleString('ja-JP'):'未記録'}。再度URLから読み込み・取り込むとGitHubの最新データを反映します。</p>}
  {catalog?.supplementData&&<p>目視確認データ：{new Date(catalog.supplementData.importedAt).toLocaleString('ja-JP')} · {catalog.supplementData.data.songs.length}曲。端末に保存済みです。</p>}
  <p>解析JSONのレーダーの計算方法：KONAMIフォーマットプロジェクトで解析。取り込み値は通常の楽曲DB更新後も優先します。JSONに含まれない曲・譜面は削除しません。</p>
  <details><summary>曲名の表記ゆれ・曲ID対応</summary><p>解析データを常に最優先にします。通常DBの曲名は別名として検索・スコア照合に利用します。アプリ付属の対応表を適用し、それ以外も曲名とアーティストが一意に一致する曲は自動で対応を保存します。</p><p>自動照合できない曲は、schemaが「iidx-song-identities/1」の対応表を上のファイルまたはGitHub URLから取り込めます。解析JSONの曲名を修正する必要はありません。</p><p>対応保存：{Object.keys(catalog?.songIdentities?.links??{}).length}組。競合するメモ・スコアは上書きせず、旧IDのまま通常バックアップ内に保持します。</p>{!!catalog?.identityIssues?.length&&<ul>{catalog.identityIssues.map((issue,i)=><li key={i}>{issue}</li>)}</ul>}</details>
  {unlinked.length>0&&<details><summary>通常DBとの対応待ち：{unlinked.length}曲</summary><p>新曲・旧譜面・別表記を含みます。同じ曲と確認できたものだけ曲ID対応表に追加してください（先頭30曲）。</p><ul>{unlinked.slice(0,30).map(song=><li key={song.id}>{song.title} / {song.artist} · music_id {song.importedInfo?.musicId}</li>)}</ul></details>}
  <p>この楽曲JSONは通常のメモ・スコアのエクスポートには含まれません。元ファイル、または公開URLを保管してください。</p>
 </section>;
}

export function ImportedChartDetails({song,chart}:{song:Song;chart:Chart}){
 const info=chart.importedInfo;if(!info&&chart.supplementBase===undefined)return null;
 return <details className="imported-chart-details"><summary>取り込みデータ</summary><dl><div><dt>music_id</dt><dd>{song.importedInfo?.musicId??'—'}</dd></div>{song.genre&&<div><dt>ジャンル</dt><dd>{song.genre}</dd></div>}<div><dt>ノーツ数</dt><dd>{chart.noteCount?.toLocaleString()??'—'}</dd></div><div><dt>譜面要素</dt><dd>{(['CN','HCN','BSS','MSS'] as const).map(key=><span key={key}>{key}：{info?.features?.[key]===true?'あり':info?.features?.[key]===false?'なし':'不明'} </span>)}</dd></div><div><dt>データの補完</dt><dd>{chart.supplementBase!==undefined?'補完JSONから不足分を補完（既存値優先）':'KONAMIフォーマットプロジェクトで解析'}{info?.statusLabel?`（${info?.statusLabel}）`:''}</dd></div><div><dt>取り込み</dt><dd>{info?.importedAt?new Date(info.importedAt).toLocaleString('ja-JP'):'目視確認JSON'}</dd></div></dl>{!!info?.warnings?.length&&<ul>{info?.warnings.map((warning,i)=><li key={i}>{warning}</li>)}</ul>}</details>;
}
