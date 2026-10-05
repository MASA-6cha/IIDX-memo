import assert from 'node:assert/strict';
import test from 'node:test';
import {loadSource} from './load-source.mjs';
const {copyPlayText}=await loadSource('../lib/play-clipboard.ts');
const csv='タイトル,EXスコア\n"曲名,†",3200\n';
function field({clipboard,legacy=()=>false,value=csv}={}){
 const events=[],details={open:false};
 return {events,details,value,ownerDocument:{defaultView:{navigator:{clipboard}},execCommand:command=>{events.push(command);return legacy();}},closest:()=>details,focus:()=>events.push('focus'),select:()=>events.push('select'),setSelectionRange:(start,end)=>events.push([start,end])};
}
test('Copy writes the entire acquired CSV without opening manual selection when supported',async()=>{
 const writes=[],output=field({clipboard:{writeText:async text=>writes.push(text)}});
 assert.equal(await copyPlayText(output),true);
 assert.deepEqual(writes,[csv]);assert.deepEqual(output.events,[]);assert.equal(output.details.open,false);
});
test('Clipboard denial falls back to selecting the visible result and legacy copy',async()=>{
 const output=field({clipboard:{writeText:async()=>{throw new Error('denied');}},legacy:()=>true});
 assert.equal(await copyPlayText(output),true);assert.equal(output.details.open,true);
 assert.deepEqual(output.events,['focus','select',[0,csv.length],'copy']);
});
test('A missing Clipboard API still copies via the synchronous fallback',async()=>{
 const output=field({legacy:()=>true});assert.equal(await copyPlayText(output),true);
 assert.equal(output.details.open,true);assert.equal(output.events.at(-1),'copy');
});
test('Blocked copy leaves the whole result visible and selected for manual copying',async()=>{
 for(const legacy of [()=>false,()=>{throw new Error('blocked');}]){
  const output=field({legacy});assert.equal(await copyPlayText(output),false);
  assert.equal(output.value,csv);assert.equal(output.details.open,true);
  assert.deepEqual(output.events,['focus','select',[0,csv.length],'copy']);
 }
});
test('An empty result does not overwrite an existing clipboard',async()=>{
 const output=field({value:'',clipboard:{writeText:async()=>assert.fail('must not write')}});
 assert.equal(await copyPlayText(output),false);assert.deepEqual(output.events,[]);
});
