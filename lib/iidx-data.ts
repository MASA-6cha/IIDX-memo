import type {CatalogImport,ImportOrigin} from './catalog-import';
import {type PlayData} from './play-data';
export type Mode='SP'|'DP';
export type Side='1P'|'2P';
export type Difficulty='BEGINNER'|'NORMAL'|'HYPER'|'ANOTHER'|'LEGGENDARIA';
export const difficulties:Difficulty[]=['BEGINNER','NORMAL','HYPER','ANOTHER','LEGGENDARIA'];
export const seriesNames:Record<number,string>={1:'1st style',2:'2nd style',3:'3rd style',4:'4th style',5:'5th style',6:'6th style',7:'7th style',8:'8th style',9:'9th style',10:'10th style',11:'IIDX RED',12:'HAPPY SKY',13:'DistorteD',14:'GOLD',15:'DJ TROOPERS',16:'EMPRESS',17:'SIRIUS',18:'Resort Anthem',19:'Lincle',20:'tricoro',21:'SPADA',22:'PENDUAL',23:'copula',24:'SINOBUZ',25:'CANNON BALLERS',26:'Rootage',27:'HEROIC VERSE'};
export interface ImportedSongInfo{musicId:number;title:string;artist:string;genre?:string|null;importedAt:string}
export type ArcadeAvailability='included'|'not_included'|'unknown';
export interface ImportedChartInfo{level:number|null;bpm?:string;soflan?:boolean;noteCount?:number|null;radarValues?:RadarValues|null;features?:Partial<Record<'CN'|'HCN'|'BSS'|'MSS',boolean|null>>;status?:string|null;statusLabel?:string|null;arcadeAvailability?:{status:ArcadeAvailability;referenceVersion:number};warnings?:string[];importedAt:string}
export interface Song{supplementBase?:Song|null;id:string;series:number;title:string;artist:string;bpm:string;soflan:boolean;removed:boolean;retained?:boolean;availabilityUnknown?:boolean;genre?:string|null;importedInfo?:ImportedSongInfo}
export type RadarValues=[number|null,number|null,number|null,number|null,number|null,number|null];
export interface DifficultyRating{value:number;label:string}
export interface GaugeRatings{normal:DifficultyRating|null;hard:DifficultyRating|null}
export type CpiGauge='easy'|'normal'|'hard'|'exh'|'fc';
export type CpiRatings=Record<CpiGauge,{value:number|null;individual:number|null}>;
export interface ManualChartData{bpm?:string;noteCount?:number;radarValues?:RadarValues;updatedAt:string}
export interface Chart{supplementBase?:Chart|null;manualData?:ManualChartData;manualApplied?:string[];id:string;songId:string;mode:Mode;difficulty:Difficulty;level:number;unofficialRatings:Record<string,string|number>;bpm?:string;soflan?:boolean;noteCount?:number|null;retained?:boolean;radar?:{values:RadarValues;notes:number}|null;importedInfo?:ImportedChartInfo;community?:{sp11?:GaugeRatings;sp12?:GaugeRatings;dp?:DifficultyRating;cpi?:CpiRatings}}
export interface Catalog{supplementData?:{data:CatalogImport;origin:ImportOrigin;importedAt:string};schemaVersion:1;source:'iidx-data-table'|'iidx-info-exporter';fetchedAt:string;sourceUpdatedAt:string|null;seriesNames:Record<number,string>;songs:Song[];charts:Chart[];importedData?:{importedAt:string;label:string;url?:string};additionalData?:{radarCharts:number;sp11Charts:number;sp12Charts:number;dpCharts:number;cpiCharts?:number}}
export const seriesCode=(series:number)=>series===1.5?'sub':series===-2?'?':series<0?'CS':String(series).padStart(2,'0');
// UI fixtures. Levels, chart availability and removal status are explicitly provisional.
const fixtures:[string,number,string,string,string,boolean,boolean,number[],number[]][]=[
 ['mei',12,'冥','Amuro vs Killer','66–200',true,false,[0,5,10,12,0],[0,5,11,12,0]],
 ['himiko',16,'卑弥呼','朱雀 VS 玄武','82–185',true,false,[0,5,12,12,0],[0,5,12,12,0]],
 ['fascination',14,'Fascination MAXX','100-200-400','100–400',true,false,[0,9,11,12,0],[0,9,11,12,0]],
 ['saber',18,'SABER WING','TAG','74–222',true,false,[0,5,10,12,0],[0,7,10,12,0]],
 ['theory',27,'Theory','YUTO','102–146',true,false,[0,5,10,12,0],[0,5,10,12,0]],
 ['era',3,'era (nostalmix)','TaQ','90–180',true,false,[0,5,8,9,0],[0,5,10,11,0]],
 ['shakunetsu',18,'灼熱Beach Side Bunny','DJ Mass MAD Izm*','153',false,false,[0,5,10,12,0],[0,5,10,12,0]],
 ['nageki',13,'嘆きの樹','金獅子','160',false,false,[0,8,11,12,0],[0,7,11,12,0]],
 ['almagest',17,'Almagest','Galdeira','178',false,false,[0,7,11,12,0],[0,7,11,12,0]],
 ['smooooch',16,'smooooch・∀・','kors k','177',false,false,[1,3,8,10,0],[0,3,8,10,0]],
 ['v',6,'V','TAKA','150',false,false,[0,5,10,12,0],[0,6,10,11,0]],
 ['aa',11,'AA','D.J.Amuro','154',false,false,[0,5,10,12,0],[0,6,10,12,0]],
 ['bequiet',11,'Be quiet','Ryu☆','150',false,false,[0,5,10,11,0],[0,5,10,11,0]],
 ['b4u',4,'B4U','NAOKI','155',false,false,[0,3,7,10,0],[0,4,8,10,0]],
 ['absolute',4,'ABSOLUTE','dj TAKA','144',false,false,[0,3,8,10,11],[0,4,8,10,12]],
 ['bluerain',15,'Blue Rain','dj TAKA VS Ryu☆','144',false,false,[0,4,7,10,0],[0,4,7,11,0]],
 ['quasar',9,'quasar','OutPhase','155',false,false,[0,6,9,11,0],[0,6,11,12,0]],
 ['redzone',11,'RED ZONE','Tatsh&NAOKI','165',false,false,[0,5,9,11,0],[0,5,9,11,0]],
 ['elemental',20,'Elemental Creation','dj TAKA meets DJ YOSHITAKA','212',false,false,[0,7,10,12,0],[0,7,11,12,0]],
 ['estella',5,'Estella','Osamu Kubota','114',false,true,[0,4,6,9,0],[0,4,6,9,0]]
];
export const songs:Song[]=fixtures.map(([id,series,title,artist,bpm,soflan,removed])=>({id,series,title,artist,bpm,soflan,removed}));
export const charts:Chart[]=fixtures.flatMap(f=>(['SP','DP'] as Mode[]).flatMap((mode,i)=>(mode==='SP'?f[7]:f[8]).flatMap((level,j)=>level?[{id:`${f[0]}:${mode}:${difficulties[j]}`,songId:f[0],mode,difficulty:difficulties[j],level,unofficialRatings:{}}]:[])));
export const songById=Object.fromEntries(songs.map(s=>[s.id,s])) as Record<string,Song>;
export const styles=['NORMAL','MIRROR','RANDOM','R-RANDOM','S-RANDOM'];
export const covers=['OFF','SUDDEN+','HIDDEN+','SUDDEN+ & HIDDEN+','LIFT','LIFT & SUDDEN+'];
export interface SideSettings{style:string;cover:string;whiteTop:string;whiteBottom:string;green:string;comment:string;autoScratch:boolean;legacyNote:boolean}
export type DisplaySettings=Pick<SideSettings,'cover'|'whiteTop'|'whiteBottom'|'green'>;
export interface Note{left:SideSettings;right:SideSettings;display?:DisplaySettings;flip:boolean;link:string;updatedAt?:string}
export const displayFromSide=(s:SideSettings):DisplaySettings=>({cover:s.cover,whiteTop:s.whiteTop,whiteBottom:s.whiteBottom,green:s.green});
export const commonDisplay=(n:Note):DisplaySettings=>n.display??displayFromSide(n.left);
export const hasLegacyDisplayConflict=(n:Note)=>!n.display&&JSON.stringify(displayFromSide(n.left))!==JSON.stringify(displayFromSide(n.right));
export interface Folder{id:string;name:string;color:string;songIds:string[]}
export type NumberSettings=Pick<DisplaySettings,'green'|'whiteTop'|'whiteBottom'>;
export type NumberProfile='SP:1P'|'SP:2P'|'DP';
export interface AppState{liftVisibility?:{SP:boolean;DP:boolean};commonNumbers?:Partial<Record<NumberProfile,NumberSettings>>;schemaVersion:1;preferences:{mode:Mode;spSide:Side};notes:Record<string,Note>;folders:Folder[];playData?:PlayData;manualCharts?:Record<string,ManualChartData>}
export const blankSide=():SideSettings=>({style:'NORMAL',cover:'SUDDEN+',whiteTop:'',whiteBottom:'',green:'',comment:'',autoScratch:false,legacyNote:false});
export const blankNote=():Note=>({left:blankSide(),right:blankSide(),flip:false,link:'OFF'});
export const initialState=():AppState=>({schemaVersion:1,preferences:{mode:'SP',spSide:'1P'},notes:{},folders:[{id:'fav1',name:'お気に入り',color:'#efd170',songIds:[]},{id:'fav2',name:'練習中',color:'#77ecd3',songIds:[]},{id:'fav3',name:'ソフラン対策',color:'#f59a67',songIds:[]},{id:'fav4',name:'次にプレイ',color:'#aab1ff',songIds:[]},{id:'fav5',name:'保留',color:'#ed9bc9',songIds:[]}]});
export const noteKey=(c:Chart,s:Side)=>c.id+(c.mode==='SP'?`:${s}`:'');
export const normalized=(s:string)=>s.normalize('NFKC').toLowerCase().trim();
