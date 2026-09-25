"use client";
import {useRef,useState} from 'react';
import {Pencil,Loader2} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Input} from '@/components/ui/input';
import {radarAxes} from '@/lib/iidx-additional';
import {parseManualChart} from '@/lib/manual-chart';
import type {Chart,ManualChartData} from '@/lib/iidx-data';

export function ManualChartEditor({chart,title,displayBpm,disabled,onSave}:{chart:Chart;title:string;displayBpm:string;disabled:boolean;onSave:(data:ManualChartData)=>Promise<void>}){
 const [open,setOpen]=useState(false),[bpmMin,setBpmMin]=useState(''),[bpmMax,setBpmMax]=useState(''),[notes,setNotes]=useState(''),[radar,setRadar]=useState<string[]>(Array(6).fill('')),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const lock=useRef(false);
 const start=()=>{const data=chart.manualData,[min='',max='']=data?.bpm?.split('-')??[];setBpmMin(min);setBpmMax(max);setNotes(data?.noteCount?.toString()??'');setRadar(radarAxes.map((_,i)=>data?.radarValues?.[i]?.toString()??''));setError('');setOpen(true);};
 const save=async()=>{if(disabled||lock.current)return;setError('');try{const data=parseManualChart(bpmMin,bpmMax,notes,radar);lock.current=true;setSaving(true);await onSave(data);setOpen(false);}catch(e){setError(e instanceof Error?e.message:'保存できませんでした。');}finally{lock.current=false;setSaving(false);}};
 return <><button className="secondary-button manual-play-trigger" disabled={disabled} onClick={start}><Pencil size={15}/>レーダー・ノーツ数・丸めBPMを手入力{chart.manualData&&<span className="manual-badge">手入力あり</span>}</button>
 <Dialog open={open} onOpenChange={value=>{if(!lock.current)setOpen(value);}}><DialogContent className="manual-play-dialog" showCloseButton={!saving}><DialogTitle>譜面データを手入力</DialogTitle><DialogDescription>{title} / {chart.mode} {chart.difficulty}</DialogDescription>
 <p className="manual-play-help">DBにない項目だけを手入力で補います。通常DB・解析JSON・目視確認JSONに値があれば、その値を優先します（0も有効な値です）。手入力の保存内容は保持され、バックアップにも含まれます。</p>
 <label className="field-label">総ノーツ数<Input aria-label="手入力の総ノーツ数" type="number" inputMode="numeric" min={1} max={100000} step={1} value={notes} placeholder={chart.noteCount?.toString()??'未取得'} disabled={saving} onChange={e=>setNotes(e.target.value)}/></label>
 <fieldset><legend className="field-label">丸めBPM（表示用）</legend><div className="manual-chart-bpm"><Input aria-label="丸めBPM 下限" type="number" inputMode="numeric" min={1} step={1} value={bpmMin} placeholder="下限" disabled={saving} onChange={e=>setBpmMin(e.target.value)}/><span>〜</span><Input aria-label="丸めBPM 上限" type="number" inputMode="numeric" min={1} step={1} value={bpmMax} placeholder="上限（任意）" disabled={saving} onChange={e=>setBpmMax(e.target.value)}/></div><p className="manual-play-help">一定BPMは下限のみ入力。現在の表示：{displayBpm}</p></fieldset>
 <fieldset><legend className="field-label">ノーツレーダー（0〜200）</legend><div className="manual-chart-radar">{radarAxes.map((axis,i)=><label key={axis.key} className="field-label">{axis.label}<Input aria-label={`手入力レーダー ${axis.label}`} type="number" inputMode="decimal" min={0} max={200} step="0.01" value={radar[i]} placeholder={chart.radar?.values[i]?.toString()??'未取得'} disabled={saving} onChange={e=>setRadar(values=>values.map((v,index)=>index===i?e.target.value:v))}/></label>)}</div></fieldset>
 {error&&<p className="transfer-error" role="alert">{error}</p>}<div className="manual-chart-actions"><button className="secondary-button" disabled={saving} onClick={()=>setOpen(false)}>キャンセル</button><button className="save-button" disabled={disabled||saving} onClick={()=>void save()}>{saving?<Loader2 size={16} className="spin"/>:<Pencil size={16}/>}保存</button></div>
 </DialogContent></Dialog></>;
}
