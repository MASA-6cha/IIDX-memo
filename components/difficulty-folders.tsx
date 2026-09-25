"use client";
import {ChevronLeft,ChevronRight,Folder} from 'lucide-react';
import {type DifficultyFolder} from '@/lib/difficulty-folders';
import {clearColumns,djColumns,type FolderSummaryMode} from '@/lib/folder-summary';
import {Popover,PopoverContent,PopoverTrigger} from '@/components/ui/popover';

export function DifficultyFolderList({folders,onOpen,summaryMode,onSummaryModeChange,prefix='',listLabel='難易度フォルダ一覧',opensSubfolders=false}:{folders:DifficultyFolder[];onOpen:(key:string)=>void;summaryMode:FolderSummaryMode;onSummaryModeChange:(mode:FolderSummaryMode)=>void;prefix?:string;listLabel?:string;opensSubfolders?:boolean}){
 const showDj=summaryMode==='dj'||summaryMode==='both',showClear=summaryMode==='clear'||summaryMode==='both';
 const unknown=folders.some(f=>f.summary.dj.unknown>0),columns=djColumns.filter(c=>c.key!=='unknown'||unknown);
 const mixed=folders.some(f=>f.chartCount!==f.songCount),unit=mixed?'譜面':'曲';
 const total=(folder:DifficultyFolder)=>`${folder.songCount}曲${folder.chartCount!==folder.songCount?`・${folder.chartCount}譜面`:''}`;
 const details=(folder:DifficultyFolder)=>[
  showDj?'DJ LEVEL：'+columns.filter(c=>folder.summary.dj[c.key]>0).map(c=>`${c.title} ${folder.summary.dj[c.key]}${unit}`).join('、'):'',
  showClear?'クリアタイプ：'+clearColumns.filter(c=>folder.summary.clear[c.key]>0).map(c=>`${c.title} ${folder.summary.clear[c.key]}${unit}`).join('、'):'',
 ].filter(Boolean).join('。');
 return <>
  <div className="folder-summary-controls"><span>フォルダの内訳</span><div role="group" aria-label="フォルダに表示する内訳">
   {([['none','なし'],['dj','DJ LEVEL'],['clear','クリアタイプ'],['both','両方']] as const).map(([mode,label])=><button type="button" key={mode} aria-pressed={summaryMode===mode} onClick={()=>onSummaryModeChange(mode)}>{label}</button>)}
  </div></div>
  {prefix&&<p className="folder-summary-prefix">{prefix}</p>}
  <div className="difficulty-folder-list compact-folders" data-summary={summaryMode} aria-label={prefix?`${prefix} フォルダ一覧`:listLabel}>
   {folders.map(folder=>{
    const longName=folder.label!==folder.shortLabel||folder.shortLabel.length>7;
    const identity=<><Folder size={16} aria-hidden="true"/><span className="folder-identity-text"><span className="difficulty-folder-label">{folder.shortLabel}</span>{summaryMode!=='none'&&<span className={`difficulty-folder-count ${folder.chartCount!==folder.songCount?'mixed-count':''}`}>{total(folder)}</span>}</span></>;
    return <div key={folder.key} className={`difficulty-folder-row${folder.chartCount===0?' empty-folder':''}`}>
     {longName?<Popover><PopoverTrigger asChild><button type="button" className="folder-identity" title={folder.label} aria-label={`${folder.label}：フォルダ名の全文を表示`}>{identity}</button></PopoverTrigger><PopoverContent className="folder-name-popover" align="start"><strong>{folder.label}</strong><span>{total(folder)}</span><button type="button" className="secondary-button" disabled={folder.chartCount===0} onClick={()=>onOpen(folder.key)}>{opensSubfolders&&folder.key!=='missing'?'小数点別フォルダを開く':'曲一覧を開く'}<ChevronRight size={15}/></button></PopoverContent></Popover>:<button type="button" className="folder-identity" disabled={folder.chartCount===0} onClick={()=>onOpen(folder.key)} aria-label={`${folder.label}、${total(folder)}を開く`}>{identity}</button>}
     <button type="button" className="folder-open" disabled={folder.chartCount===0} onClick={()=>onOpen(folder.key)} aria-label={`${folder.label}、${total(folder)}を開く${summaryMode==='none'||folder.chartCount===0?'':'。'+details(folder)}`}>
      <span className="folder-row-stats" aria-hidden="true">
       {showDj&&<span className="folder-metrics" style={{gridTemplateColumns:`repeat(${columns.length},minmax(0,1fr))`}}>{columns.map(c=><span key={c.key} className={`folder-metric tone-${c.tone}${folder.summary.dj[c.key]===0?' zero':''}`} title={`DJ LEVEL ${c.title}：${folder.summary.dj[c.key]}${unit}`}><span>{c.label}</span><strong style={{fontSize:folder.summary.dj[c.key]>=10000?'.375rem':folder.summary.dj[c.key]>=1000?'.4375rem':undefined}}>{folder.summary.dj[c.key]}</strong></span>)}</span>}
       {showClear&&<span className="folder-metrics clear-metrics">{clearColumns.map(c=><span key={c.key} className={`folder-metric tone-${c.tone}${folder.summary.clear[c.key]===0?' zero':''}`} title={`${c.title}：${folder.summary.clear[c.key]}${unit}`}><span>{c.label}</span><strong style={{fontSize:folder.summary.clear[c.key]>=10000?'.375rem':folder.summary.clear[c.key]>=1000?'.4375rem':undefined}}>{folder.summary.clear[c.key]}</strong></span>)}</span>}
       {summaryMode==='none'&&<span className="folder-plain-count">{total(folder)}</span>}
      </span><ChevronRight size={12} aria-hidden="true"/>
     </button>
    </div>;
   })}
  </div>
  <div className="folder-summary-legend">
   {summaryMode==='both'&&<span>上段：DJ LEVEL ／ 下段：クリアタイプ</span>}
   {summaryMode!=='none'&&mixed&&<span>内訳は譜面数です。同じ曲の複数譜面はそれぞれ集計します。</span>}
   {folders.some(f=>f.label!==f.shortLabel||f.shortLabel.length>7)&&<span>長いフォルダ名はタップで全文表示。右側をタップで{opensSubfolders?'小数点別フォルダ':'曲一覧'}。</span>}
   {summaryMode!=='none'&&<details><summary>略称について</summary>{showDj&&<p>DJ LEVEL：無＝スコアなし（0点・スコア未記録）　未＝未取得{unknown?'　不明＝スコアはありますがDJ LEVELを判定できません':''}</p>}{showClear&&<p>クリアタイプ：FC＝FULL COMBO　EXH＝EX HARD　H＝HARD　C＝CLEAR　E＝EASY　AS＝ASSIST　F＝FAILED　NP＝未プレー　未＝未取得</p>}</details>}
  </div>
 </>;
}
export function DifficultyFolderHeading({folder,onBack,backLabel='フォルダ一覧'}:{folder:DifficultyFolder;onBack:()=>void;backLabel?:string}){
 return <div className="difficulty-folder-heading"><button className="secondary-button" onClick={onBack}><ChevronLeft size={16}/>{backLabel}</button><div><Folder size={17}/><span>{folder.label}</span></div>{folder.description&&<p>{folder.description}</p>}</div>;
}
