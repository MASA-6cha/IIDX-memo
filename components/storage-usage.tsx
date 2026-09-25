"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {HardDrive,RefreshCw} from 'lucide-react';
import {type AppState,type Catalog} from '@/lib/iidx-data';
import {type LibraryView} from '@/lib/iidx-view';
import {formatBytes,measureStorage,usageTotal,type UsageReport} from '@/lib/storage-usage';

export function StorageUsage({active,state,catalog,view,offlineState}:{active:boolean;state:AppState;catalog:Catalog|null;view:LibraryView;offlineState:string}){
 const [report,setReport]=useState<UsageReport|null>(null),[loading,setLoading]=useState(true),request=useRef(0);
 const refresh=useCallback(async()=>{const id=++request.current;setLoading(true);const next=await measureStorage();if(id===request.current){setReport(next);setLoading(false);}},[]);
 useEffect(()=>{if(active)void refresh();return()=>{request.current++;};},[active,state,catalog,view,offlineState,refresh]);
 const total=report?usageTotal(report):null;
 const size=(value:number|null|undefined)=>loading?'計測中…':formatBytes(value??null);
 return <section className="storage-usage"><h3><HardDrive size={17}/>使用容量</h3>
  <div className="storage-total" aria-live="polite"><span>保存内容の合計（概算）</span><strong>{size(total?.bytes)}{!loading&&total?.bytes!=null&&!total.complete&&' 以上'}</strong></div>
  <dl className="catalog-facts storage-breakdown">
   <div><dt>アプリ本体・キャッシュ</dt><dd>{size(report?.app)}</dd></div>
   <div><dt>楽曲DB・追加難易度・レーダー</dt><dd>{size(report?.catalog)}</dd></div>
   <div><dt>メモ・プレイデータ・個人設定</dt><dd>{size(report?.state)}</dd></div>
   <div><dt>フィルター・表示設定</dt><dd>{size(report?.settings)}</dd></div>
   {report?.other!==0&&report?.other!=null&&<div><dt>その他の保存データ</dt><dd>{size(report.other)}</dd></div>}
  </dl>
  <div className="storage-row"><span>ブラウザ推計の使用量</span><strong>{size(report?.browserUsage)}</strong></div>
  <button className="secondary-button" onClick={()=>void refresh()} disabled={loading}><RefreshCw size={15} className={loading?'spin':''}/>{loading?'容量を計測中…':'容量を再計測'}</button>
  {!loading&&total&&!total.complete&&<p className="transfer-error" role="status">一部の容量を取得できません。合計は計測できた分だけです。</p>}
  <p>保存内容の合計は本体・DB・設定のデータ量です。更新前や切り替え待ちの本体キャッシュも含みます。</p>
  <p>圧縮や管理領域などの違いにより、ブラウザ推計とは一致しません。iOS側のアイコンや一時キャッシュまで含む実使用量は、Webアプリから完全には取得できません。</p>
 </section>;
}
