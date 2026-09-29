import assert from 'node:assert/strict';
import test from 'node:test';
import {loadSource} from './load-source.mjs';
const {blankNote,commonComment,initialState}=await loadSource('../lib/iidx-data.ts');
const {initialLibraryView}=await loadSource('../lib/iidx-view.ts');
const {makeBackup,parseBackup}=await loadSource('../lib/iidx-backup.ts');

test('DP legacy comments keep both sides, deduplicate identical text and handle a single side',()=>{
 const note=blankNote();assert.equal(commonComment(note),'');
 note.left.comment='低速前\n調整';assert.equal(commonComment(note),'低速前\n調整');
 note.right.comment=note.left.comment;assert.equal(commonComment(note),note.left.comment);
 note.right.comment='右手配置';assert.equal(commonComment(note),'[1P]\n低速前\n調整\n\n[2P]\n右手配置');
 note.left.comment='';assert.equal(commonComment(note),'右手配置');
});
test('Edited and explicitly cleared shared comments override legacy text and survive backups',()=>{
 const state=initialState(),note=blankNote();note.left.comment='left';note.right.comment='right';
 for(const text of ['共通\nコメント','']){
  note.sharedComment=text;state.notes['mei:DP:ANOTHER']=note;
  const restored=parseBackup(makeBackup(state,initialLibraryView())).data.notes['mei:DP:ANOTHER'];
  assert.equal(commonComment(restored),text);assert.equal(restored.left.comment,'left');assert.equal(restored.right.comment,'right');
 }
});
test('Combining two maximum-length legacy comments loses no text during backup and restore',()=>{
 const state=initialState(),note=blankNote();note.left.comment='左'.repeat(2000);note.right.comment='右'.repeat(2000);
 note.sharedComment=commonComment(note);state.notes['mei:DP:ANOTHER']=note;
 const restored=parseBackup(makeBackup(state,initialLibraryView())).data.notes['mei:DP:ANOTHER'];
 assert.equal(commonComment(restored),note.sharedComment);assert(commonComment(restored).includes(note.left.comment));assert(commonComment(restored).includes(note.right.comment));
});
