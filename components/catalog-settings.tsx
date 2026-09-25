import {Database,RefreshCw} from 'lucide-react';
import {CATALOG_SOURCE_URL} from '@/lib/iidx-catalog';
import {type Catalog,seriesCode} from '@/lib/iidx-data';

export function CatalogUpdateButton({onUpdate,disabled,updating,stage}:{onUpdate:()=>void;disabled:boolean;updating:boolean;stage:string}){
 return <button className="secondary-button catalog-update-button" onClick={onUpdate} disabled={disabled} aria-label="楽曲DBを更新"><RefreshCw size={15} className={updating?'spin':''}/>{updating?stage:'楽曲DBを更新'}</button>;
}

export function CatalogSettings({catalog,onUpdate,disabled,updating,stage,error}:{catalog:Catalog|null;onUpdate:()=>void;disabled:boolean;updating:boolean;stage:string;error:string}){
 const latest=catalog?Math.max(...catalog.songs.map(s=>s.series)):null;
 const retained=catalog?.charts.filter(c=>c.retained).length??0;
 return <section className="catalog-settings"><h3><Database size={17}/>楽曲データベース</h3>
  {catalog?<dl className="catalog-facts"><div><dt>端末に保存済み</dt><dd>{catalog.songs.length.toLocaleString()}曲 / {catalog.charts.length.toLocaleString()}譜面</dd></div><div><dt>含まれる最新シリーズ</dt><dd>{seriesCode(latest!)} {catalog.seriesNames[latest!]}</dd></div><div><dt>最終取得</dt><dd>{new Date(catalog.fetchedAt).toLocaleString('ja-JP')}</dd></div>{catalog.sourceUpdatedAt&&<div><dt>配信ファイル更新</dt><dd>{new Date(catalog.sourceUpdatedAt).toLocaleString('ja-JP')}</dd></div>}</dl>:<p>現在は20曲のサンプルDBです。更新ボタンで公開データを取得できます。</p>}
  <CatalogUpdateButton onUpdate={onUpdate} disabled={disabled} updating={updating} stage={stage}/>
  {catalog&&<p>ノーツ数：{catalog.charts.some(c=>c.noteCount!==undefined)?`${catalog.charts.filter(c=>(c.noteCount??0)>0).length.toLocaleString()}譜面を取得済み`:'DB更新で取得'}。取得後は保存済みEXスコアからスコア率を自動計算します。レーダー：{catalog.charts.filter(c=>c.radar&&c.radar.values.some(v=>v!==null)).length.toLocaleString()}譜面。</p>}
  {error&&<p className="transfer-error" role="alert">{error}</p>}
  {catalog?.additionalData?<dl className="catalog-facts"><div><dt>ノーツレーダー</dt><dd>{catalog.additionalData.radarCharts.toLocaleString()}譜面</dd></div><div><dt>SP☆12 / SP☆11</dt><dd>{catalog.additionalData.sp12Charts} / {catalog.additionalData.sp11Charts}譜面</dd></div><div><dt>DP非公式難易度</dt><dd>{catalog.additionalData.dpCharts.toLocaleString()}譜面</dd></div><div><dt>CPI（SP☆12）</dt><dd>{catalog.additionalData.cpiCharts===undefined?'DB更新で取得':`${catalog.additionalData.cpiCharts.toLocaleString()}譜面`}</dd></div></dl>:<p>更新すると、追加難易度表とノーツレーダーも取得します。</p>}
  <p>公開DBの取得元：<a href={CATALOG_SOURCE_URL} target="_blank" rel="noreferrer">IIDX Data Table</a><br/>楽曲・譜面情報：<a href="https://textage.cc/" target="_blank" rel="noreferrer">TexTage</a>{catalog?.importedData&&<><br/>取り込んだ楽曲JSONの値を優先しています。</>}</p>
  <p>更新には通信が必要です。取得した楽曲DBは、このブラウザの端末内に保存します。オプション・コメント・お気に入り・プレイデータは引き継ぎます。</p>
  <p>取り込んだ楽曲JSONに譜面別の収録判定があれば、その基準作品の判定を表示・絞り込みに優先します。例：#33基準はIIDX 33時点の判定で、現在のIIDX 34での選曲可否を示しません。譜面別の判定がない場合は従来の曲単位の判定を使います。判定不明の譜面は「すべて」で表示できます。BPMが未登録の譜面は「—」と表示します。</p>
  <p>古い削除曲の難度値には、TexTage独自の評価が含まれる場合があります。</p>
  <p>追加情報：SP☆12難易度表・SP☆11難易度表・<a href="https://zasa.sakura.ne.jp/dp/" target="_blank" rel="noreferrer">DP非公式難易度表</a>・<a href="https://cpi.makecir.com/" target="_blank" rel="noreferrer">CPI</a>・<a href="https://bm2dx.com/IIDX/notes_radar/" target="_blank" rel="noreferrer">joy to the beat... ノーツレーダー</a>。いずれもIIDX Data Tableの配信データを使用します。</p>
  <p>CPIはSP☆12の適正CPIを、EASY・ノマゲ・HARD・EX HARD・FC別に表示します。絞り込みは100刻みです。「∞」は配信元の無限大、「未掲載」は値がない譜面です。個人の実力指標は算出しません。</p>
  <p>SP☆11・SP☆12難易度表はノマゲ／ハードを選択できます。DP非公式難易度はノーマルゲージ・正規／逆正規を基準とする評価です。レーダー未掲載は「—」、掲載済み項目の0は「0.00」と表示します。</p>
  {retained>0&&<p>配信データから見つからなかった{retained}譜面は、「前回DB」として保持しています。</p>}
 </section>;
}
