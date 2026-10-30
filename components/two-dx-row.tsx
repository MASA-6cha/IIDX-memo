import {type CSSProperties} from 'react';
import {commonDisplay,hasLegacyDisplayConflict,seriesCode,type Chart,type Song,type Note,type Side,type SideSettings} from '@/lib/iidx-data';
import {radarAxes} from '@/lib/iidx-additional';
import {type DisplayPlayScore} from '@/lib/play-history';
import {type PlayDisplay} from '@/lib/play-display';
import {lampLabels} from '@/lib/play-data';
import {twoDxScore,twoDxLamps,twoDxBoundaries,twoDxBoundaryLeft,twoDxRadarText} from '@/lib/two-dx';
import {TitleColorText} from '@/components/title-color-text';

const radarShort=['NOT','PEA','SCR','SOF','CHG','CHD'];
const coverNames:Record<string,string>={OFF:'表示OFF','SUDDEN+':'SUD+','HIDDEN+':'HID+','SUDDEN+ & HIDDEN+':'SUD+ / HID+',LIFT:'LIFT','LIFT & SUDDEN+':'LIFT / SUD+'};
const placement=(side:SideSettings)=>`${side.style}${side.autoScratch?' +AS':''}${side.legacyNote?' +LEG':''}`;

export function TwoDxListHeading({radar}:{radar:boolean}){
 return <div className="two-dx-heading">
  <div className="two-dx-columns" aria-hidden="true"><span>DJ</span><span>灯</span><span>LV</span><span className="two-dx-heading-body"><span>曲名</span><span>{radar?'レーダー':'オプション'}</span></span></div>
  {radar&&<div className="two-dx-radar-legend">{radarAxes.map((axis,i)=><span key={axis.key} style={{'--metric-color':axis.color} as CSSProperties}>{radarShort[i]} : {axis.label}</span>)}</div>}
  <div className="two-dx-scale" aria-label="スコア率：右端0%、難度枠の右端が100%"><span className="two-dx-scale-ends"><span>100% ←</span><span>スコア率</span><span>← 0%</span></span><span className="two-dx-scale-ranks" aria-hidden="true">{twoDxBoundaries.map(([label,step])=><span key={label} style={{left:`${twoDxBoundaryLeft(step)}%`}}>{label}</span>)}</span></div>
 </div>;
}

function TwoDxOptions({note,chart,side,showLift}:{note?:Note;chart:Chart;side:Side;showLift:boolean}){
 if(!note)return <span className="two-dx-options two-dx-unset">未設定</span>;
 const settings=side==='1P'?note.left:note.right,display=chart.mode==='DP'?commonDisplay(note):settings;
 const conflict=chart.mode==='DP'&&hasLegacyDisplayConflict(note);
 return <span className="two-dx-options">
  <span className="two-dx-option-mode">{chart.mode==='DP'?<><span>1P {placement(note.left)}</span><span>2P {placement(note.right)}</span>{note.flip&&<span>FLIP</span>}{note.link!=='OFF'&&<span>{note.link==='SYNCHRONIZE'?'SYNC':'SYMM'}</span>}</>:<span>{placement(settings)}</span>}<small>{conflict?'表示設定を確認':coverNames[display.cover]??display.cover}</small></span>
  {!conflict&&<span className={`two-dx-option-values ${showLift?'':'no-lift'}`}><span><small>白</small><b>{display.whiteTop||'—'}</b></span>{showLift&&<span><small>LIFT</small><b>{display.whiteBottom||'—'}</b></span>}<span><small>緑</small><b>{display.green||'—'}</b></span></span>}
 </span>;
}

function TwoDxRadar({chart,sort}:{chart:Chart;sort:string}){
 const valid=chart.radar?.values.filter((v):v is number=>typeof v==='number'&&Number.isFinite(v))??[],maximum=valid.length?Math.max(...valid):null;
 return <span className="two-dx-radar" aria-label="ノーツレーダー数値">{radarAxes.map((axis,i)=>{
  const value=chart.radar?.values[i],text=twoDxRadarText(value),max=typeof value==='number'&&value>0&&value===maximum;
  return <span key={axis.key} className={`two-dx-radar-item ${value===0||text==='—'?'is-zero':''} ${sort===axis.key?'is-sorted':''}`} style={{'--metric-color':axis.color} as CSSProperties} title={`${axis.label} ${text}${max?'（最大値）':''}`} aria-label={`${axis.label} ${text}${max?'（最大値）':''}`}><span className="two-dx-radar-label">{radarShort[i]}{max&&<span className="two-dx-radar-star" aria-hidden="true">★</span>}</span><span className="two-dx-radar-number">{text}</span></span>;
 })}</span>;
}

export function TwoDxChartButton({chart,song,note,side,showLift,radar,sort,score,showPlayData,display,titleStyle,gradientStyle,disabled,onOpen}:{
 chart:Chart;song:Song;note?:Note;side:Side;showLift:boolean;radar:boolean;sort:string;score?:DisplayPlayScore;showPlayData:boolean;display:PlayDisplay;titleStyle?:CSSProperties;gradientStyle?:CSSProperties;disabled:boolean;onOpen:()=>void;
}){
 const data=twoDxScore(score,chart),lamp=twoDxLamps[data.lamp],showScore=showPlayData&&(display.dj||display.rate||display.ex);
 const label=`${song.title} ${chart.mode} ${chart.difficulty} レベル${chart.level||'不明'}の設定を開く`;
 return <button type="button" className="two-dx-open" onClick={onOpen} disabled={disabled} aria-label={label}>
  <span className={`two-dx-dj grade-${showPlayData&&display.dj?data.grade??'none':'none'}`} aria-label={showScore?`DJ ${display.dj?data.grade??'未取得':'非表示'}、スコア率 ${display.rate?data.rateText:'非表示'}、EXスコア ${display.ex?data.scoreText:'非表示'}`:'プレイデータ非表示'}><span className="two-dx-grade">{showPlayData&&display.dj?data.grade??'—':'—'}</span><span className="two-dx-rate">{showPlayData&&display.rate?data.rateText:'—'}</span><span className="two-dx-ex">{showPlayData&&display.ex?data.scoreText:'—'}</span></span>
  <span className={`two-dx-lamp lamp-${lamp.key} ${showPlayData&&display.clear?'':'is-hidden'}`} style={{'--lamp-color':lamp.color} as CSSProperties} role="img" aria-label={showPlayData&&display.clear?`クリア状況 ${lampLabels[data.lamp]}`:'クリア状況非表示'}/>
  <span className={`two-dx-level ${chart.difficulty.toLowerCase()}`} title={`${chart.difficulty} ☆${chart.level||'?'}`}><span className="two-dx-number">{chart.level||'?'}</span><small>{chart.difficulty[0]}</small></span>
  <span className="two-dx-body"><span className="two-dx-song"><span className="two-dx-title" style={titleStyle}><TitleColorText text={song.title} style={titleStyle} gradientStyle={gradientStyle}/></span><span className="two-dx-meta">{seriesCode(song.series)} · BPM {chart.bpm??song.bpm}{(chart.soflan??song.soflan)?' · ソフラン':''}</span></span>{radar?<TwoDxRadar chart={chart} sort={sort}/>:<TwoDxOptions note={note} chart={chart} side={side} showLift={showLift}/>}</span>
  {showPlayData&&display.rate&&<span className="two-dx-score-track" aria-label={`スコア率 ${data.rateText}。右端から左へ表示`}><span className="two-dx-score-fill" style={{width:`${data.rate??0}%`}}/><span className="two-dx-score-ticks" aria-hidden="true">{twoDxBoundaries.map(([rank,step])=><span key={rank} className={step>=6?'major':''} style={{left:`${twoDxBoundaryLeft(step)}%`}}/>)}</span></span>}
 </button>;
}
