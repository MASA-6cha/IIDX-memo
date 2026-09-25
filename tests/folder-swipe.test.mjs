import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {loadSource} from './load-source.mjs';
const {startFolderSwipe,moveFolderSwipe,finishFolderSwipe}=await loadSource('../lib/folder-swipe.ts');
const {useFolderSwipe}=await loadSource('../lib/use-folder-swipe.ts');
const start={x:30,y:200,time:0};

test('Right swipe requires enough distance and horizontal intent; holding a ready swipe still navigates',()=>{
 for(const [x,y,time,expected] of [[160,210,350,true],[50,200,350,false],[30,200,100,false],[-80,200,350,false],[130,280,350,false],[160,200,1400,true]]){
  assert.equal(finishFolderSwipe(startFolderSwipe(start),{x,y,time}),expected);
 }
 const vertical=startFolderSwipe(start);moveFolderSwipe(vertical,{x:34,y:230,time:100});
 assert.equal(finishFolderSwipe(vertical,{x:160,y:210,time:350}),false);
 const reversed=startFolderSwipe(start);moveFolderSwipe(reversed,{x:15,y:200,time:100});
 assert.equal(finishFolderSwipe(reversed,{x:160,y:200,time:350}),false);
});

function fixture(enabled=true){
 let handlers,backs=0,captures=0,clicksBlocked=0;
 function Probe(){handlers=useFolderSwipe({enabled,folderKey:'12.1',onBack:()=>backs++});return null;}
 renderToString(React.createElement(Probe));
 const target={closest:()=>null};
 const css={};const panel={dataset:{},style:{setProperty:(key,value)=>{css[key]=value;}},contains:()=>true,hasPointerCapture:()=>captures>0,setPointerCapture:()=>captures++};
 const event=extra=>({pointerType:'touch',isPrimary:true,pointerId:1,clientX:30,clientY:200,timeStamp:0,target,currentTarget:panel,preventDefault(){},...extra});
 return {handlers,event,target,panel,css,backs:()=>backs,captures:()=>captures,
  click:()=>{handlers.onClickCapture({detail:1,preventDefault:()=>clicksBlocked++,stopPropagation(){}});return clicksBlocked;}};
}

test('A swipe navigates once and suppresses the following song click; child capture transfer is safe',()=>{
 const f=fixture();f.handlers.onPointerDown(f.event());
 f.handlers.onPointerMove(f.event({clientX:130,timeStamp:200}));
 assert.equal(f.captures(),1);
 assert.equal(f.css['--folder-swipe-x'],'100px');assert.equal(f.panel.dataset.swipeReady,'true');
 // Touch buttons have implicit capture, which is released when the panel takes over.
 f.handlers.onLostPointerCapture(f.event());
 f.handlers.onPointerUp(f.event({clientX:160,timeStamp:350}));
 f.handlers.onPointerUp(f.event({clientX:160,timeStamp:360}));
 assert.equal(f.backs(),1);assert.equal(f.click(),1);
 assert.equal(f.css['--folder-swipe-x'],'0px');assert.equal(f.panel.dataset.swipe,'returning');
});

test('Taps, vertical scroll, cancel, multitouch, inputs, mouse and root folders do not navigate',()=>{
 const cases=['tap','vertical','cancel','capture-lost','multitouch','input','mouse','disabled'];
 for(const kind of cases){
  const f=fixture(kind!=='disabled');
  f.handlers.onPointerDown(f.event({pointerType:kind==='mouse'?'mouse':'touch',...(kind==='input'?{target:{closest:()=>({})}}:{})}));
  if(kind==='vertical')f.handlers.onPointerMove(f.event({clientX:34,clientY:240,timeStamp:80}));
  if(kind==='cancel')f.handlers.onPointerCancel();
  if(kind==='capture-lost')f.handlers.onLostPointerCapture(f.event({target:f.panel}));
  if(kind==='multitouch')f.handlers.onPointerDown(f.event({pointerId:2,isPrimary:false}));
  f.handlers.onPointerUp(f.event({clientX:kind==='tap'?33:160,timeStamp:350}));
  assert.equal(f.backs(),0,kind);
  if(kind==='tap')assert.equal(f.click(),0);
 }
});
