import {z} from 'zod';
import {type OfficialFolderGrouping} from './difficulty-folders';
import {type FolderSummaryMode} from './folder-summary';
import {initialSeriesColors,seriesColorsSchema,initialSeriesOutlines,seriesOutlinesSchema,type SeriesColors,type SeriesOutlines,type Theme} from './appearance';
import {emptyRadarRanges,type ClearGauge,type DifficultyTable,type RadarRange} from './iidx-additional';
import {type ScoreSource} from './play-history';
import {type CpiGauge,type Chart} from './iidx-data';
import {initialPlayDisplay,playDisplaySchema,type PlayDisplay} from './play-display';

export const chartFeatureKeys=['CN','HCN','BSS','MSS'] as const;
export type ChartFeature=typeof chartFeatureKeys[number];
export const matchesChartFeatures=(chart:Chart,features:ChartFeature[])=>features.every(key=>chart.importedInfo?.features?.[key]===true);
export type Filters={series:string;artist:string;levels:number[];availability:'all'|'available'|'removed';soflan:boolean;features:ChartFeature[]};
export type LibraryView={theme:Theme;seriesTitleColors:boolean;seriesColors:SeriesColors;seriesOutlines:SeriesOutlines;query:string;filters:Filters;difficulty:string;folder:string;savedOnly:boolean;sort:string;sortDirection:'asc'|'desc';table:DifficultyTable;gauge:ClearGauge;cpiGauge:CpiGauge;officialFolderGrouping:OfficialFolderGrouping;difficultyFolderMode:boolean;difficultyFolder:string|null;folderSummary:FolderSummaryMode;rank:string;radarRanges:RadarRange[];playStatus:string;showPlayData:boolean;playDisplay:PlayDisplay;scoreSource:ScoreSource;showRadar:boolean;showUnofficial:boolean;radarMode:boolean};
export const defaultFilters=():Filters=>({series:'all',artist:'',levels:[],availability:'available',soflan:false,features:[]});
export const toggleDifficultyLevel=(levels:number[],level:number)=>levels.includes(level)?levels.filter(value=>value!==level):[...levels,level].sort((a,b)=>a-b);
export const matchesDifficultyLevels=(level:number,levels:number[])=>levels.length===0||levels.includes(level);
export const libraryViewKey='iidx-option-notes:library-view:v1';
export const initialLibraryView=():LibraryView=>({theme:'dark',seriesTitleColors:true,seriesColors:initialSeriesColors(),seriesOutlines:initialSeriesOutlines(),query:'',filters:defaultFilters(),difficulty:'ANOTHER',folder:'all',savedOnly:false,sort:'catalog',sortDirection:'asc',table:'official',gauge:'hard',cpiGauge:'hard',officialFolderGrouping:'level',difficultyFolderMode:true,difficultyFolder:null,folderSummary:'both',rank:'all',radarRanges:emptyRadarRanges(),playStatus:'all',showPlayData:true,playDisplay:initialPlayDisplay(),scoreSource:'latest',showRadar:true,showUnofficial:true,radarMode:false});

const storedViewSchema=z.object({
 version:z.literal(1),
 view:z.object({
  theme:z.enum(['dark','light']).default('dark'),seriesTitleColors:z.boolean().default(true),seriesColors:seriesColorsSchema.default(initialSeriesColors),seriesOutlines:seriesOutlinesSchema.default(initialSeriesOutlines),
  query:z.string(),
  filters:z.object({
   series:z.string().regex(/^(all|-1|1\.5|[1-9]\d*)$/),artist:z.string(),
   levels:z.array(z.number().int().min(1).max(12)).max(12).optional(),
   level:z.string().regex(/^(all|[1-9]|1[0-2])$/).optional(),
   availability:z.enum(['all','available','removed']).default('available'),soflan:z.boolean(),features:z.array(z.enum(chartFeatureKeys)).max(4).default([]).transform(values=>[...new Set(values)]),
  }).transform(({level,levels,...filters})=>({...filters,levels:[...new Set(levels??(level&&level!=='all'?[Number(level)]:[]))].sort((a,b)=>a-b)})),
  difficulty:z.enum(['all','BEGINNER','NORMAL','HYPER','ANOTHER','LEGGENDARIA']),
  folder:z.enum(['all','fav1','fav2','fav3','fav4','fav5']),savedOnly:z.boolean(),sort:z.enum(['catalog','title','series','level','unofficial','NOTES','PEAK','SCRATCH','SOFLAN','CHARGE','CHORD']),sortDirection:z.enum(['asc','desc']).optional(),
  table:z.enum(['official','sp12','sp11','dp','cpi']).default('official'),gauge:z.enum(['normal','hard']).default('hard'),cpiGauge:z.enum(['easy','normal','hard','exh','fc']).default('hard'),rank:z.string().default('all'),
  officialFolderGrouping:z.enum(['level','series']).default('level'),folderSummary:z.enum(['none','dj','clear','both']).default('both'),difficultyFolderMode:z.boolean().default(true),difficultyFolder:z.string().regex(/^(infinity|excluded|missing|-?\d+(?:\.\d+)?|series:(?:missing|-?\d+(?:\.\d+)?))$/).max(80).nullable().default(null),
  radarRanges:z.array(z.object({min:z.string().max(30),max:z.string().max(30)})).length(6).default(emptyRadarRanges),
  playStatus:z.enum(['all','played','scored','missing','NO PLAY','FAILED','ASSIST CLEAR','EASY CLEAR','CLEAR','HARD CLEAR','EX HARD CLEAR','FULLCOMBO CLEAR']).default('all'),showPlayData:z.boolean().default(true),playDisplay:playDisplaySchema.default(initialPlayDisplay),scoreSource:z.union([z.enum(['latest','best','unknown']),z.string().regex(/^version:[1-9]\d{0,2}$/).transform(v=>v as ScoreSource)]).default('latest'),
  showRadar:z.boolean().default(true),showUnofficial:z.boolean().default(true),radarMode:z.boolean().default(false),
 }),
});

export function parseLibraryView(text:string|null):LibraryView{
 if(!text)return initialLibraryView();
 try{
  const parsed=storedViewSchema.safeParse(JSON.parse(text));
  if(!parsed.success)return initialLibraryView();
  const view=parsed.data.view;
  // Older versions encoded direction in the series and level choices.
  return {...view,sort:view.sort==='series'?'catalog':view.sort,sortDirection:view.sortDirection??(view.sort==='series'||view.sort==='level'?'desc':'asc')};
 }
 catch{return initialLibraryView();}
}

export const serializeLibraryView=(view:LibraryView)=>JSON.stringify({version:1,view});
export const clearLibraryFilters=(view:LibraryView):LibraryView=>({...view,query:'',filters:defaultFilters(),difficulty:'all',folder:'all',savedOnly:false,playStatus:'all',rank:'all',difficultyFolder:null,radarRanges:emptyRadarRanges()});
