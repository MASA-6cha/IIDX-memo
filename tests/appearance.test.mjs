import assert from 'node:assert/strict';
import test from 'node:test';
import {loadSource} from './load-source.mjs';
const {initialSeriesColors,initialSeriesOutlines,seriesTitleStyle,seriesTitleOutline,defaultSeriesColor,copySeriesAppearance,seriesOutlinesSchema}=await loadSource('../lib/appearance.ts');
const {initialLibraryView,serializeLibraryView,parseLibraryView,clearLibraryFilters}=await loadSource('../lib/iidx-view.ts');

test('Outlines start off, old saved preferences survive, and new settings persist without changing filters',()=>{
 const view=initialLibraryView();view.query='keep';view.seriesColors.dark['12']='#abcdef';
 const legacy={...view};delete legacy.seriesOutlines;
 assert.deepEqual(parseLibraryView(serializeLibraryView(legacy)),view);
 assert.equal(seriesTitleOutline(12,'dark',view.seriesOutlines).enabled,false);
 view.seriesOutlines.dark['12']={enabled:true,color:'#123456'};
 view.seriesOutlines.light['12']={enabled:false,color:'#fedcba'};
 assert.deepEqual(parseLibraryView(serializeLibraryView(view)),view);
 assert.deepEqual(clearLibraryFilters(view).seriesOutlines,view.seriesOutlines);
 assert.equal(seriesOutlinesSchema.safeParse({dark:{12:{enabled:true,color:'red'}},light:{}}).success,false);
});

test('Only the enabled series and theme receive an outline; disabling color styling removes it too',()=>{
 const colors=initialSeriesColors(),outlines=initialSeriesOutlines();
 const plain=seriesTitleStyle(12,'dark',colors,true);
 assert.deepEqual(seriesTitleStyle(12,'dark',colors,true,outlines),plain);
 outlines.dark['12']={enabled:true,color:'#123456'};
 const styled=seriesTitleStyle(12,'dark',colors,true,outlines);
 assert.equal(styled.color,plain.color);assert.equal(styled.textShadow.split(', ').length,8);
 assert(styled.textShadow.split(', ').every(part=>part.endsWith('0 #123456')));
 assert.equal(seriesTitleStyle(12,'light',colors,true,outlines).textShadow,undefined);
 assert.equal(seriesTitleStyle(13,'dark',colors,true,outlines).textShadow,undefined);
 assert.equal(seriesTitleStyle(12,'dark',colors,false,outlines),undefined);
 outlines.dark['12'].enabled=false;
 assert.deepEqual(seriesTitleStyle(12,'dark',colors,true,outlines),plain);
 assert.equal(seriesTitleOutline(12,'dark',outlines).color,'#123456');
});

test('Copying either direction copies effective colors and outline state without mutating the source or other series',()=>{
 for(const [from,to] of [['dark','light'],['light','dark']]){
  const colors=initialSeriesColors(),outlines=initialSeriesOutlines();
  colors[from]['12']='#abcdef';colors[to]['12']='#111111';colors[to]['13']='#222222';
  outlines[from]['12']={enabled:true,color:'#123456'};
  outlines[to]['13']={enabled:false,color:'#333333'};
  const before=JSON.stringify({colors,outlines});
  const copy=copySeriesAppearance(12,from,to,colors,outlines);
  assert.equal(JSON.stringify({colors,outlines}),before);
  assert.equal(copy.seriesColors[to]['12'],'#abcdef');assert.equal(copy.seriesColors[to]['13'],'#222222');
  assert.deepEqual(copy.seriesOutlines[to]['12'],{enabled:true,color:'#123456'});
  assert.deepEqual(copy.seriesOutlines[to]['13'],outlines[to]['13']);
  copy.seriesOutlines[to]['12'].color='#ffffff';assert.equal(outlines[from]['12'].color,'#123456');
  const defaults=copySeriesAppearance(1.5,from,to,colors,outlines);
  assert.equal(defaults.seriesColors[to]['1.5'],defaultSeriesColor(1.5,from));
  assert.equal(defaults.seriesOutlines[to]['1.5'].enabled,false);
 }
});
