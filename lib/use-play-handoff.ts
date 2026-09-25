"use client";
import {useEffect,useState} from 'react';
import {parsePlayImport} from './play-data';
import {receivePlayHandoff,type PlayHandoffInput,type PlayHandoffPhase} from './play-handoff';

export function usePlayHandoff(){
 const [phase,setPhase]=useState<PlayHandoffPhase>('idle');
 const [incoming,setIncoming]=useState<PlayHandoffInput|null>(null);
 useEffect(()=>receivePlayHandoff(window,input=>{
  // Acknowledgement means a valid result is ready for review, never that it was saved.
  parsePlayImport(input.text);
  setIncoming(input);
 },setPhase),[]);
 return {phase,incoming,clear:()=>{setIncoming(null);setPhase('idle');}};
}
