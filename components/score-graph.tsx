"use client";
import {useState,type CSSProperties} from 'react';
import {type Chart} from '@/lib/iidx-data';
import {type PlayScore} from '@/lib/play-data';
import {buildScoreGraph,defaultScoreGraphColors,type ScoreGraphColors} from '@/lib/score-graph';
import {formatScoreBenchmark} from '@/lib/play-rate';

const gradeClass=(grade:string)=>`score-grade-${['MAX','AAA','AA','A'].includes(grade)?grade.toLowerCase():'low'}`;

export function ScoreGraph({chart,scores,versions,unknown,colors,seriesNames}:{chart:Chart;scores:Record<string,PlayScore>|undefined;versions:number[];unknown:boolean;colors:ScoreGraphColors;seriesNames:Record<number,string>}){
 const graph=buildScoreGraph(scores,versions,unknown,chart.noteCount);
 const [page,setPage]=useState(0),[picked,setPicked]=useState<string|null>(null);
 const pageCount=Math.max(1,Math.ceil(graph.rows.length/5)),activePage=Math.min(page,pageCount-1);
 const end=graph.rows.length-activePage*5,rows=graph.rows.slice(Math.max(0,end-5),end);
 const selected=rows.find(r=>r.key===picked)??rows.at(-1);
 const label=(version:number|null)=>version===null?'不明':`#${version}`;
 const styles={'--score-current':colors.current,'--score-past':colors.past} as CSSProperties;
 if(!Object.keys(scores??{}).length)return <section className="score-graph score-graph-empty" aria-label="スコアグラフ"><p>この譜面のスコア記録はありません。</p><small>全体設定から公式CSVなどを取り込むと表示します。</small></section>;
 return <section className="score-graph" style={styles} aria-label={`${chart.mode} ${chart.difficulty}のシリーズ別スコアグラフ`}>
  <div className="score-graph-summary"><span>今作 {graph.currentVersion===null?'未設定':`#${graph.currentVersion}`}</span><strong>{graph.current?.value?.toLocaleString()??'—'}</strong>{graph.current?.rank&&<span className={gradeClass(graph.current.rank)}>{graph.current.rank}</span>}<small>過去最高比 {graph.delta===null?'—':`${graph.delta>=0?'+':''}${graph.delta.toLocaleString()}`}</small></div>
  <div className="score-graph-legend"><span><i className="score-current-swatch"/>今作（最新保存シリーズ）</span><span><i/>過去作・不明</span></div>
  <div className="score-graph-chart"><div className="score-graph-plot">
   {(graph.maxExScore===null?[{label:'上限',point:graph.ceiling},{label:'0',point:0}]:[{label:'MAX',point:graph.maxExScore},{label:'AAA',point:Math.ceil(graph.maxExScore*8/9)},{label:'AA',point:Math.ceil(graph.maxExScore*7/9)},{label:'A',point:Math.ceil(graph.maxExScore*6/9)},{label:'B',point:Math.ceil(graph.maxExScore*5/9)},{label:'0',point:0}]).map(line=><div key={line.label} className="score-graph-line" style={{bottom:`${line.point/graph.ceiling*100}%`}}><span className={graph.maxExScore!==null&&line.label!=='0'?gradeClass(line.label):undefined}>{line.label}</span></div>)}
   <div className="score-graph-bars">{rows.map(row=><button type="button" key={row.key} className={`score-graph-bar ${row.current?'is-current':''}`} aria-pressed={selected?.key===row.key} aria-label={`${label(row.version)} ${row.current?'今作 ':''}EXスコア ${row.invalid?'ノーツ数と不一致':row.value??'記録なし'}${row.rank?` ${row.rank}`:''}${row.nearest?` ${formatScoreBenchmark(row.nearest)}`:''}`} onClick={()=>setPicked(row.key)} style={{'--score-height':`${(row.value??0)/graph.ceiling*100}%`} as CSSProperties}><span className="score-graph-fill"/><span className="score-graph-value">{row.invalid?'!':row.value?.toLocaleString()??'—'}{row.rank&&<> <b className={gradeClass(row.rank)}>{row.rank}</b></>}</span>{row.nearest!==null&&(row.value??0)/graph.ceiling*165>=30&&<span className="score-graph-benchmark"><b className={gradeClass(row.nearest.label)}>{row.nearest.label}</b>{row.nearest.label==='MAX'&&row.nearest.difference===0?'':` ${row.nearest.difference>=0?'+':'−'}${Math.abs(row.nearest.difference).toLocaleString()}`}</span>}<span className="score-graph-label">{label(row.version)}{row.current&&<small>今作</small>}</span></button>)}</div>
  </div></div>
  <div className="score-graph-foot"><span>{graph.maxExScore===null?`表示上限 ${graph.ceiling.toLocaleString()}`:`MAX ${graph.maxExScore.toLocaleString()}`} ／ 歴代最高 {graph.best?.toLocaleString()??'—'}</span><span>棒をタップで詳細</span></div>
  {pageCount>1&&<div className="score-graph-pages"><button type="button" className="secondary-button" disabled={activePage===pageCount-1} onClick={()=>{setPage(activePage+1);setPicked(null);}}>以前のシリーズ</button><span>{activePage+1} / {pageCount}</span><button type="button" className="secondary-button" disabled={activePage===0} onClick={()=>{setPage(activePage-1);setPicked(null);}}>新しいシリーズ</button></div>}
  {graph.maxExScore===null&&<p className="score-graph-notice">ノーツ数未取得：保存スコアの最大値を上限に表示。ランク基準線・スコア率は表示できません。</p>}
  {graph.rows.some(r=>r.invalid)&&<p className="score-graph-notice">ノーツ数と一致しないスコアがあります。「!」の記録と譜面情報を確認してください。</p>}
  {selected&&<div className="score-graph-detail" aria-live="polite"><strong>{label(selected.version)} {selected.version===null?'シリーズ不明':seriesNames[selected.version]??''}{selected.current?' · 今作':''}</strong>{selected.score?<><dl><div><dt>EX SCORE</dt><dd>{selected.score.exScore?.toLocaleString()??'—'}</dd></div><div><dt>DJ LEVEL</dt><dd>{selected.score.djLevel??'—'}</dd></div><div><dt>スコア率</dt><dd>{selected.rate.percent===null?'—':`${selected.rate.percent.toFixed(2)}%`}</dd></div><div><dt>MISS COUNT</dt><dd>{selected.score.missCount??'—'}</dd></div></dl>{selected.value===null&&<p>{selected.invalid?'ノーツ数と不一致のため棒は表示しません。':'EXスコアは未記録です。'}</p>}{selected.score.manual?.score&&<p>手入力スコア</p>}</>:<p>このシリーズの記録はありません。</p>}</div>}
 </section>;
}

export function ScoreGraphSettings({colors,onChange,disabled}:{colors:ScoreGraphColors;onChange:(colors:ScoreGraphColors)=>void;disabled:boolean}){
 return <section><h3>スコアグラフの色</h3>{(['current','past'] as const).map(key=><div className="series-color-row" key={key}><label htmlFor={`score-color-${key}`}>{key==='current'?'今作':'過去作'}</label><input id={`score-color-${key}`} type="color" aria-label={`${key==='current'?'今作':'過去作'}のスコアグラフ色`} value={colors[key]} disabled={disabled} onInput={e=>onChange({...colors,[key]:e.currentTarget.value})} onChange={e=>onChange({...colors,[key]:e.target.value})}/><button type="button" className="secondary-button" disabled={disabled} onClick={()=>onChange({...colors,[key]:defaultScoreGraphColors()[key]})}>標準に戻す</button></div>)}<p>今作は、端末内に保存された最新のシリーズ番号です。過去作・シリーズ不明は共通色で表示します。一覧と曲編集に反映し、バックアップにも保存します。</p></section>;
}
