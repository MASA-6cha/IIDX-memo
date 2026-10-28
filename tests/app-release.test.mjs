import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {loadSource} from './load-source.mjs';
import {createWorker} from '../scripts/build-offline.mjs';
const {parseAppRelease}=await loadSource('../lib/app-release.ts');
const release=JSON.parse(readFileSync(new URL('../lib/app-release.json',import.meta.url),'utf8'));
test('waiting worker returns its bundled release, independently of active app',()=>{
 let handler;const context={self:{location:{origin:'https://example.com'},addEventListener:(name,callback)=>{if(name==='message')handler=callback;}},Set,URL};
 vm.runInNewContext(createWorker(readFileSync(new URL('../scripts/offline-worker.js',import.meta.url),'utf8'),'new-build',[],release),context);
 let reply;handler({data:{type:'IIDX_RELEASE_INFO'},ports:[{postMessage:value=>reply=JSON.parse(JSON.stringify(value))}]});
 assert.deepEqual(parseAppRelease(reply.release),release);
});
test('unknown and malformed release data is rejected',()=>{
 assert.equal(parseAppRelease(null),null);assert.equal(parseAppRelease({...release,changes:[42]}),null);
});
