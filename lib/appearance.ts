import {z} from 'zod';
import type {CSSProperties} from 'react';

export type Theme='dark'|'light';
const hexColor=z.string().regex(/^#[0-9a-f]{6}$/i);
const seriesKey=z.string().regex(/^-?\d+(?:\.\d+)?$/);
const colors=z.record(seriesKey,hexColor);
export const seriesColorsSchema=z.object({dark:colors.default({}),light:colors.default({})});
export type SeriesColors=z.infer<typeof seriesColorsSchema>;
export const initialSeriesColors=():SeriesColors=>({dark:{},light:{}});
const gradients=z.record(seriesKey,z.object({enabled:z.boolean(),bottomColor:hexColor,centerOffset:z.number().int().min(-50).max(50)}));
export const seriesGradientsSchema=z.object({dark:gradients.default({}),light:gradients.default({})});
export type SeriesGradients=z.infer<typeof seriesGradientsSchema>;
export const initialSeriesGradients=():SeriesGradients=>({dark:{},light:{}});
export function seriesTitleGradient(series:number,theme:Theme,values:SeriesGradients){
 return values[theme][String(series)]??{enabled:false,bottomColor:theme==='dark'?'#ffffff':'#18324f',centerOffset:0};
}
export function seriesTitleGradientStyle(series:number,theme:Theme,colors:SeriesColors,values:SeriesGradients,enabled:boolean):CSSProperties|undefined{
 const gradient=seriesTitleGradient(series,theme,values);
 if(!enabled||!gradient.enabled)return undefined;
 const top=seriesTitleColor(series,theme,colors),bottom=gradient.bottomColor,center=Math.max(0,Math.min(100,50+gradient.centerOffset));
 // A color hint moves the 50/50 mix while keeping the two endpoint colors.
 const stops=center===0?`${bottom}, ${bottom}`:center===100?`${top}, ${top}`:`${top} 0%, ${center}%, ${bottom} 100%`;
 // Repeat at the current line height so every wrapped line has the same colors.
 return {backgroundImage:`linear-gradient(180deg, ${stops})`,backgroundSize:'100% 1lh',backgroundRepeat:'repeat-y',backgroundPosition:'left top',backgroundClip:'text',WebkitBackgroundClip:'text',color:'transparent',textShadow:'none'};
}
const outlines=z.record(seriesKey,z.object({enabled:z.boolean(),color:hexColor}));
export const seriesOutlinesSchema=z.object({dark:outlines.default({}),light:outlines.default({})});
export type SeriesOutlines=z.infer<typeof seriesOutlinesSchema>;
export const initialSeriesOutlines=():SeriesOutlines=>({dark:{},light:{}});
export const defaultOutlineColor=(theme:Theme)=>theme==='dark'?'#000000':'#ffffff';
export function seriesTitleOutline(series:number,theme:Theme,outlines:SeriesOutlines){
 return outlines[theme][String(series)]??{enabled:false,color:defaultOutlineColor(theme)};
}

// Readable starting colors; users can customize each series in either theme.
const palette:Record<Theme,string[]>={
 dark:['#91c9ff','#e9bdff','#ffaaaa','#9ce1c2','#ffd68a','#a6b8ff','#ffb1dc','#8ddddf'],
 light:['#245c99','#79519b','#ac3543','#216849','#805600','#485ca2','#99376d','#196c72'],
};
export function defaultSeriesColor(series:number,theme:Theme){
 const index=Number.isFinite(series)?Math.abs(Math.round(series*2)):0;
 // Multiplication keeps substream separate without repeating every four series.
 return palette[theme][(Number.isInteger(series)?Math.abs(series):index+1)%palette[theme].length];
}
export function seriesTitleColor(series:number,theme:Theme,colors:SeriesColors){
 return colors[theme][String(series)]??defaultSeriesColor(series,theme);
}
export function seriesTitleStyle(series:number,theme:Theme,colors:SeriesColors,enabled:boolean,outlines?:SeriesOutlines):CSSProperties|undefined{
 if(!enabled)return undefined;
 const outline=outlines?seriesTitleOutline(series,theme,outlines):undefined;
 const style:CSSProperties={color:seriesTitleColor(series,theme,colors)};
 // A thin, blur-free outline outside the glyph preserves its fill and layout.
 if(outline?.enabled)style.textShadow=['-1px 0','1px 0','0 -1px','0 1px','-.7px -.7px','.7px -.7px','-.7px .7px','.7px .7px'].map(offset=>`${offset} 0 ${outline.color}`).join(', ');
 return style;
}

export function copySeriesAppearance(series:number,from:Theme,to:Theme,colors:SeriesColors,outlines:SeriesOutlines,gradients?:SeriesGradients){
 const key=String(series);
 return {
  seriesColors:{...colors,[to]:{...colors[to],[key]:seriesTitleColor(series,from,colors)}},
  seriesOutlines:{...outlines,[to]:{...outlines[to],[key]:{...seriesTitleOutline(series,from,outlines)}}},
  ...(gradients?{seriesGradients:{...gradients,[to]:{...gradients[to],[key]:{...seriesTitleGradient(series,from,gradients)}}}}:{}),
 };
}
