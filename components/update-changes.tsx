import {type AppRelease} from '@/lib/app-release';
export function UpdateChanges({release}:{release:AppRelease|null}){
 return <div className="update-changes">{release?<><strong>v{release.version}（更新{release.updateCount}回）</strong><p>{release.updatedDate}</p><ul>{release.changes.map((change,index)=><li key={index}>{change}</li>)}</ul></>:<p>この更新の変更内容は取得できませんでした。</p>}</div>;
}
