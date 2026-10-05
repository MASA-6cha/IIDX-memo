export function selectPlayText(field:HTMLTextAreaElement){
 const details=field.closest('details');if(details)details.open=true;
 field.focus();field.select();field.setSelectionRange(0,field.value.length);
}

// Clipboard access can be unavailable or denied on the official page.
// Keep the visible result selected when neither automatic method succeeds.
export async function copyPlayText(field:HTMLTextAreaElement):Promise<boolean>{
 if(!field.value)return false;
 try{
  const clipboard=field.ownerDocument.defaultView?.navigator.clipboard;
  if(clipboard){await clipboard.writeText(field.value);return true;}
 }catch{}
 selectPlayText(field);
 try{return field.ownerDocument.execCommand('copy');}catch{return false;}
}
