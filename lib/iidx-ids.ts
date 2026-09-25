// Verified against the provider's IDs. These migrate the original UI sample notes.
export const legacySongIds:Record<string,string>={mei:'idt-1258',himiko:'idt-1652',fascination:'idt-1413',saber:'idt-1842',theory:'idt-2757',era:'idt-310',shakunetsu:'idt-1863',nageki:'idt-1355',almagest:'idt-1702',smooooch:'idt-1635',v:'idt-536',aa:'idt-1101',bequiet:'idt-1106',b4u:'idt-403',absolute:'idt-402',bluerain:'idt-1507',quasar:'idt-941',redzone:'idt-1138',elemental:'idt-2079',estella:'idt-505'};
export const canonicalSongId=(id:string)=>legacySongIds[id]??id;
export const canonicalChartId=(id:string)=>{const [song,...rest]=id.split(':');return [canonicalSongId(song),...rest].join(':');};
