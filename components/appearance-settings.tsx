"use client";
import {useState} from 'react';
import {Copy,Moon,Palette,RotateCcw} from 'lucide-react';
import {Switch} from '@/components/ui/switch';
import {seriesTitleColor,seriesTitleOutline,seriesTitleStyle,defaultOutlineColor,type SeriesColors,type SeriesOutlines,type Theme} from '@/lib/appearance';

export function AppearanceSettings({theme,onTheme,enabled,onEnabled,colors,onColors,outlines,onOutlines,onCopyTheme,seriesNames,disabled}:{theme:Theme;onTheme:(theme:Theme)=>void;enabled:boolean;onEnabled:(value:boolean)=>void;colors:SeriesColors;onColors:(colors:SeriesColors)=>void;outlines:SeriesOutlines;onOutlines:(outlines:SeriesOutlines)=>void;onCopyTheme:(series:number,from:Theme,to:Theme)=>void;seriesNames:Record<number,string>;disabled:boolean}){
 const entries=Object.entries(seriesNames).sort((a,b)=>Number(b[0])-Number(a[0]));
 const [selected,setSelected]=useState('');
 const series=entries.some(([id])=>id===selected)?selected:entries[0]?.[0];
 const color=seriesTitleColor(Number(series),theme,colors);
 const outline=seriesTitleOutline(Number(series),theme,outlines);
 const updateOutline=(patch:Partial<typeof outline>)=>{if(series)onOutlines({...outlines,[theme]:{...outlines[theme],[series]:{...outline,...patch}}});};
 return <section className="appearance-settings">
  <h3><Palette size={17}/>画面の表示</h3>
  <label className="switch-line"><span><Moon size={16}/>ダークモード</span><Switch aria-label="ダークモード" checked={theme==='dark'} disabled={disabled} onCheckedChange={value=>onTheme(value?'dark':'light')}/></label>
  <label className="switch-line"><span>曲名をシリーズ別に色分け</span><Switch aria-label="曲名をシリーズ別に色分け" checked={enabled} disabled={disabled} onCheckedChange={onEnabled}/></label>
  {enabled&&series&&<div className="series-color-settings">
   <label className="field-label" htmlFor="series-color-select">色を変更するシリーズ</label>
   <select id="series-color-select" className="choice" value={series} disabled={disabled} onChange={e=>setSelected(e.target.value)}>{entries.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select>
   <div className="series-color-row"><label htmlFor="series-title-color">曲名の色 <small>（{theme==='dark'?'ダーク':'ライト'}）</small></label><input id="series-title-color" type="color" value={color} disabled={disabled} onInput={e=>onColors({...colors,[theme]:{...colors[theme],[series]:e.currentTarget.value}})} onChange={e=>onColors({...colors,[theme]:{...colors[theme],[series]:e.target.value}})}/><button type="button" className="secondary-button" disabled={disabled||!colors[theme][series]} onClick={()=>{const next={...colors[theme]};delete next[series];onColors({...colors,[theme]:next});}}><RotateCcw size={14}/>標準に戻す</button></div>
   <label className="switch-line series-outline-toggle"><span>このシリーズの曲名に縁取り</span><Switch aria-label="このシリーズの曲名に縁取り" checked={outline.enabled} disabled={disabled} onCheckedChange={value=>updateOutline({enabled:value})}/></label>
   <div className="series-color-row"><label htmlFor="series-outline-color">縁取りの色 <small>（{theme==='dark'?'ダーク':'ライト'}）</small></label><input id="series-outline-color" type="color" value={outline.color} disabled={disabled||!outline.enabled} onInput={e=>updateOutline({color:e.currentTarget.value})} onChange={e=>updateOutline({color:e.target.value})}/><button type="button" className="secondary-button" disabled={disabled||!outline.enabled||outline.color===defaultOutlineColor(theme)} onClick={()=>updateOutline({color:defaultOutlineColor(theme)})}><RotateCcw size={14}/>標準に戻す</button></div>
   <div className="series-color-preview" style={seriesTitleStyle(Number(series),theme,colors,true,outlines)}>{seriesNames[Number(series)]} の曲名</div>
   <p>一覧と曲編集に反映します。文字色・縁取りの色とオン／オフは、シリーズ別・ライト／ダーク別に保存されます。</p>
   <div className="series-copy-actions" role="group" aria-label="選択中のシリーズの色設定をコピー"><button type="button" className="secondary-button" disabled={disabled} onClick={()=>onCopyTheme(Number(series),'dark','light')}><Copy size={14}/>ダーク → ライト</button><button type="button" className="secondary-button" disabled={disabled} onClick={()=>onCopyTheme(Number(series),'light','dark')}><Copy size={14}/>ライト → ダーク</button></div>
   <p className="series-copy-help">選択中のシリーズの文字色・縁取り設定をコピーします。コピー先は上書きされ、その後は個別に変更できます。</p>
  </div>}
 </section>;
}
