"use client";
import {useEffect,useState,type ReactNode} from 'react';
import {Accordion,AccordionItem,AccordionTrigger,AccordionContent} from '@/components/ui/accordion';

export function SettingsSection({title,children,reveal=false}:{title:string;children:ReactNode;reveal?:boolean}){
 const [open,setOpen]=useState(reveal);
 useEffect(()=>{if(reveal)setOpen(true);},[reveal]);
 return <Accordion type="single" collapsible value={open?'settings':''} onValueChange={value=>setOpen(!!value)} className="settings-group"><AccordionItem value="settings"><AccordionTrigger>{title}</AccordionTrigger><AccordionContent forceMount className="settings-group-content">{children}</AccordionContent></AccordionItem></Accordion>;
}
