"use client";

import {useId,useMemo,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {Combobox,ComboboxInput,ComboboxContent,ComboboxList,ComboboxItem,ComboboxEmpty} from '@/components/ui/combobox';
import {normalized} from '@/lib/iidx-data';

export function ArtistFilter({value,onChange,artists}:{value:string;onChange:(value:string)=>void;artists:string[]}){
 const id=useId(),inputRef=useRef<HTMLInputElement>(null);
 const [open,setOpen]=useState(false);
 const query=normalized(value);
 const matches=useMemo(()=>artists.filter(artist=>normalized(artist).includes(query)),[query,artists]);
 return <div className="artist-filter">
  <label className="field-label spaced" htmlFor={id}>アーティスト</label>
  <Combobox<string> items={artists} filteredItems={matches.slice(0,50)} value={null} inputValue={value}
   open={open&&!!query} onOpenChange={setOpen} autoComplete="off"
   onInputValueChange={(next,details)=>{
    // Closing suggestions must not discard a freely typed filter.
    if(details.reason==='input-change'){onChange(next);setOpen(true);}
   }}
   onValueChange={artist=>{if(artist!==null){onChange(artist);setOpen(false);}}}>
   <div className="artist-input-line">
    <ComboboxInput ref={inputRef} id={id} aria-label="アーティストで絞り込み" aria-describedby={`${id}-help`}
     placeholder="アーティスト名を入力" showTrigger={false} className="artist-input" spellCheck={false} autoCapitalize="none">
    {value&&<button type="button" className="artist-clear" aria-label="アーティストをクリア"
     onClick={()=>{onChange('');setOpen(false);inputRef.current?.focus();}}><X size={17}/></button>}
    </ComboboxInput>
   </div>
   <ComboboxContent className="artist-suggestions">
    <div className="artist-suggestion-heading">入力を含む候補 <span>{matches.length}件{matches.length>50?'・先頭50件':''}</span></div>
    <ComboboxEmpty className="artist-empty">一致する候補がありません</ComboboxEmpty>
    <ComboboxList aria-label="アーティスト候補">{(artist:string)=><ComboboxItem key={artist} value={artist}>{artist}</ComboboxItem>}</ComboboxList>
   </ComboboxContent>
  </Combobox>
  <p id={`${id}-help`} className="artist-help">入力文字を含む楽曲を表示します。</p>
 </div>;
}
