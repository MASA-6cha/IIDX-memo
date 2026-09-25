// Only the transfer ID goes in the URL. Scores stay in browser-to-browser messages.
export const playAppOrigin='https://iidx-option-notes.ddrukmasa.chatgpt.site';
export const playOfficialOrigin='https://p.eagate.573.jp';
export const playHandoffKind='iidx-memo-play-handoff-v1';
export const playHandoffLimit=8_000_000;
export const playHandoffTimeout=30_000;
export type PlayHandoffPhase='idle'|'waiting'|'received'|'unavailable'|'invalid';
export type PlayHandoffInput={id:string;text:string};
type Envelope={kind:typeof playHandoffKind;id:string;action:'ready'|'data'|'received'|'invalid';text?:string};

export function playHandoffId(hash:string){
 const id=new URLSearchParams(hash.replace(/^#/, '')).get('play-import');
 return id&&/^[a-f0-9]{32}$/.test(id)?id:null;
}
function envelope(data:unknown,id:string):data is Envelope{
 if(!data||typeof data!=='object'||Array.isArray(data))return false;
 const value=data as Partial<Envelope>;
 return value.kind===playHandoffKind&&value.id===id&&['ready','data','received','invalid'].includes(value.action??'');
}
function message(id:string,action:Envelope['action'],text?:string):Envelope{
 return {kind:playHandoffKind,id,action,...(text===undefined?{}:{text})};
}

// Call synchronously from the result button so the new tab has a user gesture.
export function sendPlayHandoff(win:Window,text:string,onPhase:(phase:PlayHandoffPhase)=>void){
 let child:Window|null=null,timer:number|undefined,finished=false;
 const cleanup=()=>{finished=true;win.removeEventListener('message',receive);if(timer!==undefined)win.clearTimeout(timer);};
 const finish=(phase:PlayHandoffPhase)=>{if(finished)return;cleanup();onPhase(phase);};
 const id=Array.from(win.crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
 const receive=(event:MessageEvent)=>{
  if(finished||!child||event.source!==child||event.origin!==playAppOrigin||!envelope(event.data,id))return;
  if(event.data.action==='ready'){
   try{child.postMessage(message(id,'data',text),playAppOrigin);}catch{finish('unavailable');}
  }else if(event.data.action==='received')finish('received');
  else if(event.data.action==='invalid')finish('invalid');
 };
 if(!text||text.length>playHandoffLimit){finish('invalid');return cleanup;}
 win.addEventListener('message',receive);
 onPhase('waiting');
 try{child=win.open(`${playAppOrigin}/#play-import=${id}`,'_blank');}catch{finish('unavailable');return cleanup;}
 if(!child){finish('unavailable');return cleanup;}
 timer=win.setTimeout(()=>finish('unavailable'),playHandoffTimeout);
 return cleanup;
}

export function receivePlayHandoff(win:Window,onInput:(input:PlayHandoffInput)=>void,onPhase:(phase:PlayHandoffPhase)=>void){
 const id=playHandoffId(win.location.hash);
 if(!id)return()=>{};
 const sender=win.opener as Window|null;
 let interval:number|undefined,timer:number|undefined,finished=false;
 const cleanup=()=>{finished=true;win.removeEventListener('message',receive);if(interval!==undefined)win.clearInterval(interval);if(timer!==undefined)win.clearTimeout(timer);};
 const finish=(phase:PlayHandoffPhase)=>{if(finished)return;cleanup();onPhase(phase);};
 const send=(action:Envelope['action'])=>{try{sender?.postMessage(message(id,action),playOfficialOrigin);}catch{finish('unavailable');}};
 const receive=(event:MessageEvent)=>{
  if(finished||!sender||event.source!==sender||event.origin!==playOfficialOrigin||!envelope(event.data,id)||event.data.action!=='data')return;
  const text=event.data.text;
  if(typeof text!=='string'||!text||text.length>playHandoffLimit){send('invalid');finish('invalid');return;}
  try{onInput({id,text});}catch{send('invalid');finish('invalid');return;}
  send('received');
  // Do not leave an expired transfer link in browser history.
  try{win.history.replaceState(win.history.state,'',win.location.pathname+win.location.search);}catch{}
  finish('received');
 };
 onPhase('waiting');
 if(!sender){finish('unavailable');return cleanup;}
 win.addEventListener('message',receive);
 interval=win.setInterval(()=>send('ready'),750);
 timer=win.setTimeout(()=>finish('unavailable'),playHandoffTimeout);
 send('ready');
 return cleanup;
}
