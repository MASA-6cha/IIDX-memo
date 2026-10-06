type UpdateRegistration={active:unknown;installing:unknown;waiting:unknown;update:()=>Promise<unknown>};

/** Resume and periodic checks share a cooldown and never interrupt an existing install. */
export function createAppUpdateChecker({getRegistration,canCheck,now=Date.now,cooldown=60000}:{getRegistration:()=>UpdateRegistration|null;canCheck:()=>boolean;now?:()=>number;cooldown?:number}){
 let checking=false,lastAttempt=-Infinity;
 return async()=>{
  const reg=getRegistration();
  if(!canCheck()||!reg?.active||reg.installing||reg.waiting||checking||now()-lastAttempt<cooldown)return;
  checking=true;lastAttempt=now();
  try{await reg.update();}catch{/* Offline or failed downloads keep the current app available. */}
  finally{checking=false;}
 };
}
