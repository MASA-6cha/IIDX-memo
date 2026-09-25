import {commonDisplay, hasLegacyDisplayConflict, type Mode, type Note, type Side, type SideSettings} from '@/lib/iidx-data';

const styleNames:Record<string,string>={NORMAL:'正規',MIRROR:'MIR',RANDOM:'RAN','R-RANDOM':'R-RAN','S-RANDOM':'S-RAN'};
const coverNames:Record<string,string>={OFF:'表示OFF','SUDDEN+':'SUD+','HIDDEN+':'HID+','SUDDEN+ & HIDDEN+':'SUD+ / HID+',LIFT:'LIFT','LIFT & SUDDEN+':'LIFT / SUD+'};

function placement(side:SideSettings){
 return `${styleNames[side.style]??side.style}${side.autoScratch?' +AS':''}${side.legacyNote?' +LEG':''}`;
}

export function OptionSummary({note,mode,side,showLift=true}:{showLift?:boolean;note?:Note;mode:Mode;side:Side}){
 if(!note)return <span className="option-empty">未設定</span>;
 const settings=side==='1P'?note.left:note.right;
 const display=mode==='DP'?commonDisplay(note):settings;
 const conflict=mode==='DP'&&hasLegacyDisplayConflict(note);
 return <span className="option-summary" aria-label="保存済みオプション">
  {mode==='DP'?<><span className="option-placement" title={`1P: ${note.left.style}`}>1P {placement(note.left)}</span><span className="option-placement" title={`2P: ${note.right.style}`}>2P {placement(note.right)}</span>{note.flip&&<span>FLIP</span>}{note.link!=='OFF'&&<span title={note.link}>{note.link==='SYNCHRONIZE'?'SYNC':'SYMM'}</span>}</>:<span className="option-placement" title={`${side}: ${settings.style}`}>{placement(settings)}</span>}
  {conflict?<span className="option-conflict">表示設定を確認</span>:<>
   <span className="option-cover" title={display.cover}>{coverNames[display.cover]??display.cover}</span>
   {display.whiteTop!==''||(showLift&&display.whiteBottom!=='')?<span className="option-white" aria-label={`白数字 SUD+ ${display.whiteTop||'未設定'}${showLift?` LIFT ${display.whiteBottom||'未設定'}`:''}`}>{display.whiteTop!==''&&`SUD+ ${display.whiteTop}`}{showLift&&display.whiteBottom!==''&&` LIFT ${display.whiteBottom}`}</span>:null}
   {display.green!==''&&<span className="option-green">緑{display.green}</span>}
  </>}
 </span>;
}
