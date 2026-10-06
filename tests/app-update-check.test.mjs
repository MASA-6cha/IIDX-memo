import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSource} from './load-source.mjs';
const {createAppUpdateChecker}=await loadSource('../lib/app-update-check.ts');

test('startup, resume and timer events share a cooldown',async()=>{
 let clock=0,calls=0;
 const reg={active:{},installing:null,waiting:null,update:async()=>{calls++;}};
 const check=createAppUpdateChecker({getRegistration:()=>reg,canCheck:()=>true,now:()=>clock});
 await check();await check();assert.equal(calls,1);
 clock=59999;await check();assert.equal(calls,1);
 clock=60000;await check();assert.equal(calls,2);
});
test('hidden or offline activity does not consume the next visible check',async()=>{
 let allowed=false,calls=0;
 const reg={active:{},installing:null,waiting:null,update:async()=>{calls++;}};
 const check=createAppUpdateChecker({getRegistration:()=>reg,canCheck:()=>allowed,now:()=>0});
 await check();assert.equal(calls,0);
 allowed=true;await check();assert.equal(calls,1);
});
test('an installing, waiting or unregistered app is not downloaded again',async()=>{
 for(const reg of [null,{active:null},{active:{},installing:{}},{active:{},waiting:{}}]){
  const check=createAppUpdateChecker({getRegistration:()=>reg&&({...reg,update:()=>assert.fail('unexpected download')}),canCheck:()=>true});
  await check();
 }
});
test('simultaneous resume events cannot overlap network checks',async()=>{
 let clock=0,calls=0,finish;
 const reg={active:{},installing:null,waiting:null,update:()=>{calls++;return new Promise(resolve=>{finish=resolve;});}};
 const check=createAppUpdateChecker({getRegistration:()=>reg,canCheck:()=>true,now:()=>clock});
 const pending=check();clock=60000;await check();assert.equal(calls,1);
 finish();await pending;
 const next=check();assert.equal(calls,2);finish();await next;
});
test('failed downloads are contained and can retry after the cooldown',async()=>{
 let clock=0,calls=0;
 const reg={active:{},installing:null,waiting:null,update:async()=>{calls++;throw new Error('offline');}};
 const check=createAppUpdateChecker({getRegistration:()=>reg,canCheck:()=>true,now:()=>clock});
 await check();await check();assert.equal(calls,1);
 clock=60000;await check();assert.equal(calls,2);
});
