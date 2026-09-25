import assert from 'node:assert/strict';
import test from 'node:test';
import {Script} from 'node:vm';
import {createHash} from 'node:crypto';
import {loadSource} from './load-source.mjs';
const {collectPlayPages}=await loadSource('../lib/play-scraper.ts');
const {parsePlayImport}=await loadSource('../lib/play-data.ts');
const {playBookmarklet}=await loadSource('../lib/play-bookmarklet-code.ts');
const {previousPlayBookmarklet}=await loadSource('../lib/play-bookmarklet-previous.ts');
const row={id:'detail.html?index=123',title:'冥',difficulty:'ANOTHER',level:12,exScore:'3200',pgreat:'1500',great:'200',lamp:'HARD CLEAR',djLevel:'AA'};
const options=()=>({modes:['SP','DP'],levels:[12],version:34,signal:new AbortController().signal,onProgress:()=>{}});
test('Both modes paginate separately and exported results can be imported without guessing mode',async()=>{
 const calls=[];
 const output=await collectPlayPages(options(),async req=>{calls.push([req.mode,req.level,req.offset]);return {charts:req.offset?[]:[row]};},async()=>{});
 assert.deepEqual(calls,[['SP',12,0],['SP',12,50],['DP',12,0],['DP',12,50]]);
 assert.equal(output.count,2);assert.deepEqual(parsePlayImport(output.csv).entries.map(e=>e.mode),['SP','DP']);
});
test('Repeated pages, a network failure after data, cancellation and empty results cannot export partial data',async()=>{
 await assert.rejects(collectPlayPages(options(),async()=>({charts:[row]}),async()=>{}),/繰り返し/);
 await assert.rejects(collectPlayPages(options(),async req=>{if(req.offset)throw new Error('HTTP 503');return {charts:[row]};},async()=>{}),/503/);
 const controller=new AbortController();
 await assert.rejects(collectPlayPages({...options(),signal:controller.signal},async()=>{controller.abort();return {charts:[row]};},async()=>{}),/中止/);
 await assert.rejects(collectPlayPages(options(),async()=>({charts:[]}),async()=>{}),/ありません/);
});
test('The generated self-contained bookmarklet is syntactically valid JavaScript',()=>{
 assert.ok(playBookmarklet.startsWith('javascript:'));
 const script=decodeURIComponent(playBookmarklet.slice(11));assert.doesNotThrow(()=>new Script(script));assert.ok(!script.includes('import('));
});
test('Recovery bookmarklet is exactly the working pre-handoff version, including its license',()=>{
 assert.equal(createHash('sha256').update(previousPlayBookmarklet).digest('hex'),'6d78ae32a59d517e57fd8596f00d3f470d3a92e7af35bf78514439f5b21ebec7');
 assert.doesNotThrow(()=>new Script(decodeURIComponent(previousPlayBookmarklet.slice(11))));
});
test('A confirmed last page finishes without fetching a nonexistent page',async()=>{
 const calls=[];
 const output=await collectPlayPages(options(),async req=>{calls.push([req.mode,req.offset]);if(req.offset)throw new Error('This page must not be requested');return {charts:[row],hasNext:false};},async()=>{});
 assert.equal(output.count,2);assert.deepEqual(calls,[['SP',0],['DP',0]]);
});
test('Official row indices reused in another level are not duplicate charts',async()=>{
 const output=await collectPlayPages({...options(),modes:['SP'],levels:[1,2]},async req=>({charts:[{...row,id:'music_info.html?index=0',title:`Fixture level ${req.level}`,difficulty:'NORMAL',level:req.level}],hasNext:false}),async()=>{});
 assert.equal(output.count,2);assert.deepEqual(parsePlayImport(output.csv).entries.map(e=>e.level),[1,2]);
});
test('Official row indices restarting on the next page are not duplicates',async()=>{
 const output=await collectPlayPages({...options(),modes:['SP']},async req=>({charts:[{...row,id:'music_info.html?index=0',title:`Fixture page ${req.offset}`}],hasNext:req.offset===0}),async()=>{});
 assert.equal(output.count,2);
});
