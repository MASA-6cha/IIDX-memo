import {readFileSync} from 'node:fs';
import ts from 'typescript';

const urls=new Map();
export function sourceUrl(path){
 const file=new URL(path,import.meta.url);if(urls.has(file.href))return urls.get(file.href);
 let source=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 source=source.replace(/from (['"])([^'"]+)\1/g,(_match,_quote,specifier)=>{
  const target=specifier.startsWith('.')?sourceUrl(new URL(`${specifier}.ts`,file).href):import.meta.resolve(specifier);
  return `from ${JSON.stringify(target)}`;
 });
 const url=`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;urls.set(file.href,url);return url;
}
export const loadSource=path=>import(sourceUrl(path));
