import {z} from 'zod';

export const playDisplaySchema=z.object({
 clear:z.boolean().default(true),
 dj:z.boolean().default(true),
 ex:z.boolean().default(true),
 rate:z.boolean().default(true),
 difference:z.boolean().default(true),
 notes:z.boolean().default(true),
});
export type PlayDisplay=z.infer<typeof playDisplaySchema>;
export const initialPlayDisplay=():PlayDisplay=>playDisplaySchema.parse({});
export const playDisplayFields:ReadonlyArray<{key:keyof PlayDisplay;label:string}>=[
 {key:'clear',label:'クリア状況'},
 {key:'dj',label:'DJ LEVEL'},
 {key:'ex',label:'EXスコア'},
 {key:'rate',label:'スコア率'},
 {key:'difference',label:'基準点との差'},
 {key:'notes',label:'ノーツ数（曲編集）'},
];
export const hasPlaySummary=(display:PlayDisplay)=>display.clear||display.dj||display.ex||display.rate||display.difference;
