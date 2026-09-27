import {type Chart} from '@/lib/iidx-data';
import {lamps,lampLabels,type PlayScore,type SongPlayRecord} from '@/lib/play-data';
import {getScoreRate,formatScoreBenchmark,type ScoreBenchmark} from '@/lib/play-rate';
import {hasPlaySummary,type PlayDisplay} from '@/lib/play-display';
import {bestPlayScore,scoreSeriesLabel,type DisplayPlayScore} from '@/lib/play-history';
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@/components/ui/table';
import {manualScoreLabel} from '@/lib/play-edit';

function ScoreDifferences({benchmarks}:{benchmarks:ScoreBenchmark[]}){
 return <span className="play-differences" aria-label="基準点との差">{benchmarks.map((b,i)=><span key={b.label}>{i>0&&<span className="play-diff-divider"> / </span>}<span title={b.label==='MAX'&&b.difference===0?'MAX達成':`${b.label}基準点${b.difference>=0?'から':'まで'}${Math.abs(b.difference).toLocaleString()}点${b.difference>=0?'上':'不足'}`}>{formatScoreBenchmark(b)}</span></span>)}</span>;
}

function rateMessage(result:ReturnType<typeof getScoreRate>,chart:Chart,score:PlayScore|undefined){
 if(result.reason==='missing-notes')return chart.noteCount===undefined?'ノーツ数は「全体設定 → 楽曲DBを更新」で取得できます。':'ノーツ数が未掲載のため、スコア率を算出できません。';
 if(result.reason==='invalid-score')return 'EXスコアとノーツ数が一致しません。譜面と楽曲DBを確認してください。';
 if(result.reason==='missing-score')return score?.exScore===0?'EX 0・DJ LEVELなしのため、スコア率は未記録扱いです。':'EXスコア未取得のため、スコア率を算出できません。';
 return '';
}

export function PlayScoreSummary({score,chart,display}:{score:DisplayPlayScore|undefined;chart:Chart;display:PlayDisplay}){
 if(!hasPlaySummary(display))return null;
 if(!score)return display.clear?<span className="play-score-summary"><span className={`clear-lamp lamp-${lamps.indexOf('NO PLAY')}`}>{lampLabels['NO PLAY']}</span></span>:null;
 const rate=getScoreRate(score,chart.noteCount),text=rate.percent===null?'—':`${rate.percent.toFixed(2)}%`;
 return <span className="play-score-summary">
  {display.clear&&<span className={`clear-lamp lamp-${lamps.indexOf(score.lamp)}`}>{lampLabels[score.lamp]}</span>}
  {display.dj&&score.djLevel&&<span className="play-dj">{score.djLevel}</span>}
  {display.ex&&score.exScore!==null&&(score.lamp!=='NO PLAY'||score.exScore>0)&&<span className="play-ex">EX {score.exScore.toLocaleString()}</span>}
  {display.rate&&<span className={`play-rate ${rate.percent===null?'is-unavailable':''}`} aria-label={`スコア率 ${text}`} title={rateMessage(rate,chart,score)||undefined}>率 {text}</span>}
  {display.difference&&rate.benchmarks.length>0&&<ScoreDifferences benchmarks={rate.benchmarks}/>}
  {((display.clear&&score.manual?.lamp)||((display.ex||display.dj||display.rate||display.difference)&&score.manual?.score))&&<span className="manual-badge">手入力 {manualScoreLabel(score)}</span>}
  <span className="play-version">{score.best?`歴代最高 ${scoreSeriesLabel(score.gameVersion)}`:scoreSeriesLabel(score.gameVersion)}{score.best&&display.clear&&score.lampVersion!==score.gameVersion?` / クリア ${scoreSeriesLabel(score.lampVersion??null)}`:''}</span>
 </span>;
}

export function PlayScoreDetails({score,chart,display,sourceLabel,songRecord}:{songRecord?:SongPlayRecord;score:DisplayPlayScore|undefined;chart:Chart;display:PlayDisplay;sourceLabel?:string}){
 if(!hasPlaySummary(display)&&!display.notes)return null;
 const rate=getScoreRate(score,chart.noteCount),message=rateMessage(rate,chart,score);
 return <section className="editor-play"><h3>プレイデータ{sourceLabel&&<span className="score-source-label">{sourceLabel}</span>}</h3><dl>
  {display.clear&&<div><dt>CLEAR TYPE</dt><dd><span className={`clear-lamp lamp-${lamps.indexOf(score?.lamp??'NO PLAY')}`}>{lampLabels[score?.lamp??'NO PLAY']}</span>{score?.manual?.lamp&&<span className="manual-badge">手入力</span>}</dd></div>}
  {display.dj&&<div><dt>DJ LEVEL</dt><dd>{score?.djLevel??'—'}</dd></div>}
  {display.ex&&<div><dt>スコア（EX SCORE）</dt><dd>{score?.exScore?.toLocaleString()??'—'}{score?.manual?.score&&<span className="manual-badge">手入力</span>}</dd></div>}
  {display.rate&&<div><dt>スコア率</dt><dd className={rate.percent===null?'':'play-rate'}>{rate.percent===null?'—':`${rate.percent.toFixed(2)}%`}</dd></div>}
  {display.notes&&<div><dt>ノーツ数</dt><dd>{rate.notes?.toLocaleString()??'—'}</dd></div>}
  {display.difference&&<div><dt>基準点との差</dt><dd>{rate.benchmarks.length>0?<ScoreDifferences benchmarks={rate.benchmarks}/>:'—'}</dd></div>}
  {score&&<><div><dt>PGREAT</dt><dd>{score.pgreat?.toLocaleString()??'—'}</dd></div><div><dt>GREAT</dt><dd>{score.great?.toLocaleString()??'—'}</dd></div><div><dt>{score.best?'歴代最小MISS':'ミスカウント'}</dt><dd>{score.missCount??'—'}{score.best&&score.missCount!==null?` (${scoreSeriesLabel(score.missVersion??null)})`:''}</dd></div></>}
  {songRecord&&<><div><dt>プレー回数（曲・{chart.mode}{score?.best?'／保存シリーズ合計':''}）</dt><dd>{songRecord.playCount??'—'}</dd></div><div><dt>最終プレー日時（曲・{chart.mode}）</dt><dd>{songRecord.lastPlayedAt?new Date(songRecord.lastPlayedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}):'—'}</dd></div></>}
 </dl>
 {(display.rate||display.difference)&&message&&(score||rate.reason==='missing-notes')&&<p>{message}</p>}
 {score?<><p>{score.best?'最高EX：':''}{scoreSeriesLabel(score.gameVersion)} · {new Date(score.fetchedAt).toLocaleDateString('ja-JP')}記録{score.best?` / クリア：${scoreSeriesLabel(score.lampVersion??null)}（最新の保存記録）`:''}</p>{score.manual?.score&&<p>EX手入力：{new Date(score.manual.score).toLocaleString('ja-JP')}</p>}{score.manual?.lamp&&<p>クリア手入力：{new Date(score.manual.lamp).toLocaleString('ja-JP')}</p>}</>:<p>この表示対象の記録はありません。全体設定で表示するシリーズを変更できます。</p>}</section>;
}

export function PlayScoreHistory({scores,seriesNames,songRecords}:{songRecords?:Record<string,SongPlayRecord>;scores:PlayScore[];seriesNames:Record<number,string>}){
 if(!scores.length)return null;
 const best=bestPlayScore(scores)!;
 return <section className="editor-play score-history"><h3>シリーズ別の記録</h3>
  <div className="history-best"><span>歴代最高 EX</span><strong>{best.exScore?.toLocaleString()??'—'}</strong><span>{best.djLevel??''}</span><span className="history-series">{scoreSeriesLabel(best.gameVersion)}</span></div>
  <Table aria-label="保存済みのシリーズ別プレイデータ"><TableHeader><TableRow><TableHead>シリーズ</TableHead><TableHead>クリア</TableHead><TableHead>DJ</TableHead><TableHead className="history-number">EXスコア</TableHead><TableHead>PGREAT</TableHead><TableHead>GREAT</TableHead><TableHead>MISS</TableHead></TableRow></TableHeader><TableBody>
   {scores.map(score=><TableRow key={score.gameVersion??'unknown'}><TableCell title={score.gameVersion?seriesNames[score.gameVersion]:undefined}><span className="history-series">{score.gameVersion===null?'不明':`#${score.gameVersion}`}</span>{manualScoreLabel(score)&&<small className="manual-history" title={`手入力：${manualScoreLabel(score)}`}>手入力：{manualScoreLabel(score)}</small>}</TableCell><TableCell><span className={`clear-lamp lamp-${lamps.indexOf(score.lamp)}`}>{lampLabels[score.lamp]}</span></TableCell><TableCell>{score.djLevel??'—'}</TableCell><TableCell className={`history-number${score.gameVersion===best.gameVersion?' history-highest':''}`}>{score.exScore?.toLocaleString()??'—'}</TableCell><TableCell>{score.pgreat??'—'}</TableCell><TableCell>{score.great??'—'}</TableCell><TableCell>{score.missCount??'—'}</TableCell></TableRow>)}
  </TableBody></Table>
  {songRecords&&<><h4>曲単位の記録（選択中のSP／DP）</h4><Table aria-label="シリーズ別の曲プレー回数"><TableHeader><TableRow><TableHead>シリーズ</TableHead><TableHead>プレー回数</TableHead><TableHead>最終プレー日時（JST）</TableHead></TableRow></TableHeader><TableBody>{Object.values(songRecords).sort((a,b)=>(b.gameVersion??-1)-(a.gameVersion??-1)).map(r=><TableRow key={r.gameVersion??'unknown'}><TableCell>{scoreSeriesLabel(r.gameVersion)}</TableCell><TableCell>{r.playCount??'—'}</TableCell><TableCell className="whitespace-nowrap">{r.lastPlayedAt?new Date(r.lastPlayedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}):'—'}</TableCell></TableRow>)}</TableBody></Table><p>回数は譜面別ではありません。歴代では保存済みシリーズを合計します。既知シリーズがある場合、シリーズ不明の回数は合計に含めません。</p></>}
  <p>PGREAT・GREATは最高EXと同じ記録、歴代最小MISSは保存済み記録の最小値です。</p>
  <p>保存済みのシリーズのみ表示。クリアは各シリーズの保存内容です。同点の最高スコアは新しいシリーズを表示します。</p>
 </section>;
}
