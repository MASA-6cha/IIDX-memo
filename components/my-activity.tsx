"use client";
import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import {ArrowLeft,Activity} from 'lucide-react';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Table,TableHeader,TableBody,TableHead,TableRow,TableCell} from '@/components/ui/table';
import {type Chart,type Song,type Mode} from '@/lib/iidx-data';
import {type PlayScore,lamps,lampLabels} from '@/lib/play-data';
import {type ScoreSource,scoreSeriesLabel} from '@/lib/play-history';
import {radarAxes,radarPoint} from '@/lib/iidx-additional';
import {ChartFeatures} from '@/components/chart-features';
import {useFolderSwipe} from '@/lib/use-folder-swipe';
import {calculateActivity,djLevels} from '@/lib/my-activity';

function MyRadar({values}:{values:number[]}){
 const size=320,center=size/2,ring=(value:number)=>radarAxes.map((_,i)=>radarPoint(i,value,size).join(',')).join(' ');
 return <svg className="activity-radar" viewBox="0 0 320 320" role="img" aria-label={`マイノーツレーダー。${radarAxes.map((axis,i)=>`${axis.label} ${values[i].toFixed(2)}`).join('、')}。外周200。`}>
  {[50,100,150,200].map(value=><polygon key={value} points={ring(value)} fill="none" stroke="var(--radar-grid, #3b4b61)" strokeWidth={value===100?1.5:1}/>)}
  {radarAxes.map((axis,i)=>{const [x,y]=radarPoint(i,200,size);return <line key={axis.key} x1={center} y1={center} x2={x} y2={y} stroke="var(--radar-grid, #3b4b61)"/>;})}
  <polygon points={values.map((value,i)=>radarPoint(i,value,size).join(',')).join(' ')} fill="var(--primary)" fillOpacity=".22" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round"/>
  {radarAxes.map((axis,i)=>{const angle=-Math.PI/2+i*Math.PI/3;return <text key={axis.key} x={center+Math.cos(angle)*149} y={center+Math.sin(angle)*149} textAnchor="middle" dominantBaseline="middle" fontSize="12" className="radar-axis-label" style={{'--metric-color':axis.color} as CSSProperties} fill={axis.color}>{axis.short}</text>;})}
 </svg>;
}

export function MyActivity({charts,songs,records,initialMode,source,sources,onSource,onBack,onChart,disabled,ready,sample,error}:{charts:Chart[];songs:Song[];records:Record<string,PlayScore>;initialMode:Mode;source:ScoreSource;sources:{value:ScoreSource;label:string}[];onSource:(source:ScoreSource)=>void;onBack:()=>void;onChart:(chart:Chart)=>void;disabled:boolean;ready:boolean;sample:boolean;error:string}){
 const [mode,setMode]=useState<Mode>(initialMode),[scope,setScope]=useState<'available'|'all'>('available'),[axis,setAxis]=useState('0');
 const [selection,setSelection]=useState<{kind:'dj';rank:typeof djLevels[number]}|{kind:'clear';rank:typeof lamps[number]}|null>(null),[limit,setLimit]=useState(60);
 const rankReturnY=useRef<number|null>(null);
 const openRank=(next:NonNullable<typeof selection>)=>{rankReturnY.current=window.scrollY;setSelection(next);};
 useEffect(()=>{if(selection)window.scrollTo(0,0);else if(rankReturnY.current!==null){window.scrollTo(0,rankReturnY.current);rankReturnY.current=null;}},[selection]);
 const back=()=>selection?setSelection(null):onBack();
 const swipe=useFolderSwipe({enabled:ready&&!disabled,folderKey:selection?`${selection.kind}:${selection.rank}`:'activity',onBack:back});
 useEffect(()=>{setLimit(60);},[selection,mode,scope,source]);
 useEffect(()=>{if(ready)setMode(initialMode);},[ready,initialMode]);
 // This component is mounted only on the activity page. Search, scrolling and
 // note editing never run the calculation; unchanged inputs reuse the result.
 const summary=useMemo(()=>calculateActivity(charts,songs,records,mode,scope),[charts,songs,records,mode,scope]);
 const names=useMemo(()=>new Map(songs.map(song=>[song.id,song.title])),[songs]);
 const selectedCharts=selection?(selection.kind==='dj'?summary.djCharts[selection.rank]:summary.clearCharts[selection.rank]):[];
 return <main className="activity-page"><div className="difficulty-folder-panel" {...swipe}><div className="folder-swipe-feedback" aria-hidden="true"><span>‹</span><b className="swipe-pull-label">前の画面へ</b><b className="swipe-release-label">離すと戻る</b></div><div className="folder-swipe-content">
  <button className="secondary-button activity-back" disabled={disabled} onClick={back}><ArrowLeft size={16}/>{selection?'集計へ戻る':'曲一覧へ戻る'}</button>
  <div className="activity-heading"><div className="section-overline">MY ACTIVITY</div><h1><Activity size={26}/>マイアクティビティ</h1><p className="activity-swipe-hint">右へスワイプで戻る</p></div>
  {!ready?<p role="status">プレイデータを読み込んでいます…</p>:error?<p className="transfer-error" role="alert">{error}</p>:<>
   <div className="activity-controls"><Tabs value={mode} onValueChange={value=>setMode(value as Mode)}><TabsList aria-label="アクティビティのプレイモード"><TabsTrigger value="SP">SP</TabsTrigger><TabsTrigger value="DP">DP</TabsTrigger></TabsList></Tabs>
    <label><span className="field-label">集計するスコア（曲一覧と共通）</span><Select value={source} onValueChange={value=>onSource(value as ScoreSource)}><SelectTrigger className="choice" aria-label="アクティビティのスコア対象"><SelectValue/></SelectTrigger><SelectContent position="popper">{sources.map(item=><SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></label>
    <label><span className="field-label">集計する楽曲</span><Select value={scope} onValueChange={value=>setScope(value as typeof scope)}><SelectTrigger className="choice" aria-label="アクティビティの収録状況"><SelectValue/></SelectTrigger><SelectContent position="popper"><SelectItem value="available">AC収録曲のみ</SelectItem><SelectItem value="all">全曲（AC未収録を含む）</SelectItem></SelectContent></Select></label>
   </div>
   <details className="activity-explanation"><summary>集計について</summary><p className="activity-help">現在の楽曲DB・全難易度で集計します。曲一覧の検索・絞り込み条件には連動しません。{sample&&'現在はサンプルDBです。全体設定から楽曲DBを更新してください。'}</p></details>
   {selection?<section className="activity-card activity-results"><h2>{selection.kind==='dj'?`DJ LEVEL ${selection.rank}`:lampLabels[selection.rank]} <small>{selectedCharts.length.toLocaleString()}譜面</small></h2><ul>{selectedCharts.slice(0,limit).map(chart=><li key={chart.id}><button className="activity-chart-link" disabled={disabled} onClick={()=>onChart(chart)}><strong>{names.get(chart.songId)}</strong><ChartFeatures chart={chart}/><small>{chart.mode} {chart.difficulty} ☆{chart.level||'?'} · {records[chart.id]?.djLevel??'記録なし'} · {lampLabels[records[chart.id]?.lamp??'NO PLAY']}</small></button></li>)}</ul>{!selectedCharts.length&&<p className="activity-help">対象の譜面はありません。</p>}{selectedCharts.length>limit&&<button className="load-more" onClick={()=>setLimit(n=>n+60)}>さらに表示（残り{selectedCharts.length-limit}譜面）</button>}</section>:<>
   <dl className="activity-totals"><div><dt>対象譜面</dt><dd>{summary.total.toLocaleString()}</dd></div><div><dt>保存記録あり</dt><dd>{summary.recorded.toLocaleString()}</dd></div><div><dt>うち手入力あり</dt><dd>{summary.manual.toLocaleString()}</dd></div></dl>
   <section className="activity-card"><h2>マイノーツレーダー</h2><div className="activity-radar-layout"><MyRadar values={summary.axes.map(value=>value.value)}/><dl className="activity-radar-values">{radarAxes.map((item,i)=><div key={item.key} style={{'--metric-color':item.color} as CSSProperties}><dt>{item.label}</dt><dd>{summary.axes[i].value.toFixed(2)}</dd><span>採用 {summary.axes[i].top.length} / 10曲</span></div>)}<div className="activity-radar-total"><dt>6項目合計</dt><dd>{summary.radarTotal.toFixed(2)}</dd></div></dl></div>
    <details className="activity-explanation"><summary>レーダーの計算方法・対象外の記録</summary><p className="activity-help">各譜面の「EXスコア ÷（総ノーツ数 × 2）× 各レーダー値」を計算し、小数第3位以下を切り捨てます。項目ごとに同じ曲の最高値を採用し、上位10曲の合計 ÷ 10も小数第3位以下を切り捨てます（どちらも小数第2位まで）。該当項目のレーダー値が0の譜面は候補から除外し、10曲未満の不足分は0として扱います。6項目合計は、表示された各マイレーダー値の合計です。</p>
    <p className="activity-help">スコア率80％・レーダー値150なら、その項目への計算値は120です。手入力のEXスコアも対象です。</p>
    {(summary.missingNotes>0||summary.missingRadar>0||summary.invalidScores>0)&&<p className="activity-help">スコアがある譜面のうち、ノーツ数未取得 {summary.missingNotes}譜面・レーダー全部または一部未掲載 {summary.missingRadar}譜面・スコア不整合 {summary.invalidScores}譜面。算出できない項目は対象外です。</p>}
    </details>
    {!summary.recorded&&<p className="activity-empty">この表示対象にはプレイ記録がありません。公式データを取り込むか、曲編集でスコアを手入力してください。</p>}
    <details className="activity-top"><summary>採用した上位10曲を見る</summary><Select value={axis} onValueChange={setAxis}><SelectTrigger className="choice" aria-label="上位10曲のレーダー項目"><SelectValue/></SelectTrigger><SelectContent position="popper">{radarAxes.map((item,i)=><SelectItem key={item.key} value={String(i)}>{item.label}</SelectItem>)}</SelectContent></Select>
     {summary.axes[Number(axis)].top.length>0&&<Table aria-label={`${radarAxes[Number(axis)].label}の上位10曲`}><TableHeader><TableRow><TableHead>曲名・譜面</TableHead><TableHead className="activity-number">スコア率</TableHead><TableHead className="activity-number">計算値</TableHead></TableRow></TableHeader><TableBody>{summary.axes[Number(axis)].top.map((item,index)=><TableRow key={item.chart.id}><TableCell><button className="activity-chart-link" disabled={disabled} onClick={()=>onChart(item.chart)}><strong>{index+1}. {names.get(item.chart.songId)}</strong><ChartFeatures chart={item.chart}/></button><small>{item.chart.difficulty} ☆{item.chart.level||'?'} · {scoreSeriesLabel(item.version)}{item.manual?' · 手入力':''}<br/>レーダー {item.radar.toFixed(2)}</small></TableCell><TableCell className="activity-number">{item.percent.toFixed(2)}%</TableCell><TableCell className="activity-number">{item.value.toFixed(2)}</TableCell></TableRow>)}</TableBody></Table>}
     {!summary.axes[Number(axis)].top.length&&<p className="activity-help">この項目に採用できる譜面はありません。</p>}
    </details>
   </section>
   <div className="activity-count-grid"><section className="activity-card"><h2>DJ LEVEL別の総譜面数</h2><dl className="activity-counts">{djLevels.map(rank=><div key={rank}><dt><button disabled={disabled} onClick={()=>openRank({kind:'dj',rank})}>{rank}</button></dt><dd><button disabled={disabled} aria-label={`${rank}の${summary.dj[rank]}譜面を表示`} onClick={()=>openRank({kind:'dj',rank})}>{summary.dj[rank].toLocaleString()}<small>譜面 ›</small></button></dd></div>)}</dl></section>
    <section className="activity-card"><h2>クリア状況別の総譜面数</h2><dl className="activity-counts">{[...lamps].reverse().map(lamp=><div key={lamp}><dt><button disabled={disabled} onClick={()=>openRank({kind:'clear',rank:lamp})}><span className={`clear-lamp lamp-${lamps.indexOf(lamp)}`}>{lampLabels[lamp]}</span></button></dt><dd><button disabled={disabled} aria-label={`${lampLabels[lamp]}の${summary.clear[lamp]}譜面を表示`} onClick={()=>openRank({kind:'clear',rank:lamp})}>{summary.clear[lamp].toLocaleString()}<small>譜面 ›</small></button></dd></div>)}</dl><details className="activity-explanation"><summary>クリア状況の集計について</summary><p className="activity-help">NO PLAYには、この表示対象で記録のない{summary.missing.toLocaleString()}譜面も含みます。歴代最高を選んだ場合のクリアは、各譜面の最新保存シリーズを使います。</p></details></section></div></> }
  </>}
 </div></div></main>;
}
