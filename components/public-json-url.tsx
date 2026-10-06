"use client";
import {useCallback,useLayoutEffect,useRef} from 'react';

export function PublicJsonUrl({value,onChange,disabled,placeholder}:{value:string;onChange:(value:string)=>void;disabled:boolean;placeholder:string}){
 const ref=useRef<HTMLTextAreaElement>(null);
 const resize=useCallback(()=>{
  const el=ref.current;if(!el?.clientWidth)return;
  el.style.height='auto';
  const style=getComputedStyle(el);
  el.style.height=`${el.scrollHeight+parseFloat(style.borderTopWidth)+parseFloat(style.borderBottomWidth)}px`;
 },[]);
 useLayoutEffect(resize,[resize,value]);
 useLayoutEffect(()=>{
  const el=ref.current;if(!el)return;let width=el.clientWidth;
  const observer=new ResizeObserver(()=>{if(width!==el.clientWidth){width=el.clientWidth;resize();}});
  observer.observe(el);return()=>observer.disconnect();
 },[resize]);
 return <textarea ref={ref} id="catalog-json-url" className="public-json-url" rows={2} inputMode="url" value={value} onChange={event=>onChange(event.target.value.replace(/[\r\n]/g,''))} onKeyDown={event=>{if(event.key==='Enter')event.preventDefault();}} disabled={disabled} placeholder={placeholder} autoCapitalize="none" autoCorrect="off" spellCheck={false}/>;
}
