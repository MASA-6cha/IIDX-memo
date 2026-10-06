"use client";
import {useEffect,useRef,useState} from 'react';
import {ChevronRight,Copy,Moon,Palette,RotateCcw,X} from 'lucide-react';
import {Switch} from '@/components/ui/switch';
import {Dialog,DialogTrigger,DialogContent,DialogTitle,DialogDescription,DialogClose} from '@/components/ui/dialog';
import {seriesCode} from '@/lib/iidx-data';
import {seriesTitleColor,seriesTitleOutline,seriesTitleStyle,seriesTitleGradient,seriesTitleGradientStyle,defaultOutlineColor,type SeriesColors,type SeriesOutlines,type SeriesGradients,type Theme} from '@/lib/appearance';
import {TitleColorText} from './title-color-text';

export function AppearanceSettings({theme,onTheme,enabled,onEnabled,colors,onColors,gradients,onGradients,outlines,onOutlines,onCopyTheme,seriesNames,disabled}:{theme:Theme;onTheme:(theme:Theme)=>void;enabled:boolean;onEnabled:(value:boolean)=>void;colors:SeriesColors;onColors:(colors:SeriesColors)=>void;gradients:SeriesGradients;onGradients:(gradients:SeriesGradients)=>void;outlines:SeriesOutlines;onOutlines:(outlines:SeriesOutlines)=>void;onCopyTheme:(series:number,from:Theme,to:Theme)=>void;seriesNames:Record<number,string>;disabled:boolean}){
 const entries=Object.entries(seriesNames).sort((a,b)=>Number(b[0])-Number(a[0]));
 const [selected,setSelected]=useState('');
 const [listOpen,setListOpen]=useState(false);
 const editorRef=useRef<HTMLLabelElement>(null),selectedFromList=useRef(false);
 const series=entries.some(([id])=>id===selected)?selected:entries[0]?.[0];
 const color=seriesTitleColor(Number(series),theme,colors);
 const outline=seriesTitleOutline(Number(series),theme,outlines);
 const gradient=seriesTitleGradient(Number(series),theme,gradients);
 const [positionDraft,setPositionDraft]=useState(String(gradient.centerOffset));
 useEffect(()=>setPositionDraft(String(gradient.centerOffset)),[series,theme,gradient.centerOffset]);
 const updateGradient=(patch:Partial<typeof gradient>)=>{if(series)onGradients({...gradients,[theme]:{...gradients[theme],[series]:{...gradient,...patch}}});};
 const setPosition=(value:number)=>{const next=Math.max(-50,Math.min(50,Math.round(value)));setPositionDraft(String(next));updateGradient({centerOffset:next});};
 const updateOutline=(patch:Partial<typeof outline>)=>{if(series)onOutlines({...outlines,[theme]:{...outlines[theme],[series]:{...outline,...patch}}});};
 return <section className="appearance-settings">
  <h3><Palette size={17}/>画面の表示</h3>
  <label className="switch-line"><span><Moon size={16}/>ダークモード</span><Switch aria-label="ダークモード" checked={theme==='dark'} disabled={disabled} onCheckedChange={value=>onTheme(value?'dark':'light')}/></label>
  <label className="switch-line"><span>曲名をシリーズ別に色分け</span><Switch aria-label="曲名をシリーズ別に色分け" checked={enabled} disabled={disabled} onCheckedChange={onEnabled}/></label>
  {enabled&&series&&<div className="series-color-settings">
   <Dialog open={listOpen} onOpenChange={setListOpen}>
    <DialogTrigger asChild><button type="button" className="secondary-button series-colors-list-button" disabled={disabled} onClick={()=>{selectedFromList.current=false;}}><Palette size={16}/>シリーズカラーを一覧で確認</button></DialogTrigger>
    <DialogContent className="series-colors-dialog" showCloseButton={false} onCloseAutoFocus={event=>{if(selectedFromList.current){event.preventDefault();selectedFromList.current=false;editorRef.current?.scrollIntoView({block:'center'});editorRef.current?.focus({preventScroll:true});}}}>
     <div className="series-colors-dialog-heading"><DialogTitle>シリーズカラー一覧</DialogTitle><DialogClose asChild><button type="button" className="icon-button" aria-label="シリーズカラー一覧を閉じる"><X size={21}/></button></DialogClose></div>
     <DialogDescription>{theme==='dark'?'ダーク':'ライト'}モードの設定です。シリーズを選ぶと色の編集に移ります。</DialogDescription>
     <div className="series-colors-list">{entries.map(([id,name])=>{
      const numericId=Number(id),rowStyle=seriesTitleStyle(numericId,theme,colors,true,outlines),rowGradient=seriesTitleGradient(numericId,theme,gradients),rowOutline=seriesTitleOutline(numericId,theme,outlines),top=seriesTitleColor(numericId,theme,colors);
      return <button key={id} type="button" className={`series-colors-list-row ${id===series?'is-selected':''}`} aria-label={`${name}の色設定を編集`} aria-current={id===series?'true':undefined} disabled={disabled} onClick={()=>{selectedFromList.current=true;setSelected(id);setListOpen(false);}}>
       <span className="series-colors-number">{seriesCode(numericId)}</span><span className="series-colors-row-main"><span className="series-colors-row-name" style={rowStyle}><TitleColorText text={name} style={rowStyle} gradientStyle={seriesTitleGradientStyle(numericId,theme,colors,gradients,true)}/></span><span className="series-colors-row-details"><span className="series-color-chip" role="img" aria-label={`${rowGradient.enabled?'上の色':'文字色'} ${top}`} style={{background:top}}/>{rowGradient.enabled&&<span className="series-color-chip" role="img" aria-label={`下の色 ${rowGradient.bottomColor}`} style={{background:rowGradient.bottomColor}}/>}<span>{rowGradient.enabled?`上下2色 · 位置${rowGradient.centerOffset>0?'+':''}${rowGradient.centerOffset}%`:'単色'}{rowOutline.enabled?' · 縁取り':''}{id===series?' · 選択中':''}</span></span></span><ChevronRight size={18}/>
      </button>;
     })}</div>
    </DialogContent>
   </Dialog>
   <label ref={editorRef} tabIndex={-1} className="field-label" htmlFor="series-color-select">色を変更するシリーズ</label>
   <select id="series-color-select" className="choice" value={series} disabled={disabled} onChange={e=>setSelected(e.target.value)}>{entries.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select>
   <label className="switch-line"><span>上下2色のグラデーション</span><Switch aria-label="このシリーズの曲名を上下2色のグラデーションにする" checked={gradient.enabled} disabled={disabled} onCheckedChange={value=>updateGradient({enabled:value})}/></label>
   <div className="series-color-row"><label htmlFor="series-title-color">{gradient.enabled?'上の色':'曲名の色'} <small>（{theme==='dark'?'ダーク':'ライト'}）</small></label><input id="series-title-color" type="color" value={color} disabled={disabled} onInput={e=>onColors({...colors,[theme]:{...colors[theme],[series]:e.currentTarget.value}})} onChange={e=>onColors({...colors,[theme]:{...colors[theme],[series]:e.target.value}})}/><button type="button" className="secondary-button" disabled={disabled||!colors[theme][series]} onClick={()=>{const next={...colors[theme]};delete next[series];onColors({...colors,[theme]:next});}}><RotateCcw size={14}/>標準に戻す</button></div>
   {gradient.enabled&&<div className="series-gradient-settings">
    <div className="series-color-row"><label htmlFor="series-bottom-color">下の色 <small>（{theme==='dark'?'ダーク':'ライト'}）</small></label><input id="series-bottom-color" type="color" value={gradient.bottomColor} disabled={disabled} onInput={e=>updateGradient({bottomColor:e.currentTarget.value})} onChange={e=>updateGradient({bottomColor:e.target.value})}/></div>
    <label className="field-label" htmlFor="series-gradient-position">グラデーションの中央位置</label>
    <div className="series-gradient-position"><input type="range" aria-label="グラデーションの中央位置を上下に調整" min={-50} max={50} step={1} value={gradient.centerOffset} disabled={disabled} onChange={e=>setPosition(Number(e.target.value))}/><input id="series-gradient-position" type="number" inputMode="text" min={-50} max={50} step={1} value={positionDraft} disabled={disabled} onChange={e=>{const value=e.target.value;setPositionDraft(value);if(/^-?\d+$/.test(value)&&Number(value)>=-50&&Number(value)<=50)updateGradient({centerOffset:Number(value)});}} onBlur={()=>setPosition(positionDraft.trim()!==''&&Number.isFinite(Number(positionDraft))?Number(positionDraft):gradient.centerOffset)}/><span>%</span></div>
    <p>0＝中央、マイナス＝上、プラス＝下。−50〜＋50で調整できます。</p>
    <button type="button" className="secondary-button" disabled={disabled||gradient.centerOffset===0} onClick={()=>setPosition(0)}><RotateCcw size={14}/>中央に戻す</button>
   </div>}
   <label className="switch-line series-outline-toggle"><span>このシリーズの曲名に縁取り</span><Switch aria-label="このシリーズの曲名に縁取り" checked={outline.enabled} disabled={disabled} onCheckedChange={value=>updateOutline({enabled:value})}/></label>
   <div className="series-color-row"><label htmlFor="series-outline-color">縁取りの色 <small>（{theme==='dark'?'ダーク':'ライト'}）</small></label><input id="series-outline-color" type="color" value={outline.color} disabled={disabled||!outline.enabled} onInput={e=>updateOutline({color:e.currentTarget.value})} onChange={e=>updateOutline({color:e.target.value})}/><button type="button" className="secondary-button" disabled={disabled||!outline.enabled||outline.color===defaultOutlineColor(theme)} onClick={()=>updateOutline({color:defaultOutlineColor(theme)})}><RotateCcw size={14}/>標準に戻す</button></div>
   <div className="series-color-preview" style={seriesTitleStyle(Number(series),theme,colors,true,outlines)}><TitleColorText text={`${seriesNames[Number(series)]} の曲名`} style={seriesTitleStyle(Number(series),theme,colors,true,outlines)} gradientStyle={seriesTitleGradientStyle(Number(series),theme,colors,gradients,true)}/></div>
   <p>一覧と曲編集に反映します。上下の色・グラデーションの位置・縁取りは、シリーズ別・ライト／ダーク別に保存されます。</p>
   <div className="series-copy-actions" role="group" aria-label="選択中のシリーズの色設定をコピー"><button type="button" className="secondary-button" disabled={disabled} onClick={()=>onCopyTheme(Number(series),'dark','light')}><Copy size={14}/>ダーク → ライト</button><button type="button" className="secondary-button" disabled={disabled} onClick={()=>onCopyTheme(Number(series),'light','dark')}><Copy size={14}/>ライト → ダーク</button></div>
   <p className="series-copy-help">選択中のシリーズの文字色・グラデーション・縁取り設定をコピーします。コピー先は上書きされ、その後は個別に変更できます。</p>
  </div>}
 </section>;
}
