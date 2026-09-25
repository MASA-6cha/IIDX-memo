import assert from 'node:assert/strict';
import test from 'node:test';
import {loadSource} from './load-source.mjs';
const {getScoreRate,formatScoreBenchmark}=await loadSource('../lib/play-rate.ts');
const score=(exScore,djLevel='AA',lamp='HARD CLEAR')=>({exScore,djLevel,lamp});
const labels=result=>result.benchmarks.map(formatScoreBenchmark);

test('Rate and rank differences use EX score, including NO PLAY, with upward-rounded boundaries',()=>{
 const below=getScoreRate(score(1777),1000);
 assert.equal(below.percent.toFixed(2),'88.85');
 assert.deepEqual(labels(below),['AA+221','AAA-1']);
 assert.deepEqual(labels(getScoreRate(score(1778,'AAA'),1000)),['AAA+0','MAX-222']);
 assert.deepEqual(labels(getScoreRate(score(1800,'AAA','NO PLAY'),1000)),['AAA+22','MAX-200']);
 assert.equal(getScoreRate(score(1800,'AAA','NO PLAY'),1000).percent,90);
 assert.deepEqual(labels(getScoreRate(score(2000,'AAA'),1000)),['MAX']);
 assert.equal(getScoreRate(score(2000,'AAA'),1000).percent,100);
 // Divisible boundaries: one point below, exactly at and one point above AA.
 assert.deepEqual(labels(getScoreRate(score(1399,'A'),900)),['A+199','AA-1']);
 assert.deepEqual(labels(getScoreRate(score(1400,'AA'),900)),['AA+0','AAA-200']);
 assert.deepEqual(labels(getScoreRate(score(1401,'AA'),900)),['AA+1','AAA-199']);
});

test('Missing note counts, inherited lamps and invalid scores have no percentage or rank differences',()=>{
 for(const notes of [undefined,null,0,-1,1.5,NaN,Infinity,100001]){
  const result=getScoreRate(score(100),notes);assert.equal(result.percent,null);assert.deepEqual(result.benchmarks,[]);
 }
 for(const s of [undefined,score(null),score(0,null,'FULLCOMBO CLEAR'),score(0,null,'NO PLAY')]){
  const result=getScoreRate(s,1000);assert.equal(result.reason,'missing-score');assert.deepEqual(result.benchmarks,[]);
 }
 for(const ex of [-1,2001,NaN,Infinity,0.5])assert.equal(getScoreRate(score(ex),1000).reason,'invalid-score');
 // An explicitly recorded zero (DJ LEVEL F) is a real 0%, not a missing score.
 assert.equal(getScoreRate(score(0,'F','FAILED'),1000).percent,0);
 assert.deepEqual(labels(getScoreRate(score(0,'F','FAILED'),1000)),['F+0','E-445']);
});
