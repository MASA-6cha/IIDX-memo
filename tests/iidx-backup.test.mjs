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
 assert.deepEqual(parseBackup(makeBackup(state)).data,state);
});

test('Future catalog IDs and legacy DP display values survive migration',()=>{
 const state=initialState(),note=blankNote();
 note.left.green='300';note.right.green='310';
 state.notes['future-song:DP:LEGGENDARIA']=note;
 state.folders[0].songIds=['future-song'];
 assert.deepEqual(parseBackup(makeBackup(state)).data,state);
});

test('Incomplete, unrelated and malformed backups never produce restorable data',()=>{
 const valid=makeBackup(initialState());
 assert.throws(()=>parseBackup(valid.slice(0,-10)));
 assert.throws(()=>parseBackup('{"notes":{}}'));
 for(const mutate of [
  b=>{b.version=2;},
  b=>{delete b.data.preferences;},
  b=>{b.data.folders[1].id='fav1';},
  b=>{b.data.notes['mei:SP:ANOTHER:1P']={...blankNote(),display:{cover:'SUDDEN+',whiteTop:'1001',whiteBottom:'0',green:'300'}};},
  b=>{b.data.notes['mei:SP:ANOTHER:2P']={...blankNote(),right:{...blankNote().right,green:'NaN'}};},
  b=>{Object.defineProperty(b.data.notes,'__proto__',{value:blankNote(),enumerable:true});},
 ]){const backup=JSON.parse(valid);mutate(backup);assert.throws(()=>parseBackup(JSON.stringify(backup)));}
 assert.deepEqual(parseBackup(valid).data,initialState());
});
