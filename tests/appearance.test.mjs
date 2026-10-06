import assert from 'node:assert/strict';
import test from 'node:test';
import {loadSource} from './load-source.mjs';
const {initialSeriesColors,initialSeriesOutlines,seriesTitleStyle,seriesTitleOutline,defaultSeriesColor,copySeriesAppearance,seriesOutlinesSchema}=await loadSource('../lib/appearance.ts');
const {initialLibraryView,serializeLibraryView,parseLibraryView,clearLibraryFilters}=await loadSource('../lib/iidx-view.ts');
const {initialSeriesGradients,seriesGradientsSchema,seriesTitleGradient,seriesTitleGradientStyle}=await loadSource('../lib/appearance.ts');

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

test('Old preferences retain their colors and outlines with gradients initially disabled',()=>{
 const view=initialLibraryView();view.query='keep';view.seriesColors.dark['34']='#123456';view.seriesOutlines.dark['34']={enabled:true,color:'#000000'};
 const legacy={...view};delete legacy.seriesGradients;
 assert.deepEqual(parseLibraryView(serializeLibraryView(legacy)),view);
 assert.equal(seriesTitleGradient(34,'dark',view.seriesGradients).enabled,false);
 assert.equal(seriesTitleGradientStyle(34,'dark',view.seriesColors,view.seriesGradients,true),undefined);
 view.seriesGradients.dark['34']={enabled:true,bottomColor:'#abcdef',centerOffset:-12};
 assert.deepEqual(parseLibraryView(serializeLibraryView(view)),view);
 assert.deepEqual(clearLibraryFilters(view).seriesGradients,view.seriesGradients);
});

test('A vertical gradient preserves endpoint colors, supports both offset directions, and respects theme and series toggles',()=>{
 const colors=initialSeriesColors(),gradients=initialSeriesGradients();colors.dark['34']='#123456';
 gradients.dark['34']={enabled:true,bottomColor:'#abcdef',centerOffset:0};
 for(const [offset,middle] of [[0,'50%'],[-20,'30%'],[20,'70%']]){
  gradients.dark['34'].centerOffset=offset;
  const style=seriesTitleGradientStyle(34,'dark',colors,gradients,true);
  assert.match(style.backgroundImage,/180deg/);assert.match(style.backgroundImage,/#123456 0%/);assert.match(style.backgroundImage,/#abcdef 100%/);assert(style.backgroundImage.includes(middle));
  assert.equal(style.textShadow,'none');assert.equal(style.WebkitBackgroundClip,'text');
 }
 gradients.dark['34'].centerOffset=-50;assert.equal(seriesTitleGradientStyle(34,'dark',colors,gradients,true).backgroundImage,'linear-gradient(180deg, #abcdef, #abcdef)');
 gradients.dark['34'].centerOffset=50;assert.equal(seriesTitleGradientStyle(34,'dark',colors,gradients,true).backgroundImage,'linear-gradient(180deg, #123456, #123456)');
 assert.equal(seriesTitleGradientStyle(34,'light',colors,gradients,true),undefined);
 assert.equal(seriesTitleGradientStyle(33,'dark',colors,gradients,true),undefined);
 assert.equal(seriesTitleGradientStyle(34,'dark',colors,gradients,false),undefined);
});

test('Invalid gradient colors, offsets and flags are rejected rather than silently restored',()=>{
 const entry={enabled:true,bottomColor:'#abcdef',centerOffset:0};
 for(const patch of [{bottomColor:'red'},{centerOffset:51},{centerOffset:-51},{centerOffset:1.5},{centerOffset:'10'},{enabled:'true'}]){
  assert.equal(seriesGradientsSchema.safeParse({dark:{34:{...entry,...patch}},light:{}}).success,false);
 }
});

test('Theme copies include independent gradient settings and preserve every other series',()=>{
 for(const [from,to] of [['dark','light'],['light','dark']]){
  const colors=initialSeriesColors(),outlines=initialSeriesOutlines(),gradients=initialSeriesGradients();
  gradients[from]['34']={enabled:true,bottomColor:'#abcdef',centerOffset:-15};
  gradients[to]['33']={enabled:false,bottomColor:'#123456',centerOffset:20};
  const original=JSON.stringify(gradients),copy=copySeriesAppearance(34,from,to,colors,outlines,gradients);
  assert.equal(JSON.stringify(gradients),original);assert.deepEqual(copy.seriesGradients[to]['34'],gradients[from]['34']);assert.deepEqual(copy.seriesGradients[to]['33'],gradients[to]['33']);
  copy.seriesGradients[to]['34'].centerOffset=12;assert.equal(gradients[from]['34'].centerOffset,-15);
  assert.equal(copySeriesAppearance(32,from,to,colors,outlines,gradients).seriesGradients[to]['32'].enabled,false);
 }
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
