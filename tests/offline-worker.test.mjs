import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createWorker} from '../scripts/build-offline.mjs';

const template=await readFile(new URL('../scripts/offline-worker.js',import.meta.url),'utf8');
const origin='https://iidx.test';
const assets=['/IIDX-memo/assets/app.js','/IIDX-memo/assets/app.css','/IIDX-memo/manifest.webmanifest'];
const html='<html><link rel="stylesheet" href="/IIDX-memo/assets/app.css"><body><div data-iidx-app="1"></div><script src="/IIDX-memo/assets/app.js"></script></body></html>';
const url=path=>new URL(path,origin).href;

function cacheStorage(){
  const stores=new Map();
  return {
    async open(name){
      if(!stores.has(name))stores.set(name,new Map());
      const store=stores.get(name),key=r=>typeof r==='string'?r:r.url;
      return {async match(r){return store.get(key(r))?.clone();},async put(r,response){store.set(key(r),response.clone());},async delete(r){return store.delete(key(r));}};
    },
    async keys(){return [...stores.keys()];},async delete(name){return stores.delete(name);},
  };
}

function boot({storage=cacheStorage(),build='first',failPath='',shell=html,offline=false,wrongScript=false}={}){
  const events=new Map(),calls=[];
  const controls={offline,skipped:0};
  const context={Request,Response,URL,AbortController,setTimeout,clearTimeout,caches:storage,
    self:{location:{origin},clients:{claim:async()=>{}},skipWaiting:async()=>{controls.skipped++;},addEventListener:(name,fn)=>events.set(name,fn)},
    fetch:async request=>{
      const path=new URL(typeof request==='string'?request:request.url).pathname;calls.push(path);
      if(controls.offline||path===failPath)throw new TypeError('Network unavailable');
      if(path==='/IIDX-memo/')return new Response(shell,{headers:{'Content-Type':'text/html'}});
      if(path.endsWith('.js'))return new Response(wrongScript?'<html>sign in</html>':'export {}',{headers:{'Content-Type':wrongScript?'text/html':'application/javascript'}});
      if(path.endsWith('.css'))return new Response('body{}',{headers:{'Content-Type':'text/css'}});
      return new Response('{}',{headers:{'Content-Type':'application/json'}});
    }};
  vm.runInNewContext(createWorker(template,build,assets),context);
  return {storage,calls,controls,
    async lifecycle(type){let pending;events.get(type)({waitUntil:p=>{pending=p;}});await pending;},
    async request(path,{mode='navigate',method='GET',foreign=false}={}){let pending;events.get('fetch')({request:{url:foreign?path:url(path),mode,method},respondWith:p=>{pending=p;}});return pending?await pending:null;},
    async message(type){let pending,result;events.get('message')({data:{type},ports:[{postMessage:v=>{result=v;}}],waitUntil:p=>{pending=p;}});await pending;return result;},
  };
}

test('installed app cold-starts from persisted shell and all assets without any network',async()=>{
  const initial=boot();await initial.lifecycle('install');await initial.lifecycle('activate');
  assert.equal((await initial.message('IIDX_OFFLINE_STATUS')).ready,true);
  // A fresh worker shares only persisted caches with the first instance.
  const restarted=boot({storage:initial.storage,offline:true});
  assert.match(await (await restarted.request('/IIDX-memo/?source=homescreen')).text(),/data-iidx-app/);
  for(const path of assets)assert.equal((await restarted.request(path,{mode:'cors'})).status,200);
  assert.deepEqual(restarted.calls,[]);
  assert.equal((await restarted.message('IIDX_OFFLINE_STATUS')).ready,true);
});

test('failed update leaves the previous complete offline application available',async()=>{
  const old=boot();await old.lifecycle('install');
  const next=boot({storage:old.storage,build:'next',failPath:assets[1]});
  await assert.rejects(next.lifecycle('install'));
  assert.deepEqual(await old.storage.keys(),['iidx-app-first']);
  old.controls.offline=true;
  assert.equal((await old.request('/IIDX-memo/')).status,200);
  assert.equal((await old.message('IIDX_OFFLINE_STATUS')).ready,true);
});

test('incomplete cache, sign-in pages and mixed release assets never report ready',async()=>{
  for(const options of [{shell:'<html>Sign in</html>'},{shell:html.replace('app.js','different.js')},{wrongScript:true}]){
    const instance=boot(options);await assert.rejects(instance.lifecycle('install'));
    assert.equal((await instance.message('IIDX_OFFLINE_STATUS')).ready,false);
  }
  const instance=boot();await instance.lifecycle('install');
  await (await instance.storage.open('iidx-app-first')).delete(url(assets[0]));
  assert.equal((await instance.message('IIDX_OFFLINE_STATUS')).ready,false);
  assert.equal((await instance.message('IIDX_REPAIR_OFFLINE')).ready,true);
});

test('worker leaves external data, auth, API and mutations to the network; updates need an explicit message',async()=>{
  const instance=boot();await instance.lifecycle('install');
  assert.equal(instance.controls.skipped,0);
  for(const path of ['/signin-with-chatgpt','/api/anything','/IIDX-memo/sw.js'])assert.equal(await instance.request(path),null);
  assert.equal(await instance.request('/IIDX-memo/',{method:'POST'}),null);
  assert.equal(await instance.request('https://chinimuruhi.github.io/IIDX-Data-Table/textage/title.json',{foreign:true,mode:'cors'}),null);
  await instance.message('IIDX_APPLY_UPDATE');assert.equal(instance.controls.skipped,1);
});
