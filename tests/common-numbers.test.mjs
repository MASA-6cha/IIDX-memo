import assert from 'node:assert/strict';import test from 'node:test';import {loadSource} from './load-source.mjs';
const {blankNote,initialState}=await loadSource('../lib/iidx-data.ts');
const {applyNumberAction,chartCommonNumbers,effectiveNumberNote}=await loadSource('../lib/common-numbers.ts');
const {makeBackup,parseBackup}=await loadSource('../lib/iidx-backup.ts');
const songs=[{id:'plain',soflan:false},{id:'variable',soflan:true}];
const charts=[{id:'plain:SP:ANOTHER',songId:'plain',mode:'SP'},{id:'variable:SP:ANOTHER',songId:'variable',mode:'SP'},{id:'plain:DP:ANOTHER',songId:'plain',mode:'DP'}];
const numbers={green:'300',whiteTop:'200',whiteBottom:'0'};
function fixture(){const state=initialState();state.commonNumbers={'SP:1P':{...numbers},'SP:2P':{...numbers,green:'310'},DP:{...numbers,green:'320'}};for(const key of ['plain:SP:ANOTHER:1P','plain:SP:ANOTHER:2P','variable:SP:ANOTHER:1P','plain:DP:ANOTHER']){const n=blankNote();n.left.green='295';n.left.whiteTop='190';n.left.style='MIRROR';n.left.comment='keep';n.right.green='305';if(key.includes(':DP:'))n.display={cover:'LIFT',green:'315',whiteTop:'150',whiteBottom:'10'};state.notes[key]=n;}return state;}
test('Common values are separated by SP side and DP, inherited only for blank numeric fields and never applied to soflan',()=>{
 const state=fixture();assert.equal(chartCommonNumbers(state,charts[0],songs[0],'1P').green,'300');assert.equal(chartCommonNumbers(state,charts[0],songs[0],'2P').green,'310');assert.equal(chartCommonNumbers(state,charts[2],songs[0],'1P').green,'320');assert.equal(chartCommonNumbers(state,charts[1],songs[1],'1P'),undefined);
 const base=blankNote();base.left.green='299';base.left.whiteBottom='0';const result=effectiveNumberNote(base,numbers,'SP','1P');assert.equal(result.left.green,'299');assert.equal(result.left.whiteTop,'200');assert.equal(result.left.whiteBottom,'0');assert.equal(base.left.whiteTop,'');assert.equal(effectiveNumberNote(undefined,numbers,'DP','1P').display.green,'300');
});
test('Saving can preserve existing individual settings or explicitly align only eligible profile notes',()=>{
 const state=fixture(),before=JSON.stringify(state);
 const kept=applyNumberAction(state,charts,songs,{type:'save',profile:'SP:1P',values:numbers,alignExisting:false});assert.equal(kept.changedNotes,0);
 const aligned=applyNumberAction(state,charts,songs,{type:'save',profile:'SP:1P',values:numbers,alignExisting:true});const note=aligned.state.notes['plain:SP:ANOTHER:1P'];assert.equal(note.left.green,'');assert.equal(note.left.comment,'keep');assert.equal(note.left.style,'MIRROR');assert.equal(aligned.state.notes['variable:SP:ANOTHER:1P'].left.green,'295');assert.equal(aligned.state.notes['plain:SP:ANOTHER:2P'].right.green,'305');assert.equal(aligned.state.commonNumbers.DP.green,'320');assert.equal(JSON.stringify(state),before);
});
test('Bulk offsets adjust base and explicit numbers once, retain differences, and exclude soflan and other modes',()=>{
 const state=fixture();state.notes['plain:SP:ANOTHER:1P'].left.whiteBottom='';const next=applyNumberAction(state,charts,songs,{type:'shift',profile:'SP:1P',field:'green',delta:1}).state;
 assert.equal(next.commonNumbers['SP:1P'].green,'301');assert.equal(next.notes['plain:SP:ANOTHER:1P'].left.green,'296');assert.equal(next.notes['variable:SP:ANOTHER:1P'].left.green,'295');assert.equal(next.commonNumbers.DP.green,'320');assert.equal(next.notes['plain:SP:ANOTHER:2P'].right.green,'305');
 const dp=applyNumberAction(next,charts,songs,{type:'shift',profile:'DP',field:'whiteBottom',delta:2}).state;assert.equal(dp.commonNumbers.DP.whiteBottom,'2');assert.equal(dp.notes['plain:DP:ANOTHER'].display.whiteBottom,'12');assert.equal(dp.notes['plain:DP:ANOTHER'].left.comment,'keep');
});
test('Any out-of-range offset is atomic; legacy DP conflicts are skipped; common values survive backup',()=>{
 const state=fixture();state.notes['plain:SP:ANOTHER:1P'].left.green='9999';const before=JSON.stringify(state);assert.throws(()=>applyNumberAction(state,charts,songs,{type:'shift',profile:'SP:1P',field:'green',delta:1}));assert.equal(JSON.stringify(state),before);
 delete state.notes['plain:DP:ANOTHER'].display;const result=applyNumberAction(state,charts,songs,{type:'shift',profile:'DP',field:'green',delta:1});assert.equal(result.excludedNotes,1);assert.equal(result.changedNotes,0);
 assert.deepEqual(parseBackup(makeBackup(state)).data.commonNumbers,state.commonNumbers);
});
