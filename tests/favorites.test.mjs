import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSource} from './load-source.mjs';
const {toggleFavoriteEntry,isFavorite,addFavoriteFolder}=await loadSource('../lib/favorites.ts');
const {initialState}=await loadSource('../lib/iidx-data.ts');
const {makeBackup,parseBackup}=await loadSource('../lib/iidx-backup.ts');
const {initialLibraryView}=await loadSource('../lib/iidx-view.ts');
const chart={id:'mei:SP:ANOTHER',songId:'mei'};
test('legacy song favorites cover every chart, separate entries do not change them',()=>{
 const legacy={id:'fav1',name:'好きな曲',color:'#aabbcc',songIds:['mei']};
 assert.ok(isFavorite(legacy,chart));
 const both=toggleFavoriteEntry(legacy,'chart',chart.id);
 assert.deepEqual(both.songIds,['mei']);
 assert.deepEqual(toggleFavoriteEntry(both,'chart',chart.id),{...legacy,chartIds:[]});
 const chartOnly=toggleFavoriteEntry({...legacy,songIds:[]},'chart',chart.id);
 assert.ok(isFavorite(chartOnly,chart));
 assert.equal(isFavorite(chartOnly,{...chart,id:'mei:SP:HYPER'}),false);
 assert.equal(isFavorite(chartOnly,{...chart,id:'mei:DP:ANOTHER'}),false);
});
test('old backups and new folders and chart entries round trip',()=>{
 const old=initialState();old.folders[0].songIds=['mei'];
 assert.deepEqual(parseBackup(makeBackup(old,initialLibraryView())).data,old);
 const next={...old,folders:addFavoriteFolder(old.folders,'練習譜面','fav_custom')};
 next.folders[5]=toggleFavoriteEntry(next.folders[5],'chart',chart.id);
 assert.deepEqual(parseBackup(makeBackup(next,initialLibraryView())).data,next);
 assert.throws(()=>addFavoriteFolder(next.folders,' ','fav_empty'));
 assert.throws(()=>addFavoriteFolder(next.folders,'重複','fav1'));
});
