"use client";
import {useCallback,useEffect,useMemo,useRef,useState,type CSSProperties,type SetStateAction} from 'react';
import {ArrowDown,ArrowLeftRight,ArrowUp,Check,ChevronRight,Folder,FolderHeart,Info,ListMusic,Loader2,NotebookPen,RotateCcw,Save,Search,Settings2,ShieldCheck,SlidersHorizontal,Smartphone,Star,Activity,X} from 'lucide-react';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {Sheet,SheetContent,SheetTitle,SheetDescription} from '@/components/ui/sheet';
import {Checkbox} from '@/components/ui/checkbox';
import {Switch} from '@/components/ui/switch';
import {Popover,PopoverContent,PopoverTrigger} from '@/components/ui/popover';
import {AlertDialog,AlertDialogContent,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {BrowserInstallNotice} from '@/components/browser-install-notice';
import {Toaster} from '@/components/ui/sonner';
import {toast} from 'sonner';
import {songs as sampleSongs,charts as sampleCharts,songById as sampleSongById,seriesNames as sampleSeriesNames,seriesCode,difficulties,styles,covers,blankNote,initialState,noteKey,normalized,commonDisplay,displayFromSide,hasLegacyDisplayConflict,type AppState,type Catalog,type Chart,type Mode,type Side,type Note,type SideSettings,type DisplaySettings,type NumberSettings,type Difficulty,type CpiGauge} from '@/lib/iidx-data';
import {readLibrary,writeState} from '@/lib/iidx-storage';
import {ArtistFilter} from '@/components/artist-filter';
import {OptionSummary} from '@/components/option-summary';
import {DataTransfer} from '@/components/data-transfer';
import {fetchCatalog,mergeCatalog,migrateLegacyState,canonicalChartId,canonicalSongId} from '@/lib/iidx-catalog';
import {CatalogSettings} from '@/components/catalog-settings';
import {CatalogImportSettings,ImportedChartDetails} from '@/components/catalog-import';
import {mergeCatalogImport,type CatalogImport,type ImportOrigin} from '@/lib/catalog-import';
import {useOfflineApp} from '@/lib/use-offline-app';
import {OfflineSettings,OfflineStatus} from '@/components/offline-settings';
import {useLibraryView} from '@/lib/use-library-view';
import {useFolderSwipe} from '@/lib/use-folder-swipe';
import {clearLibraryFilters,defaultFilters,chartFeatureKeys,matchesChartFeatures,toggleDifficultyLevel,matchesDifficultyLevels,type Filters,type LibraryView} from '@/lib/iidx-view';
import {chartRating,chartRank,ratingSortValue,cpiGauges,compareNullable,inDifficultyTable,matchesRadar,radarAxes,radarRangeError,type DifficultyTable} from '@/lib/iidx-additional';
import {CommunityRating,NotesRadar,RadarFilters,RadarValues} from '@/components/notes-radar';
import {StorageUsage} from '@/components/storage-usage';
import {PlayImportSettings} from '@/components/play-import';
import {usePlayHandoff} from '@/lib/use-play-handoff';
import {PlayScoreSummary,PlayScoreDetails,PlayScoreHistory} from '@/components/play-score';
import {ManualPlayEditor,ScoreSeriesDelete} from '@/components/play-management';
import {applyManualPlay,deletePlaySeries} from '@/lib/play-edit';
import {ChartFeatures} from '@/components/chart-features';
import {ManualChartEditor} from '@/components/manual-chart-editor';
import {applyManualChart} from '@/lib/manual-chart';
import {CommonNumberSettings} from '@/components/common-number-settings';
import {chartCommonNumbers,effectiveNumberNote,applyNumberAction} from '@/lib/common-numbers';
import {SettingsSection} from '@/components/settings-section';
import {MyActivity} from '@/components/my-activity';
import {hasPlaySummary,playDisplayFields} from '@/lib/play-display';
import {chartPlayHistory,resolvePlayRecords,storedPlayVersions,scoreSourceLabel,type ScoreSource} from '@/lib/play-history';
import {collectPlayHistory,applyPlayImport,matchesPlayFilter,lamps,lampLabels} from '@/lib/play-data';
import {AppearanceSettings} from '@/components/appearance-settings';
import {copySeriesAppearance,seriesTitleStyle} from '@/lib/appearance';
import {APP_INFO} from '@/lib/app-info';
import {buildDifficultyFolders,difficultyFolderKey,difficultyFolderPrefix} from '@/lib/difficulty-folders';
import {DifficultyFolderList,DifficultyFolderHeading} from '@/components/difficulty-folders';

type PendingAction={run:()=>void|boolean|Promise<void|boolean>;description:string};
function Choice({label,value,onChange,items,disabled=false}:{label:string;value:string;onChange:(v:string)=>void;items:{value:string;label:string}[];disabled?:boolean}){
 return <Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger aria-label={label} className="choice"><SelectValue/></SelectTrigger><SelectContent position="popper" side="bottom" align="start" collisionPadding={12} className="choice-menu">{items.map(i=><SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent></Select>;
}
const diffBadge=(d:Difficulty)=><span className={`difficulty ${d.toLowerCase()}`}>{d}</span>;
function DisplayFields({value,onChange,label,defaults,showLift=true}:{showLift?:boolean;value:DisplaySettings;onChange:(v:DisplaySettings)=>void;label:string;defaults?:NumberSettings}){
 const field=<K extends keyof DisplaySettings>(k:K,v:DisplaySettings[K])=>onChange({...value,[k]:v});
 return <div className="display-fields">
  <div className="field-label">表示方式</div><Choice label={`${label} 表示オプション`} value={value.cover} onChange={v=>field('cover',v)} items={covers.map(v=>({value:v,label:v}))}/>
  <div className={`number-pair ${showLift?'':'without-lift'}`}>
   <label className="number-field"><span>白数字<span className="field-unit">SUD+</span></span><div className="number-value">{value.whiteTop===''&&defaults?.whiteTop!==undefined&&defaults.whiteTop!==''&&<span className="number-common-tag">共通</span>}<input aria-label={`${label} 白数字 SUD+`} type="number" inputMode="numeric" min="0" max="1000" step="1" placeholder={defaults?.whiteTop||'—'} value={value.whiteTop} onChange={e=>field('whiteTop',e.target.value)}/></div></label>
   {showLift&&<label className="number-field"><span>白数字<span className="field-unit">LIFT</span></span><div className="number-value">{value.whiteBottom===''&&defaults?.whiteBottom!==undefined&&defaults.whiteBottom!==''&&<span className="number-common-tag">共通</span>}<input aria-label={`${label} 白数字 LIFT`} type="number" inputMode="numeric" min="0" max="1000" step="1" placeholder={defaults?.whiteBottom||'—'} value={value.whiteBottom} onChange={e=>field('whiteBottom',e.target.value)}/></div></label>}
  </div>
  <label className="number-field green-field"><span><span className="green-dot"/>緑数字<small>譜面表示時間</small></span><div className="number-value">{value.green===''&&defaults?.green!==undefined&&defaults.green!==''&&<span className="number-common-tag">共通</span>}<input aria-label={`${label} 緑数字`} type="number" inputMode="numeric" min="1" max="9999" step="1" placeholder={defaults?.green||'—'} value={value.green} onChange={e=>field('green',e.target.value)}/></div></label>
 </div>;
}
function SideFields({value,onChange,side,dp,defaults,showLift=true}:{showLift?:boolean;value:SideSettings;onChange:(v:SideSettings)=>void;side:Side;dp:boolean;defaults?:NumberSettings}){
 const field=<K extends keyof SideSettings>(k:K,v:SideSettings[K])=>onChange({...value,[k]:v});
 return <section className={`side-card ${side==='2P'?'second-side':''}`}>
  <div className="side-heading"><span className="side-number">{side}</span><span>{dp?(side==='1P'?'左サイド':'右サイド'):'プレイサイド'}</span><span className="tiny-line"/></div>
  <div className="field-label">譜面配置</div><Choice label={`${side} 譜面配置`} value={value.style} onChange={v=>field('style',v)} items={styles.map(v=>({value:v,label:v==='NORMAL'?'NORMAL（正規）':v}))}/>
  <div className="assists"><label><Checkbox checked={value.autoScratch} onCheckedChange={v=>field('autoScratch',v===true)}/>A-SCRATCH</label><label><Checkbox checked={value.legacyNote} onCheckedChange={v=>field('legacyNote',v===true)}/>LEGACY NOTE</label></div>
  {!dp&&<><div className="sp-display"><DisplayFields showLift={showLift} label={side} defaults={defaults} value={value} onChange={v=>onChange({...value,...v})}/></div>
  <label className="field-label spaced" htmlFor={`${dp?'dp':'sp'}-${side}-comment`}>コメント</label><textarea id={`${dp?'dp':'sp'}-${side}-comment`} aria-label={`${side} コメント`} value={value.comment} onChange={e=>field('comment',e.target.value)} maxLength={2000} placeholder="低速前にシャッターを調整、など" rows={dp?3:4}/>
  </>}
 </section>;
}

export default function Home(){
 const offline=useOfflineApp();
 const handoff=usePlayHandoff();
 const [app,setApp]=useState<AppState>(initialState);const appRef=useRef(app);const queue=useRef<Promise<unknown>>(Promise.resolve());
 const [catalog,setCatalog]=useState<Catalog|null>(null);const catalogRef=useRef<Catalog|null>(null);
 const [catalogUpdating,setCatalogUpdating]=useState(false),[catalogStage,setCatalogStage]=useState('取得中…'),[catalogError,setCatalogError]=useState(''),[catalogNotice,setCatalogNotice]=useState('');
 const [catalogImportReading,setCatalogImportReading]=useState(false);
 const songs=catalog?.songs??sampleSongs,rawCharts=catalog?.charts??sampleCharts,seriesNames=catalog?.seriesNames??sampleSeriesNames;
 const songById=useMemo(()=>Object.fromEntries(songs.map(s=>[s.id,s])),[songs]);
 const charts=useMemo(()=>rawCharts.map(chart=>applyManualChart(chart,app.manualCharts,songById[chart.songId]?.bpm)),[rawCharts,app.manualCharts,songById]);
 const searchBySong=useMemo(()=>Object.fromEntries(songs.map(s=>[s.id,{title:normalized(s.title),artist:normalized(s.artist)}])),[songs]);
 const artists=useMemo(()=>Array.from(new Set(songs.map(s=>s.artist))).sort((a,b)=>a.localeCompare(b,'ja')),[songs]);
 const [ready,setReady]=useState(false);const [storageError,setStorageError]=useState('');const [persistence,setPersistence]=useState('確認中');
 const {view,updateView,ready:viewReady,error:viewError}=useLibraryView();
 const {theme,seriesTitleColors,seriesColors,seriesOutlines,query,filters,difficulty,folder,savedOnly,sort,sortDirection,table:requestedTable,gauge,cpiGauge,difficultyFolderMode,difficultyFolder,folderSummary,officialFolderGrouping,rank,radarRanges,showRadar,showUnofficial,radarMode,playStatus,showPlayData,playDisplay,scoreSource}=view;
 const playHistory=useMemo(()=>collectPlayHistory(app.playData),[app.playData]);
 const playRecords=useMemo(()=>resolvePlayRecords(playHistory,scoreSource),[playHistory,scoreSource]);
 const savedPlayVersions=useMemo(()=>storedPlayVersions(playHistory),[playHistory]);
 const selectedScoreSource=useMemo(()=>scoreSourceLabel(scoreSource,playHistory,seriesNames),[scoreSource,playHistory,seriesNames]);
 const activitySources=useMemo(()=>[
  {value:'latest' as ScoreSource,label:scoreSourceLabel('latest',playHistory,seriesNames)},
  {value:'best' as ScoreSource,label:'歴代最高（EXスコア）'},
  ...savedPlayVersions.versions.map(version=>({value:`version:${version}` as ScoreSource,label:scoreSourceLabel(`version:${version}`,playHistory,seriesNames)})),
  ...((savedPlayVersions.unknown||scoreSource==='unknown')?[{value:'unknown' as ScoreSource,label:'シリーズ不明'}]:[]),
  ...(scoreSource.startsWith('version:')&&!savedPlayVersions.versions.includes(Number(scoreSource.slice(8)))?[{value:scoreSource,label:selectedScoreSource+'（記録なし）'}]:[]),
 ],[playHistory,seriesNames,savedPlayVersions,scoreSource,selectedScoreSource]);
 useEffect(()=>{if(!viewReady)return;document.documentElement.dataset.theme=theme;document.documentElement.classList.toggle('dark',theme==='dark');document.documentElement.style.colorScheme=theme;document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#10141c':'#f4f7fb');},[theme,viewReady]);
 const titleStyle=(series:number)=>seriesTitleStyle(series,theme,seriesColors,seriesTitleColors,seriesOutlines);
 const setViewField=<K extends keyof LibraryView>(field:K,value:SetStateAction<LibraryView[K]>)=>updateView(current=>({...current,[field]:typeof value==='function'?(value as (previous:LibraryView[K])=>LibraryView[K])(current[field]):value}));
 const setQuery=(value:string)=>setViewField('query',value),setFilters=(value:SetStateAction<Filters>)=>setViewField('filters',value),setDifficulty=(value:string)=>setViewField('difficulty',value),setFolder=(value:string)=>setViewField('folder',value),setSavedOnly=(value:boolean)=>setViewField('savedOnly',value),setSort=(value:string)=>setViewField('sort',value);
 const [selectedBase,setSelected]=useState<Chart>(sampleCharts.find(c=>c.id==='mei:SP:ANOTHER')!);const selected=useMemo(()=>charts.find(chart=>chart.id===selectedBase.id)??applyManualChart(selectedBase,app.manualCharts,songById[selectedBase.songId]?.bpm),[charts,selectedBase,app.manualCharts,songById]);const [draft,setDraft]=useState<Note>(blankNote);const [dirty,setDirty]=useState(false);const [saving,setSaving]=useState(false);const [transitioning,setTransitioning]=useState(false);const [saveError,setSaveError]=useState('');const saveLock=useRef(false),transitionLock=useRef(false);
 const [compact,setCompact]=useState(false);const [editorOpen,setEditorOpen]=useState(false);const [filterOpen,setFilterOpen]=useState(false);const [settingsOpen,setSettingsOpen]=useState(false);const [pendingAction,setPendingAction]=useState<PendingAction|null>(null);const [folderNames,setFolderNames]=useState<string[]>([]);const [visibleCount,setVisibleCount]=useState(60);
 const [settingsReveal,setSettingsReveal]=useState('');
 const [activityOpen,setActivityOpen]=useState(false);
 useEffect(()=>{const sync=()=>setActivityOpen(window.location.hash==='#activity');sync();window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync);},[]);
 useEffect(()=>{if(handoff.phase!=='idle')setSettingsOpen(true);},[handoff.phase]);
 const mode=app.preferences.mode,spSide=app.preferences.spSide,showLift=app.liftVisibility?.[app.preferences.mode]??true;
 const table:DifficultyTable=requestedTable==='official'?'official':mode==='DP'?'dp':requestedTable==='dp'?'sp12':requestedTable;
 const radarError=radarRangeError(radarRanges),radarActive=showRadar&&radarMode;
 const rankItems=useMemo(()=>Array.from(new Map(charts.filter(c=>c.mode===mode&&inDifficultyTable(c,table)).map(c=>chartRank(c,table,gauge,cpiGauge)).filter((r):r is NonNullable<typeof r>=>!!r).map(r=>[String(r.value),r.label]))).sort((a,b)=>compareNullable(ratingSortValue(Number(a[0]),table),ratingSortValue(Number(b[0]),table),1)).map(([value,label])=>({value,label})),[charts,mode,table,gauge,cpiGauge]);
 const busy=saving||transitioning||catalogImportReading;
 useEffect(()=>{
  let active=true;readLibrary().then(({state:s,catalog:stored})=>{
   if(!active)return;appRef.current=s;catalogRef.current=stored;setApp(s);setCatalog(stored);setFolderNames(s.folders.map(f=>f.name));
   const available=stored?.charts??sampleCharts,id=stored?canonicalSongId('mei'):'mei';
   const c=available.find(c=>c.songId===id&&c.mode===s.preferences.mode&&c.difficulty==='ANOTHER')??available.find(c=>c.mode===s.preferences.mode)!;
   setSelected(c);setDraft(s.notes[noteKey(c,s.preferences.spSide)]??blankNote());setReady(true);
  }).catch(()=>{if(active){setStorageError('保存領域を開けませんでした。再読み込みしてお試しください。入力・保存は停止しています。');setReady(true);}});
  if(navigator.storage?.persisted)navigator.storage.persisted().then(v=>active&&setPersistence(v?'有効':'未許可')).catch(()=>active&&setPersistence('確認できません'));else setPersistence('非対応');
  const media=window.matchMedia('(max-width: 1150px)');setCompact(media.matches);const change=()=>setCompact(media.matches);media.addEventListener('change',change);return()=>{active=false;media.removeEventListener('change',change);};
 },[]);
 useEffect(()=>{if(!dirty)return;const prevent=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',prevent);return()=>window.removeEventListener('beforeunload',prevent);},[dirty]);
 const commit=useCallback((mutate:(s:AppState)=>AppState,nextCatalog?:Catalog)=>{const task=queue.current.catch(()=>{}).then(async()=>{const next=mutate(appRef.current);await writeState(next,nextCatalog);appRef.current=next;setApp(next);if(nextCatalog){catalogRef.current=nextCatalog;setCatalog(nextCatalog);}return next;});queue.current=task;return task;},[]);
 const perform=async(action:PendingAction['run'])=>{if(transitionLock.current||saveLock.current)return false;transitionLock.current=true;setTransitioning(true);try{return(await action())!==false;}catch{toast.error('切り替えできませんでした。編集内容は残っています。');return false;}finally{transitionLock.current=false;setTransitioning(false);}};
 const guard=(run:PendingAction['run'],description='一覧に戻る')=>{if(transitionLock.current||saveLock.current||pendingAction)return;if(dirty){setSaveError('');setPendingAction({run,description});}else void perform(run);};
 const loadChart=(c:Chart,side:Side)=>{setSelected(c);setDraft(appRef.current.notes[noteKey(c,side)]??blankNote());setDirty(false);setSaveError('');};
 const selectChart=(c:Chart)=>{if(c.id===selected.id&&(!compact||editorOpen))return;guard(()=>{loadChart(c,appRef.current.preferences.spSide);setEditorOpen(true);},`${songById[c.songId].title} / ${c.mode} ${c.difficulty}へ切替`);};
 const openActivityChart=(c:Chart)=>guard(async()=>{if(c.mode!==appRef.current.preferences.mode)await commit(s=>({...s,preferences:{...s.preferences,mode:c.mode}}));loadChart(c,appRef.current.preferences.spSide);setEditorOpen(true);},`${songById[c.songId].title}の編集を開く`);
 const closeEditor=()=>guard(()=>{loadChart(selected,spSide);setEditorOpen(false);});
 const setNote=(n:Note)=>{setDraft(n);setDirty(true);setSaveError('');};
 const changePreference=async(nextMode:Mode,nextSide:Side)=>{
  if(!ready||storageError)return false;
  const songCharts=charts.filter(c=>c.songId===selected.songId&&c.mode===nextMode);
  const c=songCharts.find(c=>c.difficulty===selected.difficulty)??songCharts[0]??charts.find(c=>c.mode===nextMode);
  if(!c){toast.info(`${nextMode}譜面は登録されていません。`);return false;}
  try{await commit(s=>({...s,preferences:{mode:nextMode,spSide:nextSide}}));loadChart(c,nextSide);if(nextMode!==mode)updateView(v=>({...v,rank:'all',difficultyFolder:null}));if(nextMode!==mode&&difficulty!=='all')setDifficulty(c.difficulty);if(!songCharts.length)toast.info(`この曲に${nextMode}譜面がないため、${songById[c.songId].title}を表示しました。`);else if(c.difficulty!==selected.difficulty)toast.info(`${nextMode}に${selected.difficulty}がないため、${c.difficulty}を開きました。`);return true;}catch{setSaveError('切替設定を保存できませんでした。もう一度お試しください。');toast.error('全体設定を保存できませんでした。');return false;}
 };
 const changeMode=(m:string)=>{if(m!==mode)guard(()=>changePreference(m as Mode,spSide),`${m}へ切替`);};
 const changeTable=(value:string)=>guard(async()=>{const next=value as DifficultyTable,nextMode=next==='dp'?'DP':next==='official'?mode:'SP';if(nextMode!==mode&&!(await changePreference(nextMode,spSide)))return false;updateView(v=>({...v,table:next,rank:'all',difficultyFolder:null,filters:{...v.filters,levels:[]},difficulty:next==='sp11'||next==='sp12'||next==='cpi'?'all':v.difficulty,sort:next==='official'&&v.sort==='unofficial'?'level':v.sort}));},'難易度表を切り替え');
 const changeSide=(s:string)=>{if(s!==spSide)guard(()=>changePreference(mode,s as Side),`SP ${s}側へ切替`);};
 const changeEditorChart=(id:string)=>{const c=charts.find(c=>c.id===id&&c.songId===selected.songId&&c.mode===mode);if(c&&c.id!==selected.id)guard(()=>{loadChart(c,spSide);if(difficulty!=='all')setDifficulty(c.difficulty);},`${c.mode} ${c.difficulty}へ切替`);};
 const saveNote=async():Promise<boolean>=>{
  if(saveLock.current||transitionLock.current||!ready||storageError)return false;
  const reject=(message:string)=>{setSaveError(message);toast.error(message);return false;};
  if(mode==='DP'&&hasLegacyDisplayConflict(draft))return reject('旧データの表示設定を1P・2Pのどちらから引き継ぐか選んでください。');
  const display=mode==='DP'?commonDisplay(draft):spSide==='1P'?draft.left:draft.right;
  for(const v of [display.whiteTop,display.whiteBottom])if(v!==''&&(!/^\d+$/.test(v)||+v>1000))return reject('白数字は0〜1000の整数で入力してください。');
  if(display.green!==''&&(!/^\d+$/.test(display.green)||+display.green<1||+display.green>9999))return reject('緑数字は1〜9999の整数で入力してください。');
  saveLock.current=true;setSaving(true);setSaveError('');
  const note:Note={...draft,...(mode==='DP'?{display:{...display}}:{}),updatedAt:new Date().toISOString()},key=noteKey(selected,spSide);
  try{await commit(s=>({...s,notes:{...s.notes,[key]:note}}));setDraft(note);setDirty(false);toast.success(`${songById[selected.songId].title} · ${selected.mode} ${selected.difficulty}${mode==='SP'?` ${spSide}`:''} の設定を保存しました`);return true;}catch{return reject('保存できませんでした。入力内容は残っています。もう一度お試しください。');}finally{saveLock.current=false;setSaving(false);}
 };
 const finishPending=async(save:boolean)=>{const action=pendingAction;if(!action||saveLock.current||transitionLock.current)return;if(save&&!(await saveNote()))return;if(await perform(action.run))setPendingAction(null);};
 const toggleFavorite=async(songId:string,folderId:string)=>{try{await commit(s=>({...s,folders:s.folders.map(f=>f.id===folderId?{...f,songIds:f.songIds.includes(songId)?f.songIds.filter(id=>id!==songId):[...f.songIds,songId]}:f)}));}catch{toast.error('お気に入りを保存できませんでした。');}};
 const requestPersistence=async()=>{if(!navigator.storage?.persist){setPersistence('非対応');return;}try{const result=await navigator.storage.persist();setPersistence(result?'有効':'未許可');toast[result?'success':'info'](result?'永続保存が許可されました。':'永続保存は許可されませんでした。通常の端末内保存は利用できます。');}catch{setPersistence('確認できません');toast.error('永続保存を確認できませんでした。');}};
 const updateCatalog=async()=>{
  if(!ready||storageError)return false;
  if(!navigator.onLine){setCatalogError('楽曲DBの更新には通信が必要です。保存済みのDBと設定はそのまま使えます。');return false;}
  setCatalogUpdating(true);setCatalogError('');setCatalogNotice('');setCatalogStage('取得中…');
  try{
   const incoming=await fetchCatalog((done,total)=>setCatalogStage(`取得中 ${done}/${total}`));
   const merged=mergeCatalog(catalogRef.current,incoming,appRef.current);let conflicts=0;
   setCatalogStage('保存中…');
   const next=await commit(s=>{const migrated=migrateLegacyState(s,merged.catalog);conflicts=migrated.conflicts;return migrated.state;},merged.catalog);
   const id=canonicalChartId(selected.id),target=merged.catalog.charts.find(c=>c.id===id)??merged.catalog.charts.find(c=>c.mode===next.preferences.mode)!;
   loadChart(target,next.preferences.spSide);setFolderNames(next.folders.map(f=>f.name));
   const message=`${merged.catalog.songs.length.toLocaleString()}曲・${merged.catalog.charts.length.toLocaleString()}譜面を端末に保存しました。`;
   setCatalogNotice(message);toast.success(message);
   if(conflicts)toast.info(`旧IDの設定${conflicts}件は競合のため統合せず、バックアップ内に保持しています。`);
   return true;
  }catch(e){const message=e instanceof Error?e.message:'楽曲DBを更新できませんでした。';setCatalogError(`${message} 保存済みDBと設定は保持しています。`);setSaveError(message);return false;}
  finally{setCatalogUpdating(false);}
 };
 const requestCatalogUpdate=()=>guard(updateCatalog,'楽曲DBを更新');
 const importCatalog=async(data:CatalogImport,origin:ImportOrigin)=>{
  if(!ready||storageError)throw new Error('端末の保存領域を利用できません。');
  if(dirty)throw new Error('曲編集の変更を保存するか、編集を終了してから取り込んでください。');
  if(saveLock.current||transitionLock.current)throw new Error('ほかの保存処理が終わってからお試しください。');
  transitionLock.current=true;setTransitioning(true);
  try{
   const merged=mergeCatalogImport(catalogRef.current,data,origin);
   if(!merged.acceptedCharts)throw new Error('取り込める曲がありません。照合保留の内容を確認してください。');
   const incoming=catalogRef.current?merged.catalog:mergeCatalog(null,merged.catalog,appRef.current).catalog;
   const target=incoming.charts.find(c=>c.id===canonicalChartId(selected.id))??incoming.charts.find(c=>c.mode===appRef.current.preferences.mode)??incoming.charts[0];
   const next=await commit(state=>{const migrated=migrateLegacyState(state,incoming).state;return {...migrated,preferences:{...migrated.preferences,mode:target.mode}};},incoming);
   loadChart(target,next.preferences.spSide);setFolderNames(next.folders.map(f=>f.name));setCatalogError('');
   const message=`楽曲JSONを取り込みました（${merged.updatedSongs+merged.addedSongs}曲・${merged.acceptedCharts}譜面）。`;
   setCatalogNotice(message);toast.success(message);
  }catch(error){throw new Error(error instanceof Error?`${error.message} 取り込みが完了するまで保存済みDBは変更しません。`:'保存できませんでした。端末の空き容量を確認してください。');}
  finally{transitionLock.current=false;setTransitioning(false);}
 };
 const requestAppUpdate=()=>guard(()=>{setDirty(false);offline.applyUpdate();},'新しいアプリに切り替える');
 const restoreBackup=async(next:AppState)=>{
  if(!ready||storageError)throw new Error('端末の保存領域を利用できません。再読み込みしてお試しください。');
  if(dirty)throw new Error('編集中の内容を保存するか、編集を終了してから復元してください。');
  if(saveLock.current||transitionLock.current)throw new Error('保存処理が終わってから、もう一度お試しください。');
  transitionLock.current=true;setTransitioning(true);
  try{
   if(catalogRef.current)next=migrateLegacyState(next,catalogRef.current).state;
   await commit(()=>next);
   const target=charts.find(c=>c.songId===selected.songId&&c.mode===next.preferences.mode&&c.difficulty===selected.difficulty)??charts.find(c=>c.mode===next.preferences.mode)!;
   loadChart(target,next.preferences.spSide);setFolderNames(next.folders.map(f=>f.name));setDifficulty(target.difficulty);setEditorOpen(false);setFolder('all');setSavedOnly(false);
  }catch{throw new Error('端末に保存できませんでした。復元は完了していません。もう一度お試しください。');}
  finally{transitionLock.current=false;setTransitioning(false);}
 };
 const resetFilters=()=>updateView(clearLibraryFilters);
 const filterCount=Object.entries(filters).filter(([k,v])=>(k==='levels'||k==='features')?(v as unknown[]).length>0:k==='soflan'?v:k==='artist'?!!normalized(String(v)):v!=='all').length+(rank==='all'?0:1)+(playStatus==='all'?0:1)+radarRanges.filter(r=>r.min!==''||r.max!=='').length;
 const detailFiltersChanged=filterCount-(filters.availability==='available'?1:0)>0||filters.availability==='all';
 const hasActiveFilters=!!query||!!filters.artist||difficulty!=='all'||detailFiltersChanged||folder!=='all'||savedOnly||(difficultyFolderMode&&difficultyFolder!==null);
 const folderSongIds=useMemo(()=>{
  const selectedFolder=app.folders.find(item=>item.id===folder);
  return selectedFolder?new Set(selectedFolder.songIds):null;
 },[app.folders,folder]);
 const filteredResults=useMemo(()=>{
  const q=normalized(query),artistQuery=normalized(filters.artist);
  if(radarError)return [];
  const direction=sortDirection==='asc'?1:-1;
  const axis=radarAxes.findIndex(item=>item.key===sort);
  return charts.filter(c=>{const s=songById[c.songId],search=searchBySong[c.songId];return matchesPlayFilter(playRecords[c.id],playStatus)&&c.mode===mode&&inDifficultyTable(c,table)&&(rank==='all'||String(chartRank(c,table,gauge,cpiGauge)?.value??'missing')===rank)&&matchesRadar(c,radarRanges)&&(difficulty==='all'||c.difficulty===difficulty)&&(!q||search.title.includes(q))&&(filters.series==='all'||s.series===Number(filters.series))&&(!artistQuery||search.artist.includes(artistQuery))&&matchesChartFeatures(c,filters.features)&&matchesDifficultyLevels(c.level,filters.levels)&&(filters.availability==='all'||(filters.availability==='removed'?s.removed:!s.removed&&!s.availabilityUnknown))&&(!filters.soflan||(c.soflan??s.soflan))&&(!folderSongIds||folderSongIds.has(s.id))&&(!savedOnly||!!app.notes[noteKey(c,spSide)]);}).sort((a,b)=>{
   const first=songById[a.songId],second=songById[b.songId];
   const titleOrder=first.title.localeCompare(second.title,'ja');
   const seriesOrder=first.series<0?(second.series<0?0:1):second.series<0?-1:(first.series-second.series)*(sort==='catalog'?direction:1);
   const tieOrder=first.id.localeCompare(second.id,'en',{numeric:true})||difficulties.indexOf(a.difficulty)-difficulties.indexOf(b.difficulty);
   if(axis>=0)return compareNullable(a.radar?.values[axis],b.radar?.values[axis],direction)||seriesOrder||titleOrder||tieOrder;
   if(sort==='unofficial'){const ar=chartRating(a,table,gauge,cpiGauge)?.value,br=chartRating(b,table,gauge,cpiGauge)?.value;return compareNullable(ratingSortValue(ar,table),ratingSortValue(br,table),direction)||seriesOrder||titleOrder||tieOrder;}
   if(sort==='title')return direction*titleOrder||seriesOrder||tieOrder;
   if(sort==='level')return direction*(a.level-b.level)||seriesOrder||titleOrder||tieOrder;
   return seriesOrder||titleOrder||tieOrder;
  });
 },[query,filters,difficulty,folderSongIds,savedOnly,sort,sortDirection,mode,spSide,app.notes,charts,songById,searchBySong,table,gauge,cpiGauge,rank,radarRanges,radarError,playStatus,playRecords]);
 const folderContext=useMemo(()=>({table,mode,gauge,cpiGauge,officialGrouping:officialFolderGrouping,songById,seriesNames}),[table,mode,gauge,cpiGauge,officialFolderGrouping,songById,seriesNames]);
 const difficultyFolderActive=difficultyFolderMode;
 const difficultyFolders=useMemo(()=>difficultyFolderActive?buildDifficultyFolders(charts,filteredResults,folderContext,playRecords):[],[difficultyFolderActive,charts,filteredResults,folderContext,playRecords]);
 const dpParentFolder=table==='dp'&&difficultyFolder!==null&&/^\d+(?:\.\d+)?$/.test(difficultyFolder)?difficultyFolders.find(f=>f.key===String(Math.floor(Number(difficultyFolder)))):undefined;
 const dpFolderContext=useMemo(()=>({...folderContext,dpParent:dpParentFolder?.key}),[folderContext,dpParentFolder?.key]);
 const dpSubfolders=useMemo(()=>dpParentFolder?buildDifficultyFolders(charts,filteredResults,dpFolderContext,playRecords):[],[dpParentFolder,charts,filteredResults,dpFolderContext,playRecords]);
 const activeDpSubfolder=dpSubfolders.find(f=>f.key===difficultyFolder);
 const activeDifficultyFolder=difficultyFolderActive?(activeDpSubfolder??dpParentFolder??difficultyFolders.find(f=>f.key===difficultyFolder)):undefined;
 const showDpSubfolders=!!dpParentFolder&&!activeDpSubfolder;
 const results=useMemo(()=>activeDifficultyFolder?filteredResults.filter(c=>difficultyFolderKey(c,activeDpSubfolder?dpFolderContext:folderContext)===activeDifficultyFolder.key):filteredResults,[activeDifficultyFolder,activeDpSubfolder,filteredResults,folderContext,dpFolderContext]);
 const folderPanel=useRef<HTMLDivElement>(null);
 const openDifficultyFolder=(key:string|null)=>{setViewField('difficultyFolder',key);requestAnimationFrame(()=>folderPanel.current?.scrollIntoView({block:'start'}));};
 const goUpDifficultyFolder=()=>openDifficultyFolder(activeDpSubfolder?dpParentFolder!.key:null);
 const folderSwipe=useFolderSwipe({enabled:!!activeDifficultyFolder&&!busy&&!settingsOpen&&!filterOpen&&!editorOpen&&!pendingAction,folderKey:difficultyFolder,onBack:goUpDifficultyFolder});
 useEffect(()=>setVisibleCount(60),[query,filters,difficulty,folder,savedOnly,sort,sortDirection,mode,spSide,catalog,table,gauge,cpiGauge,rank,radarRanges,difficultyFolder,difficultyFolderMode,officialFolderGrouping,playStatus,scoreSource]);
 const savedCount=charts.filter(c=>c.mode===mode&&app.notes[noteKey(c,spSide)]).length,activeSong=songById[selected.songId]??sampleSongById[selected.songId]??songs[0];
 const toolSnapshot=useRef({results,mode,spSide,songById,sampleData:!catalog});toolSnapshot.current={results,mode,spSide,songById,sampleData:!catalog};
 useEffect(()=>{type Context={registerTool:(tool:unknown,options:{signal:AbortSignal})=>unknown};const context=(document as Document&{modelContext?:Context}).modelContext;if(!context?.registerTool)return;const lifecycle=new AbortController();try{Promise.resolve(context.registerTool({name:'read_visible_iidx_charts',title:'表示中のIIDX譜面を読む',description:'現在のフィルターで表示される譜面を読みます。データや設定は変更しません。',inputSchema:{type:'object',properties:{limit:{type:'integer',minimum:1,maximum:100}},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:(input:unknown)=>{if(typeof input!=='object'||input===null||Array.isArray(input))throw new Error('Object required');const o=input as Record<string,unknown>;if(Object.keys(o).some(k=>k!=='limit'))throw new Error('Unexpected field');const limit=o.limit??20;if(!Number.isInteger(limit)||Number(limit)<1||Number(limit)>100)throw new Error('limit must be an integer from 1 to 100');const v=toolSnapshot.current;return{sampleData:v.sampleData,mode:v.mode,side:v.spSide,total:v.results.length,charts:v.results.slice(0,Number(limit)).map(c=>({...c,title:v.songById[c.songId].title}))};}},{signal:lifecycle.signal})).catch(()=>{});}catch{}return()=>lifecycle.abort();},[]);
 const filterControls=<div className="filter-content">
  <div className="filter-heading"><span><SlidersHorizontal size={16}/>絞り込み</span><button onClick={resetFilters} className="text-button" disabled={!viewReady||!hasActiveFilters}>初期値に戻す</button></div>
  <div className="field-label">シリーズ</div><Choice label="シリーズで絞り込み" value={filters.series} onChange={v=>setFilters(current=>({...current,series:v}))} items={[{value:'all',label:'すべてのシリーズ'},...Array.from(new Set(songs.map(s=>s.series))).sort((a,b)=>b-a).map(v=>({value:String(v),label:`${seriesCode(v)} · ${seriesNames[v]}`}))]}/>
  <div className="field-label spaced">難度値 <small>複数選択可</small></div><div className="level-grid" role="group" aria-label="難度値で絞り込み"><button aria-pressed={filters.levels.length===0} className={filters.levels.length===0?'active':''} onClick={()=>setFilters(current=>({...current,levels:[]}))}>全て</button>{Array.from({length:12},(_,i)=>i+1).map(v=><button key={v} aria-label={`難度値 ☆${v}`} aria-pressed={filters.levels.includes(v)} className={filters.levels.includes(v)?'active':''} onClick={()=>setFilters(current=>({...current,levels:toggleDifficultyLevel(current.levels,v)}))}>{v}</button>)}</div>
  {table!=='official'&&<><div className="field-label spaced">{table==='cpi'?'適正CPI（100刻み）':'非公式難度'}</div><Choice label="非公式難度で絞り込み" value={rank} onChange={v=>setViewField('rank',v)} items={[{value:'all',label:'すべて'},...rankItems,{value:'missing',label:'未掲載'}]}/></>}
  <div className="field-label spaced">クリア状態</div><Choice label="クリア状態で絞り込み" value={playStatus} onChange={v=>setViewField('playStatus',v)} items={[{value:'all',label:'すべて'},{value:'played',label:'プレー済み'},{value:'scored',label:'スコア記録あり'},{value:'missing',label:'未取得'},...lamps.map(lamp=>({value:lamp,label:lampLabels[lamp]}))]}/>
  <ArtistFilter artists={artists} value={filters.artist} onChange={artist=>setFilters(f=>({...f,artist}))}/>
  <div className="field-label spaced">収録状況</div><Choice label="収録状況で絞り込み" value={filters.availability} onChange={v=>setFilters(current=>({...current,availability:v as Filters['availability']}))} items={[{value:'all',label:'すべて（削除曲を含む）'},{value:'available',label:'AC収録曲のみ'},{value:'removed',label:'AC未収録（削除曲など）'}]}/>
  <label className="switch-line"><span><Activity size={16}/>ソフラン曲のみ</span><Switch checked={filters.soflan} onCheckedChange={v=>setFilters(current=>({...current,soflan:v}))}/></label><fieldset className="feature-filters"><legend className="field-label">譜面要素</legend><div>{chartFeatureKeys.map(feature=><label className="switch-line" key={feature}><span className={`chart-feature feature-${feature.toLowerCase()}`}>{feature}</span><Switch aria-label={`${feature}を含む譜面のみ`} checked={filters.features.includes(feature)} disabled={!viewReady} onCheckedChange={enabled=>setFilters(current=>({...current,features:enabled?[...current.features.filter(key=>key!==feature),feature]:current.features.filter(key=>key!==feature)}))}/></label>)}</div><p>オンにした要素をすべて含む譜面。オフは指定なし。</p></fieldset><RadarFilters ranges={radarRanges} onChange={v=>setViewField('radarRanges',v)} error={radarError}/><p className="filter-footnote">条件は自動保存され、次回起動時も引き継ぎます。</p>
 </div>;
 const numberDefaults=chartCommonNumbers(app,selected,activeSong,spSide);
 const favoritePicker=(songId:string)=><Popover><PopoverTrigger asChild><button className={`favorite-button ${app.folders.some(f=>f.songIds.includes(songId))?'favorited':''}`} aria-label={`${songById[songId].title}のお気に入りを編集`} disabled={!ready||busy||!!storageError}><Star size={18}/></button></PopoverTrigger><PopoverContent align="end" className="favorite-menu"><h3>お気に入りに登録</h3><p>複数のフォルダーに登録できます</p>{app.folders.map(f=><label key={f.id}><Checkbox checked={f.songIds.includes(songId)} onCheckedChange={()=>void toggleFavorite(songId,f.id)}/><span className="folder-dot" style={{background:f.color}}/><span>{f.name}</span></label>)}</PopoverContent></Popover>;
 const editor=<div className={`editor ${mode==='DP'?'dp-editor':''}`}>
  <div className="editor-top"><span className="eyebrow"><NotebookPen size={15}/>OPTION NOTE</span>{(compact||activityOpen)?<button className="icon-button" aria-label="一覧に戻る" disabled={busy} onClick={closeEditor}><X size={20}/></button>:<span className="local-caption"><Smartphone size={13}/>端末内に保存</span>}</div>
  <div className="editor-song"><div className="song-micro">{seriesCode(activeSong.series)} / {seriesNames[activeSong.series]}{activeSong.availabilityUnknown&&<span className="removed-label">収録状況不明</span>}{activeSong.removed&&<span className="removed-label">{catalog?'AC未収録':'削除曲'}</span>}</div><h2 style={titleStyle(activeSong.series)}>{activeSong.title}</h2><p>{activeSong.artist}</p><div className="editor-meta"><span className="mode-badge">{mode}</span>{diffBadge(selected.difficulty)}<span className="editor-level">☆{selected.level||'?'}</span><span className="bpm">BPM {selected.bpm??activeSong.bpm}</span><ChartFeatures chart={selected}/>{!!selected.manualApplied?.length&&<span className="manual-badge">譜面データ手入力</span>}{favoritePicker(activeSong.id)}</div></div>
  <div className="editor-switches">
   <div><Tabs value={mode} onValueChange={changeMode}><TabsList aria-label="編集中のプレイモード">{(['SP','DP'] as Mode[]).map(m=><TabsTrigger key={m} value={m} disabled={!ready||busy||!!storageError||!charts.some(c=>c.songId===selected.songId&&c.mode===m)}>{m}</TabsTrigger>)}</TabsList></Tabs></div>
   <div><Choice label="編集中の譜面難易度" value={selected.id} onChange={changeEditorChart} disabled={!ready||busy||!!storageError} items={charts.filter(c=>c.songId===selected.songId&&c.mode===mode).map(c=>({value:c.id,label:`${c.difficulty} ☆${c.level||'?'}`}))}/></div>
  </div>
  <div className="editor-scroll">
   {showPlayData&&<><PlayScoreDetails score={playRecords[selected.id]} chart={selected} display={playDisplay} sourceLabel={selectedScoreSource}/><PlayScoreHistory scores={chartPlayHistory(playHistory,selected.id)} seriesNames={seriesNames}/></>}
   <ManualPlayEditor key={selected.id} chart={selected} title={activeSong.title} history={playHistory} seriesNames={seriesNames} source={scoreSource} disabled={!ready||busy||!!storageError} onSave={async input=>{await commit(s=>applyManualPlay(s,selected,input));toast.success('手入力のプレイデータを保存しました。');}}/>
   <ManualChartEditor key={`chart-${selected.id}`} chart={selected} title={activeSong.title} displayBpm={selected.bpm??activeSong.bpm} disabled={!ready||busy||!!storageError} onSave={async data=>{await commit(s=>{const manualCharts={...s.manualCharts},id=canonicalChartId(selected.id);delete manualCharts[selected.id];if(data.bpm===undefined&&data.noteCount===undefined&&!data.radarValues)delete manualCharts[id];else manualCharts[id]=data;return {...s,manualCharts};});toast.success('手入力の譜面データを保存しました。');}}/>
   <ImportedChartDetails song={activeSong} chart={selected}/>
   {showUnofficial&&<div className="editor-community"><CommunityRating chart={selected} table={table} gauge={gauge} cpiGauge={cpiGauge} automatic/></div>}
   {showRadar&&<section className="editor-radar"><div className="radar-heading"><h3>ノーツレーダー</h3><span>基準100 / 最大200</span></div><NotesRadar chart={selected} title={activeSong.title}/><p>{selected.manualApplied?.includes('radarValues')?'未取得項目を手入力で補完':selected.supplementBase!==undefined?'通常DB＋目視確認JSON（不足分を補完）':selected.importedInfo?.radarValues!==undefined?'KONAMIフォーマットプロジェクト解析':'joy to the beat...'}{selected.radar?` · ${selected.radar.notes.toLocaleString()} notes`:''}</p></section>}
   {(selected.soflan??activeSong.soflan)&&<div className="soflan-info"><Activity size={17}/><span>ソフラン曲<small>区間ごとの調整はコメントに記録</small></span></div>}
   <fieldset disabled={!ready||!!storageError||busy} className="editor-fields">
   {numberDefaults&&<p className="common-number-editor-help">空欄は共通値：緑 {numberDefaults.green||'—'} ／ SUD+ {numberDefaults.whiteTop||'—'}{showLift&&<>・LIFT {numberDefaults.whiteBottom||'—'}</>}。この譜面だけ変更する場合は数値を入力してください。</p>}
   {mode==='DP'&&<div className="dp-common"><label className="switch-line"><span><ArrowLeftRight size={16}/>FLIP<span className="muted">左右入替</span></span><Switch checked={draft.flip} onCheckedChange={v=>setNote({...draft,flip:v})}/></label><Choice label="DP 左右ランダム連動" value={draft.link} onChange={v=>setNote({...draft,link:v,left:{...draft.left,...(v!=='OFF'?{style:'RANDOM'}:{})},right:{...draft.right,...(v!=='OFF'?{style:'RANDOM'}:{})}})} items={[{value:'OFF',label:'左右ランダム連動：なし'},{value:'SYNCHRONIZE',label:'SYNCHRONIZE RANDOM'},{value:'SYMMETRY',label:'SYMMETRY RANDOM'}]}/></div>}
   <div className={`side-fields ${mode==='DP'?'two-sides':''}`}>
    {(mode==='DP'||spSide==='1P')&&<SideFields showLift={showLift} dp={mode==='DP'} side="1P" defaults={numberDefaults} value={draft.left} onChange={v=>setNote({...draft,left:v,...(v.style!=='RANDOM'?{link:'OFF'}:{})})}/>}
    {(mode==='DP'||spSide==='2P')&&<SideFields showLift={showLift} dp={mode==='DP'} side="2P" defaults={numberDefaults} value={draft.right} onChange={v=>setNote({...draft,right:v,...(v.style!=='RANDOM'?{link:'OFF'}:{})})}/>}
   </div>
   {mode==='DP'&&<>
    <section className="shared-display"><div className="shared-heading"><h3>表示オプション</h3><span>左右共通</span></div>
     {hasLegacyDisplayConflict(draft)&&<div className="legacy-display"><p>旧データの左右で表示設定が異なります。共通にする値を選んでください。</p>{(['1P','2P'] as Side[]).map(side=>{const source=side==='1P'?draft.left:draft.right;return <button key={side} className="secondary-button" onClick={()=>setNote({...draft,display:displayFromSide(source)})}>{side}から引き継ぐ<small>{source.cover} / SUD+ {source.whiteTop||'—'}{showLift&&<>・LIFT {source.whiteBottom||'—'}</>} / 緑 {source.green||'—'}</small></button>;})}</div>}
     <DisplayFields showLift={showLift} label="DP共通" defaults={numberDefaults} value={commonDisplay(draft)} onChange={v=>setNote({...draft,display:v})}/>
    </section>
    <div className="side-fields two-sides dp-comments">{(['1P','2P'] as Side[]).map(side=>{const key=side==='1P'?'left':'right';return <div key={side}><label className="field-label" htmlFor={`dp-${side}-comment`}>{side} コメント</label><textarea id={`dp-${side}-comment`} aria-label={`${side} コメント`} value={draft[key].comment} onChange={e=>setNote({...draft,[key]:{...draft[key],comment:e.target.value}})} maxLength={2000} placeholder="配置の狙い、注意点など" rows={3}/></div>;})}</div>
   </>}
   </fieldset><p className="editor-help">{mode==='SP'?`${spSide}側の設定です。反対側の設定は別に保持します。`:'譜面配置は左右別、表示オプションは左右共通で保存します。'}</p>
  </div>
  <div className="save-bar">{saveError&&!pendingAction&&<p className="save-error" role="alert">{saveError}</p>}<div className="save-state" aria-live="polite">{dirty?<><span className="unsaved-dot"/>未保存の変更</>:draft.updatedAt?<><Check size={14}/>保存済み<time>{new Date(draft.updatedAt).toLocaleDateString('ja-JP')}</time></>:<><span className="outline-dot"/>この譜面は未設定</>}</div><button className="save-button" disabled={!ready||busy||!!storageError} onClick={()=>void saveNote()}>{saving?<Loader2 size={18} className="spin"/>:<Save size={18}/>}設定を保存</button></div>
 </div>;
 return <div className="app-shell" data-iidx-app="1">
  <Toaster theme={theme} position="bottom-center" richColors/>
  <BrowserInstallNotice displayModeReady={offline.displayModeReady} standalone={offline.standalone} paused={activityOpen||settingsOpen||filterOpen||editorOpen||!!pendingAction||handoff.phase!=='idle'}/>
  <header className="app-header"><div className="brand"><span className="brand-mark"><img src={`${import.meta.env.BASE_URL}icons/iidx-memo-192-v2.png`} alt="" width={39} height={39}/></span><span>IIDX<span className="brand-secondary">OPTION NOTES<small className="app-version" aria-label={`アプリバージョン ${APP_INFO.version}`}>v{APP_INFO.version}</small></span></span></div><div className="header-right"><button className="icon-button activity-header-button" title={activityOpen?'曲一覧へ戻る':'マイアクティビティ'} aria-label={activityOpen?'曲一覧へ戻る':'マイアクティビティを開く'} aria-pressed={activityOpen} disabled={!ready||busy} onClick={()=>guard(()=>{setEditorOpen(false);if(activityOpen){window.history.replaceState(null,'',window.location.pathname+window.location.search);setActivityOpen(false);}else{window.location.hash='activity';}},activityOpen?'曲一覧へ戻る':'マイアクティビティを開く')}>{activityOpen?<ListMusic size={20}/>:<Activity size={20}/> }</button><span className="prototype-badge">OPTION LIBRARY</span><button className="storage-pill" onClick={()=>setSettingsOpen(true)}><Smartphone size={15}/><span>端末内保存</span>{ready&&!storageError&&<Check size={13}/>}</button><button className="icon-button settings-button" aria-label="全体設定を開く" onClick={()=>{setFolderNames(app.folders.map(f=>f.name));setSettingsOpen(true);}}><Settings2 size={20}/></button></div></header>
  {activityOpen?<MyActivity charts={charts} songs={songs} records={playRecords} initialMode={mode} source={scoreSource} sources={activitySources} onSource={value=>setViewField('scoreSource',value)} ready={ready&&viewReady} sample={!catalog} error={storageError} disabled={busy||editorOpen||settingsOpen||!!pendingAction} onChart={openActivityChart} onBack={()=>{window.history.replaceState(null,'',window.location.pathname+window.location.search);setActivityOpen(false);}}/>:<div className="workspace">
   <aside className="sidebar"><div className="nav-label">LIBRARY</div><button className={`nav-item ${!savedOnly&&folder==='all'?'active':''}`} onClick={()=>{setSavedOnly(false);setFolder('all');}}><ListMusic size={18}/>すべての譜面<span>{charts.filter(c=>c.mode===mode).length}</span></button><button className={`nav-item ${savedOnly?'active':''}`} onClick={()=>{setSavedOnly(!savedOnly);setFolder('all');}}><NotebookPen size={18}/>保存済み<span>{savedCount}</span></button>
   <div className="nav-label folder-label">FAVORITES<span>5 FOLDERS</span></div>{app.folders.map(f=><button key={f.id} className={`nav-item ${folder===f.id?'active':''}`} onClick={()=>{setFolder(folder===f.id?'all':f.id);setSavedOnly(false);}}><Folder size={17} color={f.color}/><span className="folder-name">{f.name}</span><span>{f.songIds.length}</span></button>)}<div className="sidebar-filters">{filterControls}</div><div className="sidebar-note"><ShieldCheck size={17}/><span>あなたの設定はこの端末に。<small>外部への送信は行いません。</small></span></div></aside>
   <main className="library-main">
    <div className="library-heading"><div><div className="section-overline">MY CHART LIBRARY</div><h1>楽曲ライブラリ<span className="heading-slash">/</span></h1></div><span className="sample-count">{songs.length.toLocaleString()}<small>{catalog?'登録曲':'曲のサンプル'}</small></span></div>
    <div className={`catalog-strip ${catalog?'catalog-loaded':''}`}><div><span>{catalog?`${charts.length.toLocaleString()}譜面 · 端末内DB`:'サンプルDB · 20曲'}</span><small>{catalog?`取得 ${new Date(catalog.fetchedAt).toLocaleDateString('ja-JP')}`:'全体設定から公開データを取得'}</small></div></div>
    <OfflineStatus offline={offline} hasCatalog={!!catalog&&!storageError} onOpen={()=>{setSettingsReveal('offline');setSettingsOpen(true);}}/>
    {catalogNotice&&<p className="catalog-notice" role="status">{catalogNotice}</p>}{catalogError&&<div role="alert" className="error-banner">{catalogError}</div>}{storageError&&<div role="alert" className="error-banner">{storageError}</div>}
    <div className="play-toolbar"><Tabs value={mode} onValueChange={changeMode} className="play-mode"><TabsList aria-label="プレイモード"><TabsTrigger value="SP">SP</TabsTrigger><TabsTrigger value="DP">DP</TabsTrigger></TabsList></Tabs><div className="global-side">{mode==='SP'?<><span>プレイサイド</span><Tabs value={spSide} onValueChange={changeSide}><TabsList aria-label="SPのプレイサイド"><TabsTrigger value="1P">1P</TabsTrigger><TabsTrigger value="2P">2P</TabsTrigger></TabsList></Tabs></>:<span className="both-sides"><ArrowLeftRight size={16}/>1P + 2P</span>}</div></div>
    <div className="difficulty-table-bar"><label><span>難易度表</span><Choice label="難易度表" value={table} onChange={changeTable} disabled={!ready||busy||!!storageError} items={[{value:'official',label:'公式難度'},{value:'sp12',label:'SP☆12難易度表'},{value:'sp11',label:'SP☆11難易度表'},{value:'dp',label:'DP非公式難易度表'},{value:'cpi',label:'CPI（SP☆12）'}]}/></label>{(table==='sp12'||table==='sp11')&&<label><span>クリア種別</span><Choice label="クリア種別" value={gauge} onChange={v=>updateView(current=>({...current,gauge:v as 'normal'|'hard',rank:'all',difficultyFolder:null}))} items={[{value:'normal',label:'ノマゲ'},{value:'hard',label:'ハード'}]}/></label>}{table==='cpi'&&<label><span>クリア種別</span><Choice label="CPIのクリア種別" value={cpiGauge} onChange={v=>updateView(current=>({...current,cpiGauge:v as CpiGauge,rank:'all',difficultyFolder:null}))} items={cpiGauges}/></label>}</div>
    <div className="difficulty-view-bar"><Tabs value={difficultyFolderMode?'folders':'list'} onValueChange={value=>updateView(v=>({...v,difficultyFolderMode:value==='folders',difficultyFolder:null}))}><TabsList aria-label="難易度表の表示方法"><TabsTrigger value="list">リスト</TabsTrigger><TabsTrigger value="folders"><Folder size={15}/>フォルダ</TabsTrigger></TabsList></Tabs><span>{table==='cpi'?'50刻み':table==='dp'?'整数 → 小数点別':table==='official'?(difficultyFolderMode&&officialFolderGrouping==='series'?'シリーズ別':'☆1～☆12'):'地力・個人差で分類'}</span></div>
    {catalog&&(!catalog.additionalData||(table==='cpi'&&catalog.additionalData.cpiCharts===undefined))&&<p className="additional-notice">追加難易度・レーダーは「全体設定 → 楽曲DBを更新」で取得できます。</p>}
    <div className="search-line"><div className="search-box"><Search size={20}/><input aria-label="曲名で検索" placeholder="曲名で検索" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button className="icon-button" aria-label="検索をクリア" onClick={()=>setQuery('')}><X size={17}/></button>}</div><button className={`filter-button ${filterCount?'filter-active':''}`} aria-label="絞り込みを開く" onClick={()=>setFilterOpen(true)}><SlidersHorizontal size={19}/><span>絞り込み</span>{filterCount>0&&<b>{filterCount}</b>}</button></div>
    <div className="mobile-folders"><button className={!savedOnly&&folder==='all'?'active':''} onClick={()=>{setFolder('all');setSavedOnly(false);}}>すべて</button><button className={savedOnly?'active':''} onClick={()=>{setSavedOnly(!savedOnly);setFolder('all');}}><NotebookPen size={14}/>保存済み</button>{app.folders.map(f=><button key={f.id} className={folder===f.id?'active':''} onClick={()=>{setFolder(folder===f.id?'all':f.id);setSavedOnly(false);}}><span className="folder-dot" style={{background:f.color}}/>{f.name}</button>)}</div>
    <Tabs value={difficulty} onValueChange={setDifficulty} className="difficulty-tabs"><TabsList aria-label="譜面難易度"><TabsTrigger value="all">ALL</TabsTrigger>{difficulties.map(d=><TabsTrigger key={d} value={d} className={d.toLowerCase()} aria-label={d} title={d}><span className="long-label">{d}</span><span className="short-label">{d[0]}</span></TabsTrigger>)}</TabsList></Tabs>
    <div className="radar-mode-bar"><div className="radar-view-toggles"><label className="switch-line"><span>ノーツレーダーモード</span><Switch aria-label="ノーツレーダーモード" checked={radarMode} disabled={!showRadar||!viewReady} onCheckedChange={v=>setViewField('radarMode',v)}/></label><label className="switch-line"><span>レーダー値</span><Switch aria-label="レーダー値を表示" checked={showRadar} disabled={!viewReady} onCheckedChange={v=>setViewField('showRadar',v)}/></label></div><span>{showRadar?(radarActive?'基準枠100 / 最大200':'レーダー値を表示中'):'レーダー表示OFF'}</span></div>
    <div className="list-toolbar"><div aria-live="polite"><strong>{results.length}</strong> 譜面<span>{savedOnly?' / 保存済み':folder!=='all'?` / ${app.folders.find(f=>f.id===folder)?.name}`:''}</span></div><div className="list-actions"><button className="filter-reset-button" aria-label="フィルターを初期値に戻す" title="検索・難易度・絞り込みをリセットし、収録状況をAC収録曲のみに戻す" onClick={resetFilters} disabled={!viewReady||!hasActiveFilters}><RotateCcw size={13}/><span>リセット</span></button><div className="sort-control"><Choice label="一覧の並び順" value={sort} onChange={setSort} disabled={!viewReady} items={[{value:'catalog',label:'シリーズ順'},{value:'title',label:'曲名順'},{value:'level',label:'公式難度順'},...(table==='official'?[]:[{value:'unofficial',label:table==='cpi'?'適正CPI順':'非公式難度順'}]),...radarAxes.map(a=>({value:a.key,label:a.label}))]}/><button className="sort-direction-button" aria-label={`並び順：${sortDirection==='asc'?'昇順。降順に切り替え':'降順。昇順に切り替え'}`} title={sort==='catalog'?`${sortDirection==='asc'?'古い':'新しい'}シリーズから（同じシリーズ内は曲名順）`:sortDirection==='asc'?'昇順（タップで降順）':'降順（タップで昇順）'} disabled={!viewReady} onClick={()=>setViewField('sortDirection',current=>current==='asc'?'desc':'asc')}>{sortDirection==='asc'?<ArrowUp size={13}/>:<ArrowDown size={13}/>}<span>{sortDirection==='asc'?'昇順':'降順'}</span></button></div></div></div>
    {viewError&&<p className="view-save-error" role="alert">{viewError}</p>}{radarError&&<p className="radar-error" role="alert">{radarError}</p>}
    {filterCount>0&&<div className="active-filters">{filters.series!=='all'&&<span>{seriesNames[Number(filters.series)]}</span>}{filters.levels.length>0&&<span>{filters.levels.map(value=>`☆${value}`).join('・')}</span>}{!!normalized(filters.artist)&&<span>アーティスト：{filters.artist.trim()}</span>}{filters.availability!=='all'&&<span>{filters.availability==='removed'?'AC未収録':'AC収録曲'}</span>}{filters.soflan&&<span>ソフラン</span>}{filters.features.map(feature=><span key={feature}>{feature}あり</span>)}{playStatus!=='all'&&<span>{playStatus==='scored'?'スコア記録あり':'クリア：'}{playStatus==='scored'?'':playStatus==='played'?'プレー済み':playStatus==='missing'?'未取得':lampLabels[playStatus as keyof typeof lampLabels]}</span>}{rank!=='all'&&<span>非公式：{rankItems.find(r=>r.value===rank)?.label??'未掲載'}</span>}{radarRanges.map((r,i)=>r.min!==''||r.max!==''?<span key={i}>{radarAxes[i].label} {r.min||'0'}〜{r.max||'200'}</span>:null)}<button disabled={!detailFiltersChanged} onClick={()=>updateView(v=>({...v,filters:defaultFilters(),playStatus:'all',rank:'all',radarRanges:v.radarRanges.map(()=>({min:'',max:''}))}))} aria-label="詳細フィルターを初期値に戻す" title="収録状況はAC収録曲のみに戻します"><RotateCcw size={14}/></button></div>}
    <div className="difficulty-folder-panel" ref={folderPanel} {...folderSwipe}>
    {activeDifficultyFolder&&<div className="folder-swipe-feedback" aria-hidden="true"><span>‹</span><b className="swipe-pull-label">1階層上へ</b><b className="swipe-release-label">離すと戻る</b></div>}
    <div className="folder-swipe-content">
    {table==='official'&&difficultyFolderActive&&<div className="official-folder-grouping"><span>フォルダ分類</span><Tabs value={officialFolderGrouping} onValueChange={value=>updateView(v=>({...v,officialFolderGrouping:value==='series'?'series':'level',difficultyFolder:null}))}><TabsList aria-label="公式難度のフォルダ分類"><TabsTrigger value="level" disabled={!viewReady}>難度値</TabsTrigger><TabsTrigger value="series" disabled={!viewReady}>シリーズ</TabsTrigger></TabsList></Tabs></div>}
    {activeDifficultyFolder&&<DifficultyFolderHeading folder={activeDifficultyFolder} backLabel={activeDpSubfolder?`${dpParentFolder!.key} の小数点別`:'フォルダ一覧'} onBack={goUpDifficultyFolder}/>}
    {activeDifficultyFolder&&<p className="folder-swipe-hint">右へスワイプで1階層上へ</p>}
    {difficultyFolderActive&&(!activeDifficultyFolder||showDpSubfolders)?<><DifficultyFolderList listLabel={showDpSubfolders?'DP非公式難度の小数点別フォルダ一覧':table==='official'&&officialFolderGrouping==='series'?'シリーズフォルダ一覧':'難易度フォルダ一覧'} folders={showDpSubfolders?dpSubfolders:difficultyFolders} summaryMode={folderSummary} onSummaryModeChange={value=>setViewField('folderSummary',value)} prefix={showDpSubfolders?'DP非公式難度':difficultyFolderPrefix(folderContext)} opensSubfolders={table==='dp'&&!showDpSubfolders} onOpen={openDifficultyFolder}/><p className="difficulty-folder-help">{table==='cpi'?'各範囲は下限以上・上限未満。':table==='dp'?(showDpSubfolders?'小数点別フォルダを開くと曲一覧を表示します。':'整数フォルダの中を12.0・12.1などの小数点別で分類します。'):table==='official'&&officialFolderGrouping==='series'?'楽曲DBのシリーズ情報で分類し、新しい順に表示します。':''}曲数・内訳は現在の絞り込み条件で集計します。</p></>:<>
    <div className={`chart-list ${radarActive?'is-radar':''}`} aria-label="楽曲・譜面一覧"><div className="list-head"><span>楽曲 / アーティスト</span><span>難度 / BPM</span><span>保存済みオプション</span><span/></div>
     {results.slice(0,visibleCount).map(c=>{const s=songById[c.songId],note=app.notes[noteKey(c,spSide)],resolvedNote=effectiveNumberNote(note,chartCommonNumbers(app,c,s,spSide),c.mode,spSide);return <article key={c.id} className={`chart-row ${selected.id===c.id?'selected':''}`}>
      <button className="chart-open" aria-label={`${s.title} ${c.mode} ${c.difficulty} レベル${c.level||'?'}の設定を開く`} onClick={()=>selectChart(c)} disabled={!ready||busy}>
       <span className="track-info"><span className="track-title" style={titleStyle(s.series)}>{s.title}</span><span className="track-byline"><span className="track-artist">{s.artist}</span><ChartFeatures chart={c}/>{!!c.manualApplied?.length&&<span className="manual-badge">手入力</span>}</span></span>
       <span className={`chart-difficulty ${c.difficulty.toLowerCase()}`}><span className="difficulty-level"><span className="chart-difficulty-name" title={c.difficulty}>{c.difficulty[0]}</span><span className="level-number"><small>☆</small>{c.level||'?'}</span></span><span className="chart-bpm">BPM {c.bpm??s.bpm}</span></span>
       <span className="row-details"><span className="track-tags"><span className="series-badge">{seriesCode(s.series)}<span>{seriesNames[s.series]}</span></span>{(c.soflan??s.soflan)&&<span className="soflan-tag" role="img" aria-label="ソフラン曲" title="ソフラン曲"><Activity size={14} aria-hidden="true"/></span>}{(c.retained||s.retained)&&<span className="retained-label">前回DB</span>}{s.availabilityUnknown&&<span className="removed-label">収録状況不明</span>}{s.removed&&<span className="removed-label">{catalog?'AC未収録':'削除曲'}</span>}{showUnofficial&&<CommunityRating chart={c} table={table} gauge={gauge} cpiGauge={cpiGauge}/>}</span>{!radarActive&&<span className={`chart-saved ${note?'has-note':''}`}><OptionSummary showLift={app.liftVisibility?.[c.mode]??true} note={resolvedNote} mode={c.mode} side={spSide}/></span>}</span>
       {showPlayData&&hasPlaySummary(playDisplay)&&(playRecords[c.id]||playDisplay.clear)&&<span className={`chart-play ${showRadar?'after-radar':''}`}><PlayScoreSummary score={playRecords[c.id]} chart={c} display={playDisplay}/></span>}
       {showRadar&&<span className="chart-extra">{radarActive?<NotesRadar chart={c} title={s.title} sort={sort}/>:<RadarValues chart={c} compact sort={sort}/>}</span>}
      </button>{favoritePicker(s.id)}</article>;})}
     {!results.length&&<div className="empty-result"><Search size={32}/><h2>該当する譜面がありません</h2><p>{catalog?'条件を変えて検索してください。':'公開データは未取得です。条件を変えるか、楽曲DBを更新してください。'}</p><button className="secondary-button" onClick={resetFilters}><RotateCcw size={15}/>条件を初期値に戻す</button></div>}{results.length>visibleCount&&<button className="load-more" onClick={()=>setVisibleCount(v=>v+60)}>さらに表示（残り{results.length-visibleCount}譜面）</button>}
    </div></>}</div></div><footer className="list-footer"><span>IIDX OPTION NOTES</span><span>{catalog?.importedData?'楽曲JSON / 端末内DB':catalog?'IIDX Data Table / TexTage':'SAMPLE DB'}</span></footer>
   </main>{!compact&&<aside className={`detail-pane ${mode==='DP'?'wide-pane':''}`}>{editor}</aside>}
  </div>}
  <Sheet open={(compact||activityOpen)&&editorOpen} onOpenChange={v=>{if(!v)closeEditor();}}><SheetContent className="editor-sheet" showCloseButton={false}><SheetTitle className="sr-only">{activeSong.title}の譜面設定</SheetTitle><SheetDescription className="sr-only">{mode} {selected.difficulty}のオプション設定を編集します。</SheetDescription>{editor}</SheetContent></Sheet>
  <Sheet open={filterOpen} onOpenChange={setFilterOpen}><SheetContent side="bottom" className="filter-sheet" showCloseButton={false}><div className="sheet-heading"><SheetTitle>楽曲を絞り込む</SheetTitle><button className="icon-button" aria-label="絞り込みを閉じる" onClick={()=>setFilterOpen(false)}><X size={21}/></button></div><SheetDescription>条件の変更はすぐに反映されます。</SheetDescription>{filterControls}<div className="filter-result-bar"><span aria-live="polite"><strong>{results.length}</strong> 譜面が該当</span><div className="filter-result-actions"><button className="filter-reset-button" aria-label="フィルターを初期値に戻す" onClick={resetFilters} disabled={!viewReady||!hasActiveFilters}><RotateCcw size={14}/>リセット</button><button className="secondary-button" onClick={()=>setFilterOpen(false)}>閉じる</button></div></div></SheetContent></Sheet>
  <Sheet open={settingsOpen} onOpenChange={v=>{if(!busy){setSettingsOpen(v);if(!v)setSettingsReveal('');}}}><SheetContent className="settings-sheet" showCloseButton={false}><div className="sheet-heading"><SheetTitle>全体設定</SheetTitle><button className="icon-button" aria-label="全体設定を閉じる" disabled={busy} onClick={()=>{setSettingsOpen(false);setSettingsReveal('');}}><X size={21}/></button></div><SheetDescription>プレイサイド・プレイデータ・データ移行</SheetDescription><div className="settings-scroll">
   <SettingsSection title="公式スコアの取得・取り込み" reveal={!!handoff.incoming||handoff.phase!=='idle'}><PlayImportSettings state={app} songs={songs} charts={charts} incoming={handoff.incoming} handoffPhase={handoff.phase} onHandoffDone={handoff.clear} disabled={!ready||busy||!!storageError} onImport={async matches=>{await commit(s=>applyPlayImport(s,matches));toast.success('プレイデータを保存しました。');}}/></SettingsSection>
   <SettingsSection title="スコアの表示対象"><section className="score-source-settings"><h3>スコアの表示対象</h3><label className="field-label">曲リストに表示するスコア</label><Choice label="曲リストに表示するスコア" value={scoreSource} onChange={value=>setViewField('scoreSource',value as ScoreSource)} disabled={!viewReady||busy} items={[{value:'latest',label:scoreSourceLabel('latest',playHistory,seriesNames)},{value:'best',label:'歴代最高（EXスコア）'},...savedPlayVersions.versions.map(version=>({value:`version:${version}`,label:scoreSourceLabel(`version:${version}`,playHistory,seriesNames)})),...((savedPlayVersions.unknown||scoreSource==='unknown')?[{value:'unknown',label:'シリーズ不明'}]:[]),...(scoreSource.startsWith('version:')&&!savedPlayVersions.versions.includes(Number(scoreSource.slice(8)))?[{value:scoreSource,label:selectedScoreSource+'（記録なし）'}]:[])]}/><p>曲一覧・絞り込み・フォルダ内訳・曲編集のプレイデータに反映します。記録のない譜面のクリア種別は「NO PLAY」と表示します。スコアやシリーズ別の記録は追加されません。</p><p>歴代最高は保存済みのEXスコアを比較し、出典のシリーズ番号を表示します。クリア状況は最新の保存シリーズを使用します。</p></section></SettingsSection>
   <SettingsSection title="画面の表示・シリーズカラー"><AppearanceSettings theme={theme} onTheme={v=>setViewField('theme',v)} enabled={seriesTitleColors} onEnabled={v=>setViewField('seriesTitleColors',v)} colors={seriesColors} onColors={v=>setViewField('seriesColors',v)} outlines={seriesOutlines} onOutlines={v=>setViewField('seriesOutlines',v)} onCopyTheme={(series,from,to)=>{updateView(current=>({...current,...copySeriesAppearance(series,from,to,current.seriesColors,current.seriesOutlines)}));toast.success(`${seriesNames[series]}の色設定を${to==='dark'?'ダーク':'ライト'}へコピーしました。`);}} seriesNames={seriesNames} disabled={!viewReady}/></SettingsSection>
   <SettingsSection title="追加情報の表示"><section><h3><Activity size={17}/>追加情報の表示</h3><label className="switch-line"><span>非公式難易度</span><Switch aria-label="非公式難易度を表示" checked={showUnofficial} disabled={!viewReady} onCheckedChange={v=>setViewField('showUnofficial',v)}/></label><label className="switch-line"><span>ノーツレーダー</span><Switch aria-label="ノーツレーダーを表示" checked={showRadar} disabled={!viewReady} onCheckedChange={v=>setViewField('showRadar',v)}/></label><label className="switch-line"><span>プレイデータ</span><Switch aria-label="プレイデータを表示" checked={showPlayData} disabled={!viewReady} onCheckedChange={v=>setViewField('showPlayData',v)}/></label><div className="play-display-options" role="group" aria-label="プレイデータの表示項目">{playDisplayFields.map(field=><label className="switch-line" key={field.key}><span>{field.label}</span><Switch aria-label={`${field.label}を表示`} checked={playDisplay[field.key]} disabled={!viewReady||!showPlayData} onCheckedChange={v=>setViewField('playDisplay',current=>({...current,[field.key]:v}))}/></label>)}</div><p>一覧と曲編集の表示に共通で適用します。設定は次回起動時も引き継ぎます。</p><div className="radar-palette">{radarAxes.map(a=><span key={a.key} style={{'--metric-color':a.color} as CSSProperties}>{a.label}</span>)}</div></section></SettingsSection>
   <SettingsSection title="アプリ更新・ホーム画面への追加" reveal={settingsOpen&&(settingsReveal==='offline'||offline.updateAvailable)}><OfflineSettings offline={offline} hasCatalog={!!catalog} storageReady={ready&&!storageError} disabled={!ready||busy} dirty={dirty} onApplyUpdate={requestAppUpdate}/></SettingsSection>
   <SettingsSection title="楽曲DBの更新" reveal={catalogUpdating||!!catalogError}><CatalogSettings catalog={catalog} onUpdate={requestCatalogUpdate} disabled={!ready||busy||!!storageError} updating={catalogUpdating} stage={catalogStage} error={catalogError}/></SettingsSection>
   <SettingsSection title="楽曲JSONの取り込み"><CatalogImportSettings catalog={catalog} disabled={!ready||busy||!!storageError} dirty={dirty} onBusy={setCatalogImportReading} onImport={importCatalog}/></SettingsSection>
   <SettingsSection title="LIFTの表示"><section><h3>LIFTの表示</h3>{(['SP','DP'] as Mode[]).map(target=><label className="switch-line" key={target}><span>{target}のLIFT数値欄</span><Switch aria-label={`${target}のLIFT数値欄を表示`} checked={app.liftVisibility?.[target]??true} disabled={!ready||busy||!!storageError} onCheckedChange={value=>{void commit(state=>({...state,liftVisibility:{SP:true,DP:true,...state.liftVisibility,[target]:value}})).catch(()=>toast.error('表示設定を保存できませんでした。'));}}/></label>)}<p>曲編集と曲リストのLIFT数値を表示・非表示にします。SPは1P・2P共通です。非表示にしても保存済みの値は残ります。</p></section></SettingsSection>
   <SettingsSection title="共通の緑数字・白数字"><CommonNumberSettings state={app} charts={charts} songs={songs} disabled={!ready||busy||dirty||!!storageError} onApply={async action=>{const next=await commit(state=>applyNumberAction(state,charts,songs,action).state);setDraft(next.notes[noteKey(selected,spSide)]??blankNote());toast.success('緑数字・白数字の設定を更新しました。');}}/></SettingsSection>
   <SettingsSection title="SPのプレイサイド"><section><h3>SPのプレイサイド</h3><Tabs value={spSide} onValueChange={changeSide}><TabsList><TabsTrigger value="1P">1P（左側）</TabsTrigger><TabsTrigger value="2P">2P（右側）</TabsTrigger></TabsList></Tabs><p>全楽曲に共通の切替です。設定内容は1P・2Pそれぞれに保存します。</p></section></SettingsSection>
   <SettingsSection title="お気に入りフォルダー"><section><h3><FolderHeart size={17}/>お気に入りフォルダー</h3>{app.folders.map((f,i)=><label className="folder-edit" key={f.id}><Folder color={f.color} size={19}/><input aria-label={`お気に入り${i+1}の名前`} maxLength={20} value={folderNames[i]??f.name} onChange={e=>setFolderNames(names=>{const n=[...names];n[i]=e.target.value;return n;})}/><span>{f.songIds.length}曲</span></label>)}<button className="secondary-button" disabled={!ready||!!storageError} onClick={async()=>{const names=app.folders.map((f,i)=>(folderNames[i]??f.name).trim());if(names.some(n=>!n)){toast.error('フォルダー名を入力してください。');return;}try{await commit(s=>({...s,folders:s.folders.map((f,i)=>({...f,name:names[i]}))}));toast.success('フォルダー名を保存しました。');}catch{toast.error('フォルダー名を保存できませんでした。');}}}>フォルダー名を保存</button></section></SettingsSection>
   <SettingsSection title="端末内の保存状態"><section><h3><ShieldCheck size={17}/>端末内の保存状態</h3><div className="storage-row"><span>通常保存</span><strong>{!ready?'確認中':storageError?'利用不可':'利用可能'}</strong></div><div className="storage-row"><span>永続保存</span><strong className={persistence==='有効'?'cyan-text':''}>{persistence}</strong></div><button className="secondary-button" onClick={()=>void requestPersistence()} disabled={persistence==='有効'||persistence==='非対応'}>永続保存を申請</button><p>許可はブラウザが判定します。ホーム画面に追加した場合は、追加後のアプリで保存状態を確認してください。</p><p>保存データは利用中のブラウザ・アプリごとに管理されます。他の端末には同期しません。</p></section></SettingsSection>
   <SettingsSection title="データ移行・バックアップ"><DataTransfer charts={charts} state={app} disabled={!ready||busy||!!storageError} dirty={dirty} onRestore={restoreBackup}/></SettingsSection>
   <SettingsSection title="使用容量"><StorageUsage active={settingsOpen} state={app} catalog={catalog} offlineState={offline.state} view={view}/></SettingsSection>
   <SettingsSection title="シリーズ別のスコア削除"><ScoreSeriesDelete history={playHistory} seriesNames={seriesNames} disabled={!ready||busy||!!storageError} onDelete={async version=>{await commit(s=>deletePlaySeries(s,version));toast.success(`${version===null?'シリーズ不明':`#${version}`}のスコアデータを削除しました。`);}}/></SettingsSection>
   <SettingsSection title="このアプリについて"><section><h3>このアプリについて</h3><dl className="catalog-facts app-info"><div><dt>作成者</dt><dd>{APP_INFO.author}</dd></div><div><dt>作成ツール</dt><dd>{APP_INFO.tool}</dd></div><div><dt>作成日</dt><dd>{APP_INFO.createdDate}</dd></div><div><dt>バージョン</dt><dd>{APP_INFO.version}</dd></div></dl><p>{catalog?.source==='iidx-info-exporter'?'取り込んだ楽曲JSONを使い、譜面別のオプションを端末に記録します。':catalog?'IIDX Data Tableの公開データを使い、譜面別のオプションを端末に記録します。掲載情報の正確性・網羅性は保証されていません。':'現在は20曲・123譜面のUI確認用サンプルです。全体設定で楽曲DBを更新すると公開データに切り替わります。'}</p><p>非公式難易度・ノーツレーダーは楽曲DBの更新時にまとめて取得し、端末内に保存します。未掲載の情報は「—」と表示します。</p></section></SettingsSection>
  </div></SheetContent></Sheet>
  <AlertDialog open={!!pendingAction} onOpenChange={v=>{if(!v&&!saveLock.current&&!transitionLock.current)setPendingAction(null);}}><AlertDialogContent className="save-confirm"><AlertDialogTitle>変更を保存してから切り替えますか？</AlertDialogTitle><AlertDialogDescription>{activeSong.title} / {selected.mode} {selected.difficulty}{mode==='SP'?` / ${spSide}`:''}に未保存の変更があります。</AlertDialogDescription><p className="transition-destination">{pendingAction?.description}</p>{saveError&&<p className="save-error" role="alert">{saveError}</p>}<AlertDialogFooter className="save-confirm-actions"><AlertDialogAction disabled={busy} onClick={e=>{e.preventDefault();void finishPending(true);}}>{saving?'保存中…':transitioning?'切替中…':'保存して切り替える'}</AlertDialogAction><button className="secondary-button discard-button" disabled={busy} onClick={()=>void finishPending(false)}>保存せず切り替える</button><AlertDialogCancel disabled={busy}>編集を続ける</AlertDialogCancel></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </div>;
}
