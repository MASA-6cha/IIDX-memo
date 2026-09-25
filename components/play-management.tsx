"use client";
import {useMemo,useRef,useState} from 'react';
import {Pencil,Trash2,Loader2,X} from 'lucide-react';
import {Checkbox} from '@/components/ui/checkbox';
import {Input} from '@/components/ui/input';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {AlertDialog,AlertDialogContent,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {lamps,lampLabels,type PlayHistory,type PlayScore,type ClearLamp} from '@/lib/play-data';
import {storedPlayVersions,type ScoreSource} from '@/lib/play-history';
import {djLevelForScore,playSeriesCounts,type ManualPlayInput} from '@/lib/play-edit';
import {type Chart} from '@/lib/iidx-data';

function VersionSelect({value,onChange,items,disabled,label}:{value:string;onChange:(key:string)=>void;items:{key:string;label:string}[];disabled:boolean;label:string}){
 return <Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger className="choice" aria-label={label}><SelectValue placeholder="シリーズを選択"/></SelectTrigger><SelectContent position="popper">{items.map(item=><SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>)}</SelectContent></Select>;
}
const seriesLabel=(key:string,names:Record<number,string>)=>key==='unknown'?'シリーズ不明':`#${key}${names[Number(key)]?` ${names[Number(key)]}`:''}`;

export function ScoreSeriesDelete({history,seriesNames,disabled,onDelete}:{history:PlayHistory;seriesNames:Record<number,string>;disabled:boolean;onDelete:(version:number|null)=>Promise<void>}){
 const counts=useMemo(()=>playSeriesCounts(history),[history]);
 const [selection,setSelection]=useState(''),[confirm,setConfirm]=useState(false),[deleting,setDeleting]=useState(false),[error,setError]=useState('');
 const lock=useRef(false);
 const selected=counts.find(item=>item.key===selection)??counts[0];
 const remove=async()=>{
  if(!selected||disabled||lock.current)return;
  lock.current=true;setDeleting(true);setError('');
  try{await onDelete(selected.version);setConfirm(false);setSelection('');}
  catch(e){setError(e instanceof Error?e.message:'削除できませんでした。');}
  finally{lock.current=false;setDeleting(false);}
 };
 return <section className="score-management"><h3><Trash2 size={17}/>シリーズ別のスコア削除</h3>
  {!selected?<p>削除できるスコアデータはありません。</p>:<>
   <label className="field-label">削除する取得シリーズ</label><VersionSelect label="削除する取得シリーズ" value={selected.key} onChange={setSelection} disabled={disabled||deleting} items={counts.map(item=>({key:item.key,label:`${seriesLabel(item.key,seriesNames)} · ${item.SP+item.DP}譜面`}))}/>
   <p>SP {selected.SP.toLocaleString()}譜面 ／ DP {selected.DP.toLocaleString()}譜面{selected.manual>0&&`（手入力を含む ${selected.manual}譜面）`}</p>
   <button className="secondary-button delete-series-button" disabled={disabled||deleting} onClick={()=>{setError('');setConfirm(true);}}><Trash2 size={15}/>このシリーズのデータを削除</button>
   <p>EXスコア・DJ LEVEL・クリア状況を、手入力分も含めて削除します。曲別オプション・コメント・お気に入り・他シリーズは残ります。</p>
  </>}
  <AlertDialog open={confirm} onOpenChange={value=>{if(!lock.current)setConfirm(value);}}><AlertDialogContent className="save-confirm"><AlertDialogTitle>シリーズのスコアデータを削除しますか？</AlertDialogTitle><AlertDialogDescription>{selected&&`${seriesLabel(selected.key,seriesNames)}：SP ${selected.SP}譜面・DP ${selected.DP}譜面を削除します。手入力の記録も対象です。`}この操作は取り消せません。必要な記録は先にエクスポートしてください。</AlertDialogDescription>{error&&<p className="transfer-error" role="alert">{error}</p>}<AlertDialogFooter><AlertDialogCancel disabled={deleting}>キャンセル</AlertDialogCancel><AlertDialogAction className="delete-series-button" disabled={disabled||deleting} onClick={e=>{e.preventDefault();void remove();}}>{deleting?'削除中…':'削除する'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </section>;
}

export function ManualPlayEditor({chart,title,history,seriesNames,source,disabled,onSave}:{chart:Chart;title:string;history:PlayHistory;seriesNames:Record<number,string>;source:ScoreSource;disabled:boolean;onSave:(input:ManualPlayInput)=>Promise<void>}){
 const [open,setOpen]=useState(false),[version,setVersion]=useState('unknown'),[scoreEnabled,setScoreEnabled]=useState(false),[lampEnabled,setLampEnabled]=useState(false),[exText,setExText]=useState(''),[lamp,setLamp]=useState<ClearLamp>('NO PLAY'),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const [discardTarget,setDiscardTarget]=useState<string|null|undefined>(undefined);
 const lock=useRef(false);
 const versions=useMemo(()=>[...new Set([...Object.keys(seriesNames).map(Number).filter(v=>Number.isInteger(v)&&v>0&&v<=999),...storedPlayVersions(history).versions])].sort((a,b)=>b-a),[seriesNames,history]);
 const available=useMemo(()=>storedPlayVersions(history),[history]);
 const initialVersion=source==='unknown'?'unknown':source.startsWith('version:')?source.slice(8):String(available.versions[0]??versions[0]??'unknown');
 const options=[...new Set([...(initialVersion==='unknown'?[]:[initialVersion]),...versions.map(String)])].sort((a,b)=>Number(b)-Number(a)).map(key=>({key,label:seriesLabel(key,seriesNames)}));options.push({key:'unknown',label:'シリーズ不明'});
 const reset=(key:string)=>{const saved=history[chart.id]?.[key];setVersion(key);setExText(saved?.exScore?.toString()??'');setLamp(saved?.lamp??'NO PLAY');setScoreEnabled(false);setLampEnabled(false);setError('');};
 const pending=scoreEnabled||lampEnabled;
 const requestChange=(target:string|null)=>{if(lock.current)return;if(pending){setDiscardTarget(target);return;}if(target===null)setOpen(false);else reset(target);};
 const previous:PlayScore|undefined=history[chart.id]?.[version];
 const numeric=exText.trim()===''?null:Number(exText);
 const rank=djLevelForScore(numeric,chart.noteCount);
 const save=async()=>{
  if(disabled||lock.current)return;setError('');
  if(!pending){setError('更新する項目を選んでください。');return;}
  if(scoreEnabled&&exText.trim()!==''&&!/^\d+$/.test(exText.trim())){setError('EXスコアは0以上の整数で入力してください。');return;}
  lock.current=true;setSaving(true);
  try{await onSave({gameVersion:version==='unknown'?null:Number(version),...(scoreEnabled?{exScore:numeric}:{}),...(lampEnabled?{lamp}:{})});setScoreEnabled(false);setLampEnabled(false);setOpen(false);}
  catch(e){setError(e instanceof Error?e.message:'保存できませんでした。');}
  finally{lock.current=false;setSaving(false);}
 };
 return <>
  <button className="secondary-button manual-play-trigger" disabled={disabled} onClick={()=>{reset(initialVersion);setOpen(true);}}><Pencil size={14}/>スコア・クリアを手入力</button>
  <Dialog open={open} onOpenChange={value=>{if(!value)requestChange(null);}}><DialogContent className="manual-play-dialog" showCloseButton={false}>
   <div className="sheet-heading"><DialogTitle>スコア・クリアの手入力</DialogTitle><button className="icon-button" aria-label="手入力を閉じる" disabled={saving} onClick={()=>requestChange(null)}><X size={20}/></button></div>
   <DialogDescription>{title} · {chart.mode} {chart.difficulty} ☆{chart.level}</DialogDescription>
   <label className="field-label">保存先シリーズ</label><VersionSelect label="手入力の保存先シリーズ" value={version} onChange={key=>requestChange(key)} items={options} disabled={saving}/>
   <p className="manual-play-help">チェックした項目だけを更新します。{previous?'このシリーズの既存記録を更新します。':'このシリーズに新しい記録を作成します。'}</p>
   <label className="manual-field-toggle"><Checkbox checked={scoreEnabled} disabled={saving} onCheckedChange={value=>setScoreEnabled(value===true)}/>EXスコアを更新</label>
   <Input type="number" inputMode="numeric" aria-label="手入力のEXスコア" min={0} max={chart.noteCount?chart.noteCount*2:200000} step={1} placeholder="空欄でスコア記録を消去" value={exText} disabled={!scoreEnabled||saving} onChange={e=>setExText(e.target.value)}/>
   <p className="manual-play-help">{chart.noteCount?`満点 ${chart.noteCount*2} · DJ LEVEL ${rank??'—'}（EXから自動計算）`:'ノーツ数が未取得のためDJ LEVELとスコア率は算出できません。'}</p>
   <label className="manual-field-toggle"><Checkbox checked={lampEnabled} disabled={saving} onCheckedChange={value=>setLampEnabled(value===true)}/>クリア状況を更新</label>
   <Select value={lamp} onValueChange={value=>setLamp(value as ClearLamp)} disabled={!lampEnabled||saving}><SelectTrigger className="choice" aria-label="手入力のクリア状況"><SelectValue/></SelectTrigger><SelectContent position="popper">{lamps.map(value=><SelectItem key={value} value={value}>{lampLabels[value]}</SelectItem>)}</SelectContent></Select>
   <p className="manual-play-help">手入力の項目には目印が付きます。同じシリーズを公式データから再取り込みすると、その譜面の手入力分も上書きされます。</p>
   {error&&<p className="transfer-error" role="alert">{error}</p>}
   <button className="save-button" disabled={disabled||saving||!pending} onClick={()=>void save()}>{saving?<Loader2 className="spin" size={16}/>:<Pencil size={16}/>}手入力を保存</button>
  </DialogContent></Dialog>
  <AlertDialog open={discardTarget!==undefined} onOpenChange={value=>{if(!value)setDiscardTarget(undefined);}}><AlertDialogContent className="save-confirm"><AlertDialogTitle>手入力の変更を破棄しますか？</AlertDialogTitle><AlertDialogDescription>まだ保存していないスコア・クリア状況の入力内容を破棄します。</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel>編集を続ける</AlertDialogCancel><AlertDialogAction onClick={()=>{if(discardTarget===null)setOpen(false);else if(discardTarget!==undefined)reset(discardTarget);setDiscardTarget(undefined);}}>破棄する</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </>;
}
