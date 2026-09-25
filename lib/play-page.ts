import {lamps,playImporterVersion} from './play-format';
import type {Mode,Difficulty} from './iidx-data';
export type ScrapedChart={id:string;title:string;difficulty:Difficulty;level:number;exScore:string;pgreat:string;great:string;lamp:typeof lamps[number];djLevel:string};
export type ScrapedPage={charts:ScrapedChart[];hasNext?:boolean};
const clean=(text:string)=>text.normalize('NFKC').replace(/\s/g,'').toUpperCase();
const textOf=(el:Element|undefined|null)=>el?.textContent?.trim()??'';
const imagePaths=(el:Element)=>Array.from(el.querySelectorAll('img')).flatMap(img=>['src','data-src'].map(attr=>img.getAttribute(attr)??''));
const imageLabels=(el:Element)=>Array.from(el.querySelectorAll('img')).flatMap(img=>[img.getAttribute('alt')??'',img.getAttribute('title')??'']);
type Column='title'|'difficulty'|'level'|'lamp'|'dj'|'score';
function headerKey(text:string):Column|undefined{
 const t=clean(text);
 if(['TITLE','MUSICTITLE','曲名','楽曲名','楽曲'].includes(t))return 'title';
 if(['CLEARTYPE','CLEAR','クリアタイプ','クリア状態','クリア'].includes(t))return 'lamp';
 if(['DJLEVEL','DJレベル'].includes(t))return 'dj';
 if(['SCORE','EXSCORE','スコア','EXスコア'].includes(t))return 'score';
 if(['DIFFICULTY','譜面','譜面難易度'].includes(t))return 'difficulty';
 if(['LEVEL','LV','LV.','難度','難度値'].includes(t))return 'level';
}
const rowsOf=(table:Element)=>Array.from(table.querySelectorAll('tr')).filter(row=>row.closest('table')===table);
const cellsOf=(row:Element)=>Array.from(row.children).filter(el=>el.tagName==='TH'||el.tagName==='TD');
const columnLabel=(cell:Element)=>headerKey(textOf(cell))??imageLabels(cell).map(headerKey).find(Boolean);
function columnsOf(table:Element):Partial<Record<Column,number>>|false|null{
 for(const row of rowsOf(table)){
  const cells=cellsOf(row),map:Partial<Record<Column,number>>={},seen=new Set<Column>();let duplicate=false;
  cells.forEach((cell,i)=>{const key=columnLabel(cell);if(!key)return;if(seen.has(key))duplicate=true;seen.add(key);map[key]=i;});
  if(seen.has('lamp')&&seen.has('dj')&&seen.has('score')){
   // Side-by-side rival / difficulty groups must not be mistaken for one chart.
   if(duplicate||cells.some(c=>Number(c.getAttribute('colspan')??1)>1))return false;
   return map;
  }
 }
 return null;
}
export function displayedPlayMode(doc:Document):Mode|undefined{
 const selected=doc.querySelector('select[name="style"]') as HTMLSelectElement|null;
 const value=selected?.value??doc.querySelector<HTMLInputElement>('input[name="style"]:checked, input[type="hidden"][name="style"]')?.value;
 return value==='0'?'SP':value==='1'?'DP':undefined;
}
// Deliberately exclude URLs, form values, row text, scores, names and session data.
export function describePlayPage(doc:Document){
 const shape=(el:Element)=>({tag:el.tagName,classes:Array.from(el.classList).filter(c=>/^[a-z][a-z0-9_-]{0,40}$/i.test(c)).slice(0,5)});
 return {tables:doc.querySelectorAll('table').length,legacyContainers:doc.querySelectorAll('.series-difficulty').length,errorPage:!!doc.querySelector('#error-page'),layouts:Array.from(doc.querySelectorAll('table')).slice(0,12).map(table=>{
  const rows=rowsOf(table),data=rows.find(row=>row.querySelector('td a'));
  return {...shape(table),parent:table.parentElement?shape(table.parentElement):null,rows:rows.length,headers:rows.flatMap(r=>cellsOf(r).map(columnLabel).filter(Boolean)).slice(0,20),cells:data?cellsOf(data).map(c=>({...shape(c),link:!!c.querySelector('a'),textKind:difficultyOf(c)?'difficulty':/^[\d,]+$/.test(clean(textOf(c)))?'integer':/^\d+\(\d+\/\d+\)$/.test(clean(textOf(c)))?'score-with-judgments':textOf(c)?'text':'empty',images:imagePaths(c).map(path=>path.match(/\/(clflg\d+|aaa|aa|a|b|c|d|e|f)\.(gif|png|webp|svg)(?:[?#]|$)/i)?.[1]??'other')})):[]};
 })};
}
export class PlayReadError extends Error{
 readonly diagnostic:ReturnType<typeof describePlayPage>;
 constructor(readonly code:string,message:string,doc:Document){super(`${message}［${code}］`);this.diagnostic=describePlayPage(doc);}
}
export function playDiagnostic(error:unknown,stage:string,doc:Document){
 return JSON.stringify({tool:`IIDX memo ${playImporterVersion}`,stage,code:error instanceof PlayReadError?error.code:'FETCH_FAILED',displayed:describePlayPage(doc),...(error instanceof PlayReadError?{received:error.diagnostic}:{})},null,2);
}
function lampOf(cell:Element):typeof lamps[number]|undefined{
 const codes=new Set(imagePaths(cell).map(path=>path.match(/(?:^|\/)clflg([0-7])\.(?:gif|png|webp|svg)(?:[?#]|$)/i)?.[1]).filter(v=>v!==undefined));
 if(codes.size===1)return lamps[Number([...codes][0])];if(codes.size>1)return undefined;
 const names=new Map(lamps.map(lamp=>[clean(lamp),lamp]));names.set('FULLCOMBO',lamps[7]);
 for(const value of [textOf(cell),...imageLabels(cell)]){const lamp=names.get(clean(value));if(lamp)return lamp;}
}
function djOf(cell:Element){
 for(const value of [textOf(cell),...imageLabels(cell),...imagePaths(cell).map(path=>path.match(/(?:^|\/)(aaa|aa|a|b|c|d|e|f)\.(?:gif|png|webp|svg)(?:[?#]|$)/i)?.[1]??'')]){const dj=clean(value);if(/^(AAA|AA|[A-F])$/.test(dj))return dj;}
 return '';
}
function difficultyOf(cell:Element|undefined):Difficulty|undefined{
 if(!cell)return undefined;
 for(const value of [textOf(cell),...imageLabels(cell)]){const match=value.normalize('NFKC').toUpperCase().match(/^(?:(?:SP|DP)\s*)?(BEGINNER|NORMAL|HYPER|ANOTHER|LEGGENDARIA)(?:\s*(?:☆|★|LV\.?|LEVEL)?\s*\d{1,2})?$/);if(match)return match[1] as Difficulty;}
}
function levelOf(text:string){const value=text.normalize('NFKC').match(/(?:^|\b)(?:LEVEL|LV\.?)\s*(\d{1,2})\b|[☆★]\s*(\d{1,2})\b/i);return value?Number(value[1]??value[2]):undefined;}

export function parsePlayPage(doc:Document,mode:Mode,expectedLevel?:number):ScrapedPage{
 function fail(code:string,message:string):never{throw new PlayReadError(code,message,doc);}
 const errorPage=doc.querySelector('#error-page');
 if(errorPage){
  if(errorPage.querySelector('.error_login')||/ログイン.*必要|ログインして/.test(textOf(errorPage)))fail('LOGIN_REQUIRED','取得したページはログイン案内でした。いま使っているブラウザでスコア一覧を開き直してください。');
  fail('OFFICIAL_NOTICE','公式サイトから案内・エラーページが返されました。表示中のページを確認してください。');
 }
 const actualMode=displayedPlayMode(doc);
 if(actualMode&&actualMode!==mode)fail('MODE_MISMATCH','選択したSP・DPと一覧の表示が一致しません。');
 const candidates=Array.from(doc.querySelectorAll('table')).map(table=>({table,columns:columnsOf(table)})).filter(({table,columns})=>columns!==null||table.closest('.series-difficulty')||(table.querySelector('td a')&&rowsOf(table).some(row=>cellsOf(row).some(difficultyOf))&&imagePaths(table).some(p=>/clflg\d+\./i.test(p))));
 if(!candidates.length){
  const main=doc.querySelector('#base-inner, main');
  if(main&&/(?:該当する|対象の|表示する|表示できる)(?:楽曲|譜面|データ)(?:が|は)(?:ありません|存在しません)|データが(?:みつかりません|見つかりません)/.test(textOf(main)))return {charts:[],hasNext:false};
  fail('LIST_NOT_FOUND','CLEAR TYPE・DJ LEVEL・スコアの表を認識できませんでした。契約状態だけでは原因を判断できません。');
 }
 const charts:ScrapedChart[]=[];
 for(const {table,columns} of candidates){
  if(columns===false)fail('COLUMNS_AMBIGUOUS','同じ種類のスコア列が複数あります。公式の「難易度別」一覧を開いてください。');
  const map=columns??{title:0,difficulty:1,dj:2,score:3,lamp:4};
  const tableLevel=levelOf(textOf(table.querySelector('caption')))??Array.from(table.querySelectorAll('th')).map(c=>levelOf(textOf(c))).find(v=>v!==undefined);
  for(const row of rowsOf(table)){
   const cells=cellsOf(row);if(!cells.some(c=>c.tagName==='TD'))continue;
   if(cells.filter(columnLabel).length>=3)continue;
   const titleIndex=map.title??0,titleCell=cells[titleIndex],link=titleCell?.querySelector('a');
   if(!link){if(cells.length>=4)fail('TITLE_NOT_FOUND','曲名の列を読み取れませんでした。');continue;}
   const title=textOf(link);
   const difficulty=map.difficulty!==undefined?difficultyOf(cells[map.difficulty]):cells.filter((_,i)=>![titleIndex,map.lamp,map.dj,map.score,map.level].includes(i)).map(difficultyOf).find(Boolean);
   const levelCell=map.level===undefined?null:cells[map.level];
   const level=(levelCell?(levelOf(textOf(levelCell))??(/^\d{1,2}$/.test(textOf(levelCell))?Number(textOf(levelCell)):undefined)):undefined)??tableLevel??(map.difficulty!==undefined?levelOf(textOf(cells[map.difficulty])):undefined);
   if(!title||!difficulty||!level||level>12)fail('CHART_NOT_FOUND','曲名・譜面・難度を確認できません。公式の「難易度別」一覧を開いてください。');
   if(expectedLevel!==undefined&&level!==expectedLevel)fail('LEVEL_MISMATCH','要求した難度と取得した一覧が一致しません。');
   const lampCell=cells[map.lamp!],djCell=cells[map.dj!],scoreCell=cells[map.score!];
   if(!lampCell||!djCell||!scoreCell)fail('COLUMNS_MISSING','CLEAR TYPE・DJ LEVEL・スコアの列が不足しています。');
   const lamp=lampOf(lampCell);if(!lamp)fail('CLEAR_TYPE_UNKNOWN','CLEAR TYPEの値を読み取れませんでした。');
   const scoreText=clean(textOf(scoreCell)).replace(/,/g,'').replace(/^(?:EX)?SCORE[:：]?/,'');
   const numbers=scoreText.match(/^(\d+)(?:\((\d+)\/(\d+)\))?$/),blank=/^[-—–]*$/.test(scoreText);
   if(!numbers&&!blank)fail('SCORE_UNKNOWN','スコアの値を読み取れませんでした。');
   if(numbers&&numbers[2]!==undefined&&Number(numbers[1])!==2*Number(numbers[2])+Number(numbers[3]))fail('SCORE_MISMATCH','スコアと判定数・CLEAR TYPEが一致しません。');
   const dj=djOf(djCell);if(!dj&&numbers&&Number(numbers[1])>0)fail('DJ_LEVEL_UNKNOWN','DJ LEVELの値を読み取れませんでした。');
   charts.push({id:link.getAttribute('href')??title,title,difficulty,level,exScore:numbers?.[1]??'',pgreat:numbers?.[2]??'',great:numbers?.[3]??'',lamp,djLevel:dj});
  }
 }
 // A short page is the last page in the reference endpoint (50 charts per page).
 // Do not request a nonexistent next page and turn normal completion into an error.
 const officialPager=doc.querySelector('.next-prev');
 if(officialPager)return {charts,hasNext:!!officialPager.querySelector('.navi-next a[href]')};
 const next=Array.from(doc.querySelectorAll('a,button')).some(el=>!el.hasAttribute('disabled')&&el.getAttribute('aria-disabled')!=='true'&&(/^(?:(?:次(?:のページ)?(?:へ)?|NEXT)[>›»▶]?|[>›»▶])$/i.test(clean(textOf(el)))||el.getAttribute('rel')==='next'));
 return {charts,hasNext:next||charts.length>=50};
}
