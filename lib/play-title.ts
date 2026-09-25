import {normalized} from './iidx-data';

// Match keys only: keep the catalog's display titles and stable song IDs unchanged.
export const playTitleKey=(title:string)=>normalized(title).replace(/\s+/g,' ');
export const playTitleFormatKey=(title:string)=>playTitleKey(title)
 .replace(/[“”„]/g,'"').replace(/[‘’]/g,"'").replace(/〜/g,'~')
 .replace(/[‐‑–—−]/g,'-').replace(/\s+/g,'');
export const playTitleLatinKey=(title:string)=>playTitleFormatKey(title)
 .normalize('NFD').replace(/(\p{Script=Latin})\p{M}+/gu,'$1').normalize('NFC')
 .replace(/æ/g,'ae').replace(/ø/g,'o');

// Official score-list spellings checked against IIDX-Data-Table/textage/title.json.
// Use explicit IDs for omitted symbols, title changes and provider typos. Do not
// strip arbitrary symbols, Japanese dakuten or interchangeable-looking letters.
export const officialPlayTitleAliases:Record<string,string[]>={
 'idt-425':['LOVE WILL・・・'],
 'idt-930':['LOVE SHINE'],
 'idt-950':['Sweet Sweet Magic'],
 'idt-1137':['Raspberry Heart(English version)'],
 'idt-1316':['Double Loving Heart'],
 'idt-1409':['CROSSROAD ～Left Story～'],
 'idt-1612':['Punch Love 仮面'],
 'idt-2080':['キャトられ恋はモ～モク'],
 'idt-2131':['超!!遠距離らぶメ～ル'],
 'idt-2160':['ATHER'],
 'idt-2228':['表裏一体！？怪盗いいんちょの悩み'],
 'idt-2370':['ギョギョっと人魚 爆婚ブライダル'],
 'idt-2435':['火影'],
 'idt-2442':['!Viva!'],
 'idt-2664':['X-DEN'],
 'idt-2685':['CODE:0'],
 'idt-2812':['POLKAMANIA'],
 'idt-3041':['RINNE'],
 'idt-3212':['FERMI PARADOX'],
 'idt-3233':['オッドラヴィ'],
 'idt-3411':['NOMAD (feat. らっぷびと)'],
};
