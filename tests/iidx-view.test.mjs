import assert from 'node:assert/strict';
import test from 'node:test';
import {loadSource} from './load-source.mjs';
const {initialLibraryView,defaultFilters,parseLibraryView,serializeLibraryView,clearLibraryFilters,toggleDifficultyLevel,matchesDifficultyLevels}=await loadSource('../lib/iidx-view.ts');

test('Fresh views and resets use current AC songs, while reset preserves display preferences',()=>{
 const initial=initialLibraryView();assert.equal(initial.filters.availability,'available');assert.deepEqual(initial.filters.levels,[]);
 const reset=clearLibraryFilters({...initial,filters:{...initial.filters,levels:[11,12],availability:'removed'},query:'冥',difficultyFolder:'series:12',officialFolderGrouping:'series',folderSummary:'clear'});
 assert.deepEqual(reset.filters,defaultFilters());assert.equal(reset.query,'');assert.equal(reset.difficultyFolder,null);
 assert.equal(reset.officialFolderGrouping,'series');assert.equal(reset.folderSummary,'clear');
 const independent=defaultFilters();independent.levels.push(12);assert.deepEqual(defaultFilters().levels,[]);
});

test('Multiple levels are alternatives; each can be removed and empty selection includes all levels',()=>{
 let levels=toggleDifficultyLevel([],12);levels=toggleDifficultyLevel(levels,11);
 assert.deepEqual(levels,[11,12]);assert.deepEqual([9,10,11,12].filter(level=>matchesDifficultyLevels(level,levels)),[11,12]);
 levels=toggleDifficultyLevel(levels,12);assert.deepEqual(levels,[11]);assert(!matchesDifficultyLevels(12,levels));
 levels=toggleDifficultyLevel(levels,11);assert.deepEqual(levels,[]);assert([1,5,12].every(level=>matchesDifficultyLevels(level,levels)));
});

test('Legacy single selections migrate without losing explicitly saved availability or other preferences',()=>{
 for(const [level,expected] of [['all',[]],['11',[11]],['12',[12]]])for(const availability of ['all','available','removed']){
  const legacy={...initialLibraryView(),query:'keep',filters:{series:'12',artist:'Amuro',level,availability,soflan:true}};
  const migrated=parseLibraryView(JSON.stringify({version:1,view:legacy}));
  assert.deepEqual(migrated.filters.levels,expected);assert.equal(migrated.filters.availability,availability);assert.equal(migrated.query,'keep');assert.equal(migrated.filters.artist,'Amuro');
  assert(!Object.hasOwn(migrated.filters,'level'));assert.deepEqual(parseLibraryView(serializeLibraryView(migrated)),migrated);
 }
});

test('Multiple selections persist, normalize duplicate levels, and reject out-of-range data',()=>{
 const view={...initialLibraryView(),query:'persist',filters:{...defaultFilters(),levels:[3,11,12],availability:'all'}};
 assert.deepEqual(parseLibraryView(serializeLibraryView(view)),view);
 const duplicate={...view,filters:{...view.filters,levels:[12,11,12]}};
 assert.deepEqual(parseLibraryView(serializeLibraryView(duplicate)).filters.levels,[11,12]);
 for(const levels of [[0],[13],[11.5],['11']])assert.deepEqual(parseLibraryView(serializeLibraryView({...view,filters:{...view.filters,levels}})),initialLibraryView());
});

test('Feature filters persist, reset and migrate older preferences without changing other filters',()=>{
 const view=initialLibraryView();view.filters.features=['CN','BSS'];view.query='test';
 assert.deepEqual(parseLibraryView(serializeLibraryView(view)).filters.features,['CN','BSS']);
 assert.deepEqual(clearLibraryFilters(view).filters.features,[]);
 const old=JSON.parse(serializeLibraryView(view));delete old.view.filters.features;
 const migrated=parseLibraryView(JSON.stringify(old));assert.deepEqual(migrated.filters.features,[]);assert.equal(migrated.query,'test');
});

test('Each selected feature must be true; false or unknown never qualifies and disabled filters impose no restriction',async()=>{
 const {matchesChartFeatures}=await loadSource('../lib/iidx-view.ts');
 const chart={importedInfo:{features:{CN:true,HCN:false,BSS:true,MSS:null}}};
 assert(matchesChartFeatures(chart,['CN','BSS']));assert(!matchesChartFeatures(chart,['CN','HCN']));
 assert(!matchesChartFeatures(chart,['MSS']));assert(!matchesChartFeatures({},['CN']));assert(matchesChartFeatures({},[]));
 for(const key of ['CN','HCN','BSS','MSS'])assert(matchesChartFeatures({importedInfo:{features:{[key]:true}}},[key]));
});
