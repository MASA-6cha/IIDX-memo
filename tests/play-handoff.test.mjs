import assert from 'node:assert/strict';
import test from 'node:test';
import {webcrypto} from 'node:crypto';
import {loadSource} from './load-source.mjs';
const {sendPlayHandoff,receivePlayHandoff,playHandoffId,playHandoffKind,playHandoffLimit,playAppOrigin,playOfficialOrigin}=await loadSource('../lib/play-handoff.ts');
const {parsePlayImport}=await loadSource('../lib/play-data.ts');
const {formatPlayCharts}=await loadSource('../lib/play-scraper.ts');
const id='1234567890abcdef1234567890abcdef';
const csv=formatPlayCharts([{mode:'SP',title:'冥',difficulty:'ANOTHER',level:12,exScore:'3200',pgreat:'1500',great:'200',lamp:'HARD CLEAR',djLevel:'AA'}],34).csv;
const msg=(action,extra={})=>({kind:playHandoffKind,id,action,...extra});
function mockWindow(hash=''){
 const listeners=new Set(),timers=new Map();let serial=0;
 return {crypto:webcrypto,location:{hash,pathname:'/',search:''},history:{state:null,replaceState(_state,_title,url){this.url=url;}},opener:null,
  addEventListener(type,fn){assert.equal(type,'message');listeners.add(fn);},removeEventListener(_type,fn){listeners.delete(fn);},
  setTimeout(fn){timers.set(++serial,fn);return serial;},clearTimeout(key){timers.delete(key);},setInterval(fn){timers.set(++serial,fn);return serial;},clearInterval(key){timers.delete(key);},
  emit(event){for(const fn of [...listeners])fn(event);},expire(){for(const fn of [...timers.values()])fn();},listeners,timers};
}
function receiver(onInput=()=>{}){
 const win=mockWindow(`#play-import=${id}`),sent=[],phases=[],sender={postMessage:(data,origin)=>sent.push({data,origin})};win.opener=sender;
 const stop=receivePlayHandoff(win,onInput,p=>phases.push(p));
 return {win,sender,sent,phases,stop,event:data=>({data,origin:playOfficialOrigin,source:sender})};
}
test('Transfer URL accepts only a random ID and production destinations remain pinned',()=>{
 assert.equal(playAppOrigin,'https://iidx-option-notes.ddrukmasa.chatgpt.site');assert.equal(playOfficialOrigin,'https://p.eagate.573.jp');
 assert.equal(playHandoffId(`#play-import=${id}`),id);
 for(const hash of ['', '#play-import=bad','#play-import=../../evil','#text='+csv])assert.equal(playHandoffId(hash),null);
});
test('A valid transfer is parsed once, acknowledged, and removed from the URL without saving',()=>{
 const inputs=[];const r=receiver(v=>{parsePlayImport(v.text);inputs.push(v);});
 assert.deepEqual(r.phases,['waiting']);assert.equal(r.sent[0].data.action,'ready');assert.equal(r.sent[0].origin,playOfficialOrigin);
 r.win.emit(r.event(msg('data',{text:csv})));r.win.emit(r.event(msg('data',{text:csv})));
 assert.deepEqual(inputs,[{id,text:csv}]);assert.deepEqual(r.phases,['waiting','received']);assert.equal(r.sent.at(-1).data.action,'received');
 assert.equal(r.win.history.url,'/');assert.equal(r.win.listeners.size,0);assert.equal(r.win.timers.size,0);
});
test('Forged origins, windows, IDs, message kinds, and actions cannot supply a score',()=>{
 const inputs=[];const r=receiver(v=>inputs.push(v));const good=r.event(msg('data',{text:csv}));
 for(const event of [{...good,origin:'https://untrusted.example'},{...good,source:{}},{...good,data:{...good.data,id:'0'.repeat(32)}},{...good,data:{...good.data,kind:'other'}},{...good,data:msg('ready')},{...good,data:null}])r.win.emit(event);
 assert.equal(inputs.length,0);assert.deepEqual(r.phases,['waiting']);r.stop();assert.equal(r.win.timers.size,0);
});
test('Malformed, oversized, and invalid CSV transfers are rejected with no success acknowledgement',()=>{
 for(const text of [null,1,'','a'.repeat(playHandoffLimit+1),'invalid CSV']){
  const r=receiver(v=>parsePlayImport(v.text));r.win.emit(r.event(msg('data',{text})));
  assert.equal(r.phases.at(-1),'invalid');assert.equal(r.sent.at(-1).data.action,'invalid');assert.equal(r.win.timers.size,0);
 }
});
test('Missing opener and timeout lead to copy fallback and release listeners',()=>{
 const win=mockWindow(`#play-import=${id}`),phases=[];
 receivePlayHandoff(win,()=>assert.fail('no input'),p=>phases.push(p));assert.equal(phases.at(-1),'unavailable');assert.equal(win.listeners.size,0);
 const r=receiver(()=>assert.fail('no input'));r.win.expire();assert.equal(r.phases.at(-1),'unavailable');assert.equal(r.win.listeners.size,0);assert.equal(r.win.timers.size,0);
});
test('Sender uses a fresh tab, waits for its verified handshake, and keeps scores out of URLs',()=>{
 const win=mockWindow(),sent=[],phases=[],child={postMessage:(data,origin)=>sent.push({data,origin})};let url;
 win.open=(value,target)=>{url=value;assert.equal(target,'_blank');return child;};
 sendPlayHandoff(win,csv,p=>phases.push(p));const token=playHandoffId(new URL(url).hash);assert.ok(token);assert.equal(new URL(url).search,'');assert.ok(!url.includes('3200'));assert.equal(sent.length,0);
 const ready={kind:playHandoffKind,id:token,action:'ready'};
 win.emit({source:{},origin:playAppOrigin,data:ready});win.emit({source:child,origin:'https://untrusted.example',data:ready});assert.equal(sent.length,0);
 win.emit({source:child,origin:playAppOrigin,data:ready});assert.equal(sent[0].data.text,csv);assert.equal(sent[0].origin,playAppOrigin);
 win.emit({source:child,origin:playAppOrigin,data:{...ready,action:'received'}});assert.deepEqual(phases,['waiting','received']);assert.equal(win.timers.size,0);
});
test('Blocked popup, timeout and cancel never destroy the original result',()=>{
 for(const behavior of ['blocked','throw','timeout','cancel']){
  const win=mockWindow(),phases=[];win.open=()=>{if(behavior==='throw')throw new Error('blocked');return behavior==='blocked'?null:{postMessage(){}};};
  const stop=sendPlayHandoff(win,csv,p=>phases.push(p));if(behavior==='timeout')win.expire();if(behavior==='cancel')stop();
  assert.equal(phases.at(-1),behavior==='cancel'?'waiting':'unavailable');assert.equal(win.timers.size,0);assert.equal(win.listeners.size,0);assert.equal(parsePlayImport(csv).entries.length,1);
 }
});
test('Sender and receiver complete an asynchronous handshake with a full-sized export',async()=>{
 const sender=mockWindow(),target=mockWindow(),phases=[],inputs=[];const fullText=csv+'\r\n'+'sample score row\r\n'.repeat(100000);
 const appRef={postMessage(data,origin){assert.equal(origin,playAppOrigin);queueMicrotask(()=>target.emit({source:officialRef,origin:playOfficialOrigin,data}));}};
 const officialRef={postMessage(data,origin){assert.equal(origin,playOfficialOrigin);queueMicrotask(()=>sender.emit({source:appRef,origin:playAppOrigin,data}));}};
 sender.open=url=>{target.location.hash=new URL(url).hash;target.opener=officialRef;queueMicrotask(()=>receivePlayHandoff(target,v=>inputs.push(v),p=>phases.push('receiver:'+p)));return appRef;};
 sendPlayHandoff(sender,fullText,p=>phases.push('sender:'+p));await new Promise(resolve=>setImmediate(resolve));
 assert.equal(inputs[0].text,fullText);assert.ok(phases.includes('receiver:received'));assert.ok(phases.includes('sender:received'));assert.equal(sender.timers.size+target.timers.size,0);
});
