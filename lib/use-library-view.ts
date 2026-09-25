"use client";

import {useCallback,useEffect,useRef,useState,type SetStateAction} from 'react';
import {initialLibraryView,libraryViewKey,parseLibraryView,serializeLibraryView,type LibraryView} from './iidx-view';

export function useLibraryView(){
 const [view,setView]=useState(initialLibraryView),viewRef=useRef(view);
 const [ready,setReady]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  try{const saved=parseLibraryView(localStorage.getItem(libraryViewKey));viewRef.current=saved;setView(saved);}
  catch{setError('前回のフィルター状態を読み込めませんでした。');}
  setReady(true);
 },[]);
 const updateView=useCallback((update:SetStateAction<LibraryView>)=>{
  const next=typeof update==='function'?update(viewRef.current):update;
  viewRef.current=next;
  // Save at the interaction itself, so closing or backgrounding the app has no pending debounce.
  try{localStorage.setItem(libraryViewKey,serializeLibraryView(next));setError('');}
  catch{setError('フィルター状態を端末に保存できませんでした。次回起動時に戻る場合があります。');}
  setView(next);
 },[]);
 return {view,updateView,ready,error};
}
