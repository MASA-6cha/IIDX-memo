const {initialLibraryView}=await loadSource('../lib/iidx-view.ts');
import assert from 'node:assert/strict';
import test from 'node:test';
import {loadSource} from './load-source.mjs';
const {initialState,blankNote}=await loadSource('../lib/iidx-data.ts');
const {makeBackup,parseBackup}=await loadSource('../lib/iidx-backup.ts');

test('A text backup preserves both SP sides, DP shared display, comments, favorites and preferences',()=>{
 const state=initialState();
 state.preferences={mode:'DP',spSide:'2P'};
 for(const [key,style] of [['mei:SP:ANOTHER:1P','RANDOM'],['mei:SP:ANOTHER:2P','MIRROR'],['mei:DP:ANOTHER','S-RANDOM']]){
  const note=blankNote();note.left.style=style;note.right.style='R-RANDOM';note.left.comment='低速前に調整\n「白↑275」🎹';note.right.comment='右手のメモ';note.updatedAt='2026-09-20T00:00:00.000Z';
  if(key.includes(':DP:')){note.display={cover:'LIFT & SUDDEN+',whiteTop:'275',whiteBottom:'30',green:'300'};note.flip=true;note.link='SYMMETRY';}
  state.notes[key]=note;
 }
 state.folders[2].name='対策メモ';state.folders[2].songIds=['mei','estella'];
 assert.deepEqual(parseBackup(makeBackup(state,initialLibraryView())).data,state);
});

test('Future catalog IDs and legacy DP display values survive migration',()=>{
 const state=initialState(),note=blankNote();
 note.left.green='300';note.right.green='310';
 state.notes['future-song:DP:LEGGENDARIA']=note;
 state.folders[0].songIds=['future-song'];
 assert.deepEqual(parseBackup(makeBackup(state,initialLibraryView())).data,state);
});

test('Incomplete, unrelated and malformed backups never produce restorable data',()=>{
 const valid=makeBackup(initialState(),initialLibraryView());
 assert.throws(()=>parseBackup(valid.slice(0,-10)));
 assert.throws(()=>parseBackup('{"notes":{}}'));
 for(const mutate of [
  b=>{b.version=3;},
  b=>{delete b.data.preferences;},
  b=>{b.data.folders[1].id='fav1';},
  b=>{b.data.notes['mei:SP:ANOTHER:1P']={...blankNote(),display:{cover:'SUDDEN+',whiteTop:'1001',whiteBottom:'0',green:'300'}};},
  b=>{b.data.notes['mei:SP:ANOTHER:2P']={...blankNote(),right:{...blankNote().right,green:'NaN'}};},
  b=>{Object.defineProperty(b.data.notes,'__proto__',{value:blankNote(),enumerable:true});},
 ]){const backup=JSON.parse(valid);mutate(backup);assert.throws(()=>parseBackup(JSON.stringify(backup)));}
 assert.deepEqual(parseBackup(valid).data,initialState());
});

const {restoreBackupData}=await loadSource('../lib/iidx-backup.ts');
const {serializeLibraryView,parseLibraryView}=await loadSource('../lib/iidx-view.ts');
const customView=()=>({
 ...initialLibraryView(),theme:'light',seriesTitleColors:false,editorSections:{score:true,radar:true,chart:false},
 seriesColors:{dark:{'1.5':'#aAbBcC','33':'#123456'},light:{'-1':'#112233','33':'#fedcba'}},
 seriesOutlines:{dark:{'33':{enabled:true,color:'#987654'}},light:{'33':{enabled:false,color:'#ABCDEF'}}},
 query:'移行テスト',filters:{series:'33',artist:'artist',levels:[10,12],availability:'removed',soflan:true,features:['CN','MSS']},
 difficulty:'LEGGENDARIA',folder:'fav3',savedOnly:true,sort:'title',sortDirection:'desc',table:'cpi',gauge:'normal',cpiGauge:'exh',
 officialFolderGrouping:'series',difficultyFolderMode:false,difficultyFolder:'series:33',folderSummary:'clear',rank:'5',
 radarRanges:Array.from({length:6},(_,i)=>({min:String(i),max:String(100+i)})),playStatus:'played',showPlayData:false,
 playDisplay:{clear:false,dj:false,ex:false,rate:false,difference:false,notes:false},scoreSource:'version:32',showRadar:false,showUnofficial:false,radarMode:true,
});

test('Every persisted appearance, filter and display setting survives export, restore and reload',async()=>{
 const original=customView(),state=initialState(),backup=parseBackup(makeBackup(state,original));
 assert.equal(backup.version,2);assert.deepEqual(backup.view,original);
 let storedView='',storedState;
 await restoreBackupData(backup,initialLibraryView(),async s=>{storedState=s;},v=>{storedView=serializeLibraryView(v);});
 assert.deepEqual(parseLibraryView(storedView),original);assert.deepEqual(storedState,state);
});

test('Legacy backups restore notes without resetting destination appearance or filters',async()=>{
 const raw=JSON.parse(makeBackup(initialState(),initialLibraryView()));raw.version=1;delete raw.view;
 const backup=parseBackup(JSON.stringify(raw));let writes=0,viewWrites=0;
 await restoreBackupData(backup,customView(),async()=>{writes++;},()=>{viewWrites++;});
 assert.equal(writes,1);assert.equal(viewWrites,0);
});

test('Malformed settings or a missing v2 settings object are rejected before restore',()=>{
 for(const mutate of [b=>{delete b.view;},b=>{b.view.theme='invalid';},b=>{b.view.seriesColors.light['33']='red';},b=>{b.view.seriesOutlines.dark['33'].enabled='true';},b=>{b.view.filters.levels=[13];},b=>{b.view.playDisplay.ex='false';}]){
  const raw=JSON.parse(makeBackup(initialState(),customView()));mutate(raw);assert.throws(()=>parseBackup(JSON.stringify(raw)));
 }
});

test('Settings storage failure prevents notes from being overwritten',async()=>{
 const backup=parseBackup(makeBackup(initialState(),customView()));let writes=0;
 await assert.rejects(()=>restoreBackupData(backup,initialLibraryView(),async()=>{writes++;},()=>{throw new Error('quota');}),/quota/);
 assert.equal(writes,0);
});

test('A failed notes transaction rolls back settings; rollback failure is reported explicitly',async()=>{
 const previous=initialLibraryView(),backup=parseBackup(makeBackup(initialState(),customView()));let stored=previous;
 await assert.rejects(()=>restoreBackupData(backup,previous,async()=>{throw new Error('database');},v=>{stored=v;}),/database/);
 assert.deepEqual(stored,previous);
 let calls=0;
 await assert.rejects(()=>restoreBackupData(backup,previous,async()=>{throw new Error('database');},()=>{if(++calls===2)throw new Error('quota');}),/表示設定を元に戻せませんでした/);
});
