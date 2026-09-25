import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {loadSource} from './load-source.mjs';
const {parsePlayImport,matchPlayImport,playEntriesCsv,applyPlayImport,playMatchIssue}=await loadSource('../lib/play-data.ts');
const {initialState}=await loadSource('../lib/iidx-data.ts');
const fixture=JSON.parse(readFileSync(new URL('./fixtures/play-match-catalog.json',import.meta.url),'utf8'));
const difficulties=['BEGINNER','NORMAL','HYPER','ANOTHER','LEGGENDARIA'];
const songs=fixture.songs.map(s=>({id:`idt-${s.id}`,title:s.title,artist:s.artist,series:s.version,removed:!s.in_ac,bpm:'—',soflan:false}));
const charts=fixture.songs.flatMap(s=>['SP','DP'].flatMap(mode=>s.levels[mode.toLowerCase()].flatMap((level,i)=>level?[{id:`idt-${s.id}:${mode}:${difficulties[i]}`,songId:`idt-${s.id}`,mode,difficulty:difficulties[i],level,unofficialRatings:{}}]:[])));
const score={exScore:0,pgreat:0,great:0,missCount:null,lamp:'FULLCOMBO CLEAR',djLevel:null,gameVersion:34,fetchedAt:'2026-09-20T00:00:00.000Z',importedAt:'2026-09-20T00:00:00.000Z'};
const entry=(title,difficulty,level,mode='SP')=>({title,difficulty,level,mode,score:{...score}});
const data=entries=>({entries,legacy:false,duplicates:0});

// Song/chart identities from the reported export; scores are synthetic.
const cases=[
 ['LOVE WILL・・・','NORMAL',4,'425'],['LOVE WILL・・・','HYPER',4,'425'],
 ['LOVE WILL・・・','ANOTHER',7,'425'],['X-DEN','HYPER',11,'2664'],
 ['X-DEN','ANOTHER',12,'2664'],['RINNE','ANOTHER',12,'3041'],
 ['5.1.1.','NORMAL',2,'3'],['GAMBOL','HYPER',2,'23'],
 ['I Was The One','HYPER',3,'214'],['deep in you','HYPER',4,'103'],
 ["Rise'n Beauty",'ANOTHER',10,'1046'],['thunder HOUSE NATION Remix','ANOTHER',9,'101643'],
 ['SWEET LAB','ANOTHER',10,'446'],['HYPE THE CORE','ANOTHER',11,'2573'],
 ['SCORE','ANOTHER',10,'1060'],['NEBULA GRASPER','ANOTHER',10,'1157'],
 ['Beyond The Earth','ANOTHER',11,'2245'],['VOX UP','ANOTHER',12,'4025'],
 ['Tangerine Stream','HYPER',3,'333'],['THE SHINING POLARIS','ANOTHER',8,'534'],
 ['quick master (reform version)','NORMAL',1,'3975'],
 ['CARRY ON NIGHT (English version)','NORMAL',5,'1010'],
 ['HYPER EUROBEAT (2DX style)','HYPER',8,'920'],
 ["I Was The One (80's EUROBEAT STYLE)",'ANOTHER',7,'922'],
 ['Burning Heat! (Full Option Mix)','ANOTHER',7,'708'],
 ['Blind Justice ～Torn souls, Hurt Faiths ～','ANOTHER',11,'1404'],
 ['ピアノ協奏曲第１番”蠍火”','ANOTHER',12,'1151'],
 ['ピアノ協奏曲第1番”蠍火” (BlackY Remix)','HYPER',9,'2786'],
 ['ワルツ第17番 ト短調”大犬のワルツ”','ANOTHER',12,'1766'],
 ['Ubertreffen','ANOTHER',11,'1501'],['Praludium','ANOTHER',10,'2023'],
 ["Raison d'etre～交差する宿命～",'ANOTHER',11,'1745'],
 ['旋律のドグマ～Miserables～','ANOTHER',12,'2132'],
 ['Amor De Verao','ANOTHER',11,'2506'],['Xlo','ANOTHER',12,'2635'],
 ['Geirskogul','ANOTHER',10,'2686'],['Ignis†Irae','ANOTHER',12,'2891'],
 ['Ou Legends','ANOTHER',12,'3050'],["L'amour et la liberte",'ANOTHER',10,'645'],
 ['LOVE SHINE','ANOTHER',10,'930'],['Sweet Sweet Magic','ANOTHER',10,'950'],
 ['Raspberry Heart(English version)','ANOTHER',9,'1137'],
 ['Double Loving Heart','ANOTHER',9,'1316'],['CROSSROAD ～Left Story～','ANOTHER',10,'1409'],
 ['Punch Love 仮面','ANOTHER',10,'1612'],['キャトられ恋はモ～モク','ANOTHER',12,'2080'],
 ['超!!遠距離らぶメ～ル','ANOTHER',10,'2131'],['ATHER','ANOTHER',11,'2160'],
 ['表裏一体！？怪盗いいんちょの悩み','ANOTHER',12,'2228'],
 ['ギョギョっと人魚 爆婚ブライダル','ANOTHER',10,'2370'],['火影','ANOTHER',12,'2435'],
 ['!Viva!','ANOTHER',10,'2442'],['CODE:0','ANOTHER',11,'2685'],
 ['POLKAMANIA','ANOTHER',11,'2812'],['FERMI PARADOX','ANOTHER',10,'3212'],
 ['オッドラヴィ','ANOTHER',10,'3233'],['NOMAD (feat. らっぷびと)','ANOTHER',10,'3411'],
 ['Vermillion','ANOTHER',10,'1852'],['Vermilion','ANOTHER',10,'2489'],
 ['19,November','ANOTHER',8,'601'],['SHOOTING STAR','ANOTHER',9,'1050'],
];
test('Reported chart spellings and historical duplicates resolve to the verified catalog IDs',()=>{
 const result=matchPlayImport(data(cases.map(([title,diff,level])=>entry(title,diff,level))),songs,charts);
 assert.equal(result.length,cases.length);
 result.forEach((m,i)=>assert.equal(m.target?.id,`idt-${cases[i][3]}:SP:${cases[i][1]}`,`${cases[i][0]}: ${m.reason}`));
});
test('Latin folding keeps Japanese dakuten, distinct spellings and meaningful symbols',()=>{
 const names=['ガ','カ','Vermilion','Vermillion','A-B','AB','Rave*it!!','Raveit!!'];
 const ss=names.map((title,i)=>({...songs[0],id:`s${i}`,title}));
 const cc=ss.map(s=>({...charts[0],id:`${s.id}:SP:ANOTHER`,songId:s.id,mode:'SP',difficulty:'ANOTHER',level:10}));
 const result=matchPlayImport(data([...names,'カ\u3099'].map(title=>entry(title,'ANOTHER',10))),ss,cc);
 // The composed/decomposed ガ rows conflict, proving both select the same identity.
 assert.equal(result[0].reason,'duplicate');assert.equal(result.at(-1).reason,'duplicate');
 for(let i=1;i<names.length;i++)assert.equal(result[i].target.id,cc[i].id);
 assert.equal(matchPlayImport(data([entry('Unlisted','ANOTHER',10)]),ss,cc)[0].reason,'missing');
});
test('Exact accents win over fallback; lossy normalization collisions need review',()=>{
 const ss=['Ü tune','U tune','Ú tune'].map((title,i)=>({...songs[0],id:`accent${i}`,title}));
 const cc=ss.map(s=>({...charts[0],id:`${s.id}:SP:ANOTHER`,songId:s.id,mode:'SP',difficulty:'ANOTHER',level:10}));
 assert.equal(matchPlayImport(data([entry('Ü tune','ANOTHER',10)]),ss,cc)[0].target.id,cc[0].id);
 const m=matchPlayImport(data([entry('U tune','ANOTHER',10)]),[ss[0],ss[2]],[cc[0],cc[2]])[0];
 assert.equal(m.reason,'ambiguous');assert.equal(m.target,null);
});
test('Current AC preference never routes a level mismatch into a same-level historical chart',()=>{
 // CS ANOTHER is ☆9; the current AC ANOTHER is ☆11.
 const m=matchPlayImport(data([entry('ミッドナイト堕天使','ANOTHER',9)]),songs,charts)[0];
 assert.equal(m.reason,'ambiguous');assert.equal(m.target,null);assert.equal(m.candidates.length,2);
 const manual=matchPlayImport(data([m.entry]),songs,charts,{0:'idt-1648:SP:ANOTHER'})[0];
 assert.equal(manual.target.id,'idt-1648:SP:ANOTHER');
 // Two current records with the same title, level and artist remain ambiguous.
 assert.equal(matchPlayImport(data([entry('PALETTE','ANOTHER',10)]),songs,charts)[0].reason,'ambiguous');
});
test('DP, retained charts, conflicting rows and manual exclusions remain independent',()=>{
 const dp=charts.find(c=>c.songId==='idt-23'&&c.mode==='DP'&&c.difficulty==='HYPER');
 assert.equal(matchPlayImport(data([entry('GAMBOL','HYPER',dp.level,'DP')]),songs,charts)[0].target.id,dp.id);
 const original=charts.find(c=>c.songId==='idt-3975'&&c.mode==='SP'&&c.difficulty==='NORMAL');
 const retained={...original,id:'retained:SP:NORMAL',songId:'retained',retained:true};
 const ss=[...songs,{...songs.find(s=>s.id==='idt-3975'),id:'retained',retained:true}];
 const input=data([entry('quick master (reform version)','NORMAL',1)]);
 assert.equal(matchPlayImport(input,ss,[...charts,retained])[0].target.id,original.id);
 assert.equal(matchPlayImport(input,ss,[...charts,retained],{0:''})[0].target,null);
 const conflict=data([entry('quick master (reform version)','NORMAL',1),entry('quick master(reform version)','NORMAL',1)]);
 assert.deepEqual(matchPlayImport(conflict,songs,charts).map(m=>m.reason),['duplicate','duplicate']);
});
test('Unresolved CSV round-trips escaped titles, zero-score lamps and NO PLAY scores',()=>{
 const entries=[entry('missing, "quoted"\nline','ANOTHER',12),entry('FERMI PARADOX','ANOTHER',10)];
 entries[1].score={...score,exScore:2010,pgreat:900,great:210,lamp:'NO PLAY',djLevel:'AA'};
 const parsed=parsePlayImport(playEntriesCsv(entries),undefined,score.importedAt);
 assert.deepEqual(parsed.entries,entries);
 const matches=matchPlayImport(parsed,songs,charts);
 assert.equal(matches[0].reason,'missing');assert.match(playMatchIssue(matches[0]),/DB/);
 const saved=applyPlayImport(initialState(),matches,score.importedAt).playData.records['idt-3212:SP:ANOTHER'];
 assert.equal(saved.lamp,'NO PLAY');assert.equal(saved.exScore,2010);assert.equal(saved.djLevel,'AA');
});
