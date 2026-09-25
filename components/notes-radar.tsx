"use client";
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {type Chart,type CpiGauge} from '@/lib/iidx-data';
import {chartRating,cpiGauges,difficultyColors,radarAxes,radarPoint,type ClearGauge,type DifficultyTable,type RadarRange} from '@/lib/iidx-additional';

export function CommunityRating({chart,table,gauge,cpiGauge='hard',automatic=false}:{chart:Chart;table:DifficultyTable;gauge:ClearGauge;cpiGauge?:CpiGauge;automatic?:boolean}){
 const selected=automatic&&table!=='cpi'?(chart.mode==='DP'?'dp':chart.level===12?'sp12':chart.level===11?'sp11':'official'):table;
 if(selected==='official')return null;
 const value=chartRating(chart,selected,gauge,cpiGauge),prefix=selected==='cpi'?`CPI ${cpiGauges.find(g=>g.value===cpiGauge)?.label}`:selected==='dp'?'DP非公式':`SP☆${selected==='sp12'?'12':'11'} ${gauge==='hard'?'HARD':'ノマゲ'}`;
 return <span className={`community-rating ${value?'':'unlisted'}`}>{value?`${prefix} ${value.label}`:selected==='cpi'?'CPI：未掲載':'非公式：未掲載'}</span>;
}

export function RadarValues({chart,compact=false,sort=''}:{chart:Chart;compact?:boolean;sort?:string}){
 const values=chart.radar?.values.filter((value):value is number=>value!==null)??[];
 const maximum=values.length?Math.max(...values):null;
 return <span className={compact?'radar-values radar-values-compact':'radar-values'}>{radarAxes.map((axis,i)=>{
  const value=chart.radar?.values[i],isMaximum=typeof value==='number'&&value===maximum;
  return <span key={axis.key} className={`radar-metric ${value===0?'radar-zero':''} ${sort===axis.key?'radar-sort-metric':''}`} style={{'--metric-color':axis.color} as CSSProperties}><span>{axis.label}</span><strong>{value?.toFixed(2)??'—'}{isMaximum&&<><span className="radar-max-star" aria-hidden="true">★</span><span className="sr-only">（最大値）</span></>}</strong></span>;
 })}</span>;
}

export function NotesRadar({chart,sort='',title}:{chart:Chart;sort?:string;title:string}){
 const container=useRef<HTMLSpanElement>(null),[size,setSize]=useState(132);
 useEffect(()=>{const el=container.current;if(!el)return;const observer=new ResizeObserver(()=>setSize(Math.max(90,Math.round(el.getBoundingClientRect().width))));observer.observe(el);return()=>observer.disconnect();},[]);
 const complete=!!chart.radar&&chart.radar.values.every(v=>v!==null);
 const center=size/2,ring=(v:number)=>radarAxes.map((_,i)=>radarPoint(i,v??0,size).join(',')).join(' '),summary=chart.radar?radarAxes.map((a,i)=>`${a.label} ${chart.radar!.values[i]?.toFixed(2)??'未掲載'}`).join('、'):'レーダー未掲載';
 return <span className="notes-radar"><span className="radar-plot" ref={container}><svg className="radar-chart" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${title} ${chart.mode} ${chart.difficulty}。${summary}。基準100、外周200。`}><title>{`${title} ノーツレーダー`}</title><g fill="none" stroke="var(--radar-grid, #3b4b61)" strokeWidth="1"><polygon data-ring="200" points={ring(200)}/>{radarAxes.map((a,i)=>{const [x,y]=radarPoint(i,200,size);return <line key={a.key} x1={center} y1={center} x2={x} y2={y}/>;})}</g>{complete&&chart.radar&&<polygon data-radar-polygon={chart.difficulty} points={chart.radar.values.map((v,i)=>radarPoint(i,v??0,size).join(',')).join(' ')} fill={difficultyColors[chart.difficulty]} fillOpacity=".28" stroke={difficultyColors[chart.difficulty]} strokeWidth="1.5" strokeLinejoin="round"/>}<polygon data-ring="100" points={ring(100)} fill="none" stroke="var(--radar-outline, #92a2b9)" strokeWidth="1"/>{radarAxes.map((a,i)=>{const angle=-Math.PI/2+i*Math.PI/3,radius=center-11;return <text key={a.key} x={center+Math.cos(angle)*radius} y={center+Math.sin(angle)*radius} textAnchor="middle" dominantBaseline="middle" fontSize="12" className={chart.radar?.values[i]===0?'radar-axis-zero':'radar-axis-label'} style={{'--metric-color':a.color} as CSSProperties} fill={chart.radar?.values[i]===0?'var(--radar-zero, #8793a5)':a.color}>{a.short}</text>;})}{!complete&&<text x={center} y={center} textAnchor="middle" dominantBaseline="middle" fontSize="16" fill="var(--radar-label, #a5b5ca)">—</text>}</svg></span><RadarValues chart={chart} sort={sort}/>{!complete&&<span className="radar-unlisted">{chart.radar?'一部項目は未掲載':'レーダー未掲載'}</span>}</span>;
}

export function RadarFilters({ranges,onChange,error}:{ranges:RadarRange[];onChange:(value:RadarRange[])=>void;error:string}){
 return <div className="radar-filters"><div className="radar-filter-heading">ノーツレーダー<span>0〜200・複数条件可</span></div><div className="radar-ranges">{radarAxes.map((axis,i)=><div key={axis.key} className="radar-range" style={{'--metric-color':axis.color} as CSSProperties}><span>{axis.label}</span><span className="radar-range-inputs"><input type="number" inputMode="decimal" min="0" max="200" step="0.01" aria-label={`${axis.label} 下限`} placeholder="下限" value={ranges[i].min} onChange={e=>onChange(ranges.map((r,j)=>j===i?{...r,min:e.target.value}:r))}/><span aria-hidden="true">〜</span><input type="number" inputMode="decimal" min="0" max="200" step="0.01" aria-label={`${axis.label} 上限`} placeholder="上限" value={ranges[i].max} onChange={e=>onChange(ranges.map((r,j)=>j===i?{...r,max:e.target.value}:r))}/></span></div>)}</div>{error&&<p className="radar-error" role="alert">{error}</p>}</div>;
}
