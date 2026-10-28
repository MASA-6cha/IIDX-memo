export type AppRelease={version:string;updateCount:number;updatedDate:string;changes:string[]};
export function parseAppRelease(value:unknown):AppRelease|null{
 if(!value||typeof value!=='object')return null;
 const release=value as Partial<AppRelease>;
 if(typeof release.version!=='string'||!/^\d+\.\d+\.\d+$/.test(release.version)||!Number.isSafeInteger(release.updateCount)||typeof release.updatedDate!=='string'||release.updatedDate.length>80||!Array.isArray(release.changes)||release.changes.length>30||!release.changes.every(change=>typeof change==='string'&&change.length<=1000))return null;
 return release as AppRelease;
}
