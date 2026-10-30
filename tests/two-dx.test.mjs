import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSource} from './load-source.mjs';
const {twoDxScore,twoDxRadarText,twoDxLamps,twoDxBoundaries,twoDxBoundaryLeft}=await loadSource('../lib/two-dx.ts');
const {initialLibraryView,parseLibraryView,serializeLibraryView,clearLibraryFilters}=await loadSource('../lib/iidx-view.ts');
const {initialState}=await loadSource('../lib/iidx-data.ts');
const {makeBackup,parseBackup}=await loadSource('../lib/iidx-backup.ts');
const score={exScore:2765,djLevel:'AA',lamp:'HARD CLEAR'};

test('2DX scores use the exact chart and preserve missing and inconsistent records',()=>{
 const chart={noteCount:1600},model=twoDxScore(score,chart);
 assert.equal(model.rateText,'86.41%');assert.equal(model.scoreText,'2,765');assert.equal(model.grade,'AA');
 assert.equal(model.rate,2765/3200*100);
 assert.equal(twoDxScore(score,{}).rate,null);
 assert.equal(twoDxScore({...score,exScore:3201},chart).rate,null);
 const absent=twoDxScore(undefined,chart);
 assert.equal(absent.lamp,'NO PLAY');assert.equal(absent.rateText,'—');assert.equal(absent.scoreText,'—');
 const zero=twoDxScore({...score,exScore:0,djLevel:null,lamp:'NO PLAY'},chart);
 assert.equal(zero.rate,null);assert.equal(zero.scoreText,'—');
 const playedZero=twoDxScore({...score,exScore:0,djLevel:'F',lamp:'FAILED'},chart);
 assert.equal(playedZero.rate,0);assert.equal(playedZero.scoreText,'0');
 const danOnly=twoDxScore({...score,lamp:'NO PLAY'},chart);
 assert.equal(danOnly.rateText,'86.41%');assert.equal(danOnly.lamp,'NO PLAY');
});

test('Radar decimals, actual zeros, missing and out-of-range values stay distinct',()=>{
 for(const [value,text] of [[125.3,'125.30'],[88.05,'88.05'],[0,'0.00'],[200,'200.00'],[null,'—'],[undefined,'—'],[NaN,'—'],[Infinity,'—'],[-1,'—'],[201,'—']])assert.equal(twoDxRadarText(value),text);
});

test('Right-to-left DJ boundaries cover the real ninth thresholds and lamps match the approved palette',()=>{
 assert.deepEqual(twoDxBoundaries.map(([rank])=>rank),['AAA','AA','A','B','C','D','E']);
 assert(Math.abs(twoDxBoundaryLeft(8)-100/9)<1e-10);
 assert.equal(twoDxBoundaryLeft(9),0);assert.equal(twoDxBoundaryLeft(0),100);
 assert.equal(twoDxLamps['ASSIST CLEAR'].color,'#B86CFF');
 assert.equal(twoDxLamps.CLEAR.color,'#66D9FF');assert.equal(twoDxLamps.FAILED.color,'#90202D');
 assert.equal(twoDxLamps['EX HARD CLEAR'].key,'ex');assert.equal(twoDxLamps['FULLCOMBO CLEAR'].key,'fc');
});

test('Legacy views default to standard; 2DX persists through reload, filter reset and backup without modifying records',()=>{
 const old=initialLibraryView();delete old.twoDxMode;old.query='keep';
 const migrated=parseLibraryView(JSON.stringify({version:1,view:old}));
 assert.equal(migrated.twoDxMode,false);assert.equal(migrated.query,'keep');
 const view={...migrated,twoDxMode:true,radarMode:true,showRadar:true};
 assert.deepEqual(parseLibraryView(serializeLibraryView(view)),view);
 assert.equal(clearLibraryFilters(view).twoDxMode,true);
 const state=initialState(),snapshot=JSON.stringify(state),restored=parseBackup(makeBackup(state,view));
 assert.equal(restored.view.twoDxMode,true);assert.equal(restored.view.radarMode,true);
 assert.deepEqual(restored.data,state);assert.equal(JSON.stringify(state),snapshot);
});
