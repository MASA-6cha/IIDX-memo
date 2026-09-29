"use client";
import {type ReactNode} from 'react';
import {Accordion,AccordionItem,AccordionTrigger,AccordionContent} from '@/components/ui/accordion';

export function EditorSection({title,open,onOpenChange,disabled,children}:{title:string;open:boolean;onOpenChange:(open:boolean)=>void;disabled:boolean;children:ReactNode}){
 return <Accordion type="single" collapsible value={open?'details':''} onValueChange={value=>onOpenChange(!!value)} className="editor-section">
  <AccordionItem value="details">
   <AccordionTrigger disabled={disabled}>{title}</AccordionTrigger>
   <AccordionContent forceMount>{children}</AccordionContent>
  </AccordionItem>
 </Accordion>;
}
