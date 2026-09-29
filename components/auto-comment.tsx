"use client";
import {useCallback,useLayoutEffect,useRef,type ComponentPropsWithoutRef} from 'react';

export function AutoComment({value,className='',...props}:ComponentPropsWithoutRef<'textarea'>&{value:string}){
 const ref=useRef<HTMLTextAreaElement>(null);
 const resize=useCallback(()=>{
  const el=ref.current;if(!el||!el.clientWidth)return;
  const style=getComputedStyle(el),line=parseFloat(style.lineHeight);
  const extra=parseFloat(style.paddingTop)+parseFloat(style.paddingBottom)+parseFloat(style.borderTopWidth)+parseFloat(style.borderBottomWidth);
  const min=line*2+extra,max=line*6+extra;
  el.style.height='auto';
  const height=Math.max(min,Math.min(max,el.scrollHeight+parseFloat(style.borderTopWidth)+parseFloat(style.borderBottomWidth)));
  el.style.height=`${height}px`;el.style.overflowY=height>=max?'auto':'hidden';
 },[]);
 useLayoutEffect(resize,[resize,value]);
 useLayoutEffect(()=>{
  const el=ref.current;if(!el)return;
  let width=el.clientWidth;
  const observer=new ResizeObserver(()=>{if(el.clientWidth!==width){width=el.clientWidth;resize();}});
  observer.observe(el);return()=>observer.disconnect();
 },[resize]);
 return <textarea {...props} ref={ref} value={value} rows={2} className={`auto-comment ${className}`}/>;
}
