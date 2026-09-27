// Official exports name the song's debut series; only the final row identifies
// the export series. Keep that inference visible/editable in the import preview.
const series=['1st&substream','2nd style','3rd style','4th style','5th style','6th style','7th style','8th style','9th style','10th style','IIDX RED','HAPPY SKY','DistorteD','GOLD','DJ TROOPERS','EMPRESS','SIRIUS','Resort Anthem','Lincle','tricoro','SPADA','PENDUAL','copula','SINOBUZ','CANNON BALLERS','Rootage','HEROIC VERSE','BISTROVER','CastHour','RESIDENT','EPOLIS','Pinky Crush','Sparkle Shower','ZINRAI'];
const key=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/\s+/g,'');
export function officialSeriesNumber(name:string):number|null{const index=series.findIndex(s=>key(s)===key(name));return index<0?null:index+1;}
export function officialLastPlayed(value:string):string|null{
 if(['','-','--','---','—'].includes(value.trim()))return null;
 const match=/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
 if(!match)throw new Error('最終プレー日時を読み取れません。');
 const [,y,m,d,h,min,s='00']=match,iso=`${y}-${m}-${d}T${h}:${min}:${s}+09:00`,stamp=Date.parse(iso);
 if(!Number.isFinite(stamp)||new Date(stamp+9*3600000).toISOString().slice(0,19)!==`${y}-${m}-${d}T${h}:${min}:${s}`)throw new Error('最終プレー日時が不正です。');
 return new Date(stamp).toISOString();
}
export function decodePlayCsv(bytes:ArrayBuffer):string{
 if(bytes.byteLength>8_000_000)throw new Error('CSVファイルは8MB以内にしてください。');
 try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return new TextDecoder('shift_jis',{fatal:true}).decode(bytes);}
}
export const officialCsvMode=(name:string):'SP'|'DP'|undefined=>/_sp_score\.csv$/i.test(name)?'SP':/_dp_score\.csv$/i.test(name)?'DP':undefined;
