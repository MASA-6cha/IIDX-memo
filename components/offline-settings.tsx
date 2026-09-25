import {Check,Download,RefreshCw,Smartphone,WifiOff} from 'lucide-react';
import type {OfflineApp} from '@/lib/use-offline-app';

export function OfflineStatus({offline,hasCatalog,onOpen}:{offline:OfflineApp;hasCatalog:boolean;onOpen:()=>void}) {
  const text=!offline.online?'オフラインで利用中':offline.state==='ready'?(hasCatalog?'オフライン利用の準備完了':'楽曲DBを取得すると準備完了'):offline.state==='saving'?'アプリ本体を保存中…':'iPhoneに保存して使う';
  return <button className={`offline-status ${offline.state==='ready'&&hasCatalog?'is-ready':''}`} onClick={onOpen}>
    {!offline.online?<WifiOff size={14}/>:offline.state==='ready'&&hasCatalog?<Check size={14}/>:<Smartphone size={14}/>}<span>{text}</span><small>{offline.updateAvailable?'アプリ更新あり':'導入手順'}</small>
  </button>;
}

export function OfflineSettings({offline,hasCatalog,storageReady,disabled,dirty,onApplyUpdate}:{offline:OfflineApp;hasCatalog:boolean;storageReady:boolean;disabled:boolean;dirty:boolean;onApplyUpdate:()=>void}) {
  const label={checking:'確認中',saving:'保存中…',ready:'保存済み',error:'保存未完了',unavailable:'この画面では利用不可'}[offline.state];
  const ready=offline.state==='ready'&&hasCatalog&&storageReady;
  return <section className="offline-settings"><h3><Download size={17}/>iPhoneに保存して使う</h3>
    <div className={`offline-readiness ${ready?'is-ready':''}`} role="status">{ready?<Check size={19}/>:<Smartphone size={19}/>}<div><strong>{ready?'オフライン利用の準備ができています':'初回は通信できる場所で準備してください'}</strong><span>{offline.online?'通信に接続中':'オフライン'}{offline.standalone?' · ホーム画面から起動':''}</span></div></div>
    <div className="storage-row"><span>アプリ本体</span><strong>{label}</strong></div>
    <div className="storage-row"><span>楽曲DB</span><strong>{hasCatalog?'保存済み':'未取得'}</strong></div>
    {offline.savedAt&&<p>本体の保存：{new Date(offline.savedAt).toLocaleString('ja-JP')}</p>}
    {offline.state==='error'&&<button className="secondary-button" disabled={disabled||!offline.online} onClick={()=>void offline.retry()}><Download size={16}/>アプリ本体を保存し直す</button>}
    {(offline.state==='ready'||offline.updateAvailable)&&<div className="offline-actions"><button className="secondary-button" disabled={disabled||!offline.online||offline.checkingUpdate} onClick={()=>void offline.checkUpdate()}><RefreshCw size={16} className={offline.checkingUpdate?'spin':''}/>{offline.checkingUpdate?'更新を確認中…':'アプリの更新を確認'}</button>{offline.updateAvailable&&<button className="save-button" disabled={disabled} onClick={onApplyUpdate}>新しいアプリに切り替える</button>}</div>}
    {offline.message&&<p className={offline.state==='error'?'transfer-error':'offline-message'} role="status">{offline.message}</p>}
    {dirty&&offline.updateAvailable&&<p>切り替え前に、編集中の設定を保存するか確認します。</p>}
    <InstallSteps/>
    <p>準備後は、通信なしで起動・検索・設定の保存・呼び出しができます。楽曲DBとアプリの更新時は通信が必要です。</p>
    <p>入力内容はこの端末に保存されます。ほかの利用者への共有や端末間の自動同期はありません。機種変更前や設定をまとめて変えた後は、下のバックアップを「メモ」に残してください。</p>
    <p>ブラウザのデータ削除などでアプリ本体が消えた場合は、通信できる場所で開いて保存し直してください。ホーム画面へ移した後は、そのアイコンからの利用に統一してください。</p>
  </section>;
}

export function InstallSteps(){
  return <ol className="install-steps">
      <li>Safariでこのページを開き、「共有」→「ホーム画面に追加」。表示される場合は「Webアプリとして開く」をオンにします。</li>
      <li>追加した「IIDXメモ」のアイコンから開き直します。</li>
      <li>「アプリ本体」が保存済みになるまで待ち、全体設定の「楽曲DBを更新」を押します。</li>
      <li>「オフライン利用の準備ができています」を確認。一度閉じ、機内モードでアイコンから開けるか確認してください。</li>
    </ol>;
}
