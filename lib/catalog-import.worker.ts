import {CATALOG_IMPORT_MAX_BYTES,parseCatalogImport,fetchCatalogImportText} from './catalog-import';

self.onmessage=async(event:MessageEvent<{file?:File;url?:string}>)=>{
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),90000);
 try{
  const {file,url}=event.data;let text:string,origin:{label:string;url?:string};
  if(file){
   if(file.size>CATALOG_IMPORT_MAX_BYTES)throw new Error('JSONは32MB以下のファイルを選んでください。');
   self.postMessage({type:'progress',message:'ファイルを読み込み中…'});text=await file.text();origin={label:file.name.slice(0,200)};
  }else{
   let last=0;const downloaded=await fetchCatalogImportText(url??'',controller.signal,bytes=>{if(bytes-last>=256*1024){last=bytes;self.postMessage({type:'progress',message:`取得中 ${(bytes/1024/1024).toFixed(1)} MB`});}});
   text=downloaded.text;origin={label:'GitHub JSON',url:downloaded.url};
  }
  self.postMessage({type:'progress',message:'曲・譜面データを検証中…'});
  const data=parseCatalogImport(text);self.postMessage({type:'complete',data,origin});
 }catch(error){self.postMessage({type:'error',message:controller.signal.aborted?'取得が時間内に完了しませんでした。ファイル選択も利用できます。':error instanceof Error?error.message:'JSONを読み取れませんでした。'});}
 finally{clearTimeout(timeout);}
};
