'use client';
import {useEffect,useRef,type HTMLAttributes} from 'react';
import {startFolderSwipe,moveFolderSwipe,finishFolderSwipe,type FolderSwipe} from './folder-swipe';

export function useFolderSwipe({enabled,folderKey,onBack}:{enabled:boolean;folderKey:string|null;onBack:()=>void}):HTMLAttributes<HTMLDivElement>{
 const gesture=useRef<{id:number;key:string|null;swipe:FolderSwipe}|null>(null);
 const suppressClickUntil=useRef(0);
 const panel=useRef<HTMLDivElement|null>(null);
 const resetVisual=()=>{
  if(!panel.current)return;
  panel.current.dataset.swipe='returning';delete panel.current.dataset.swipeReady;
  panel.current.style.setProperty('--folder-swipe-x','0px');
  panel.current.style.setProperty('--folder-swipe-progress','0');
 };
 useEffect(()=>{gesture.current=null;resetVisual();},[enabled,folderKey]);
 return {
  style:enabled?{touchAction:'pan-y pinch-zoom'}:undefined,
  onPointerDown:event=>{
   if(event.pointerType!=='touch')return;
   resetVisual();
   gesture.current=null;
   if(!event.isPrimary){gesture.current=null;return;}
   const target=event.target as Element;
   if(!enabled||!event.currentTarget.contains(target)||target.closest('input,textarea,select,a,[contenteditable],[role="slider"],[role="switch"],[role="checkbox"],[role="combobox"],[data-no-folder-swipe]'))return;
   panel.current=event.currentTarget;
   gesture.current={id:event.pointerId,key:folderKey,swipe:startFolderSwipe({x:event.clientX,y:event.clientY,time:event.timeStamp})};
  },
  onPointerMove:event=>{
   const current=gesture.current;if(!current||current.id!==event.pointerId)return;
   if(!enabled||current.key!==folderKey){gesture.current=null;resetVisual();return;}
   if(moveFolderSwipe(current.swipe,{x:event.clientX,y:event.clientY,time:event.timeStamp})==='right'){
    // Capture only after a horizontal drag: ordinary taps still reach song buttons.
    if(!event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.setPointerCapture(event.pointerId);
    suppressClickUntil.current=Date.now()+600;
    const distance=Math.max(0,event.clientX-current.swipe.start.x);
    const element=event.currentTarget;element.dataset.swipe='dragging';
    element.dataset.swipeReady=finishFolderSwipe(current.swipe,{x:event.clientX,y:event.clientY,time:event.timeStamp})?'true':'false';
    element.style.setProperty('--folder-swipe-x',`${Math.min(distance,120)}px`);
    element.style.setProperty('--folder-swipe-progress',String(Math.min(distance/72,1)));
   }else resetVisual();
  },
  onPointerUp:event=>{
   const current=gesture.current;if(!current||current.id!==event.pointerId)return;
   gesture.current=null;
   resetVisual();
   if(enabled&&current.key===folderKey&&finishFolderSwipe(current.swipe,{x:event.clientX,y:event.clientY,time:event.timeStamp})){
    suppressClickUntil.current=Date.now()+600;
    event.preventDefault();onBack();
   }
  },
  onPointerCancel:()=>{gesture.current=null;resetVisual();},
  onLostPointerCapture:event=>{if(event.target===event.currentTarget){gesture.current=null;resetVisual();}},
  onClickCapture:event=>{
   if(event.detail!==0&&Date.now()<suppressClickUntil.current){event.preventDefault();event.stopPropagation();}
  },
 };
}
