export type SwipePoint={x:number;y:number;time:number};
export type FolderSwipe={start:SwipePoint;axis:'pending'|'right'|'cancelled'};
export const startFolderSwipe=(start:SwipePoint):FolderSwipe=>({start,axis:'pending'});

export function moveFolderSwipe(swipe:FolderSwipe,point:SwipePoint){
 const dx=point.x-swipe.start.x,dy=Math.abs(point.y-swipe.start.y);
 if(swipe.axis==='pending'&&Math.max(Math.abs(dx),dy)>=12){
  swipe.axis=dx>0&&dx>dy*1.8?'right':'cancelled';
 }
 // Once a vertical/left gesture is rejected it cannot turn into navigation.
 if(swipe.axis==='right'&&(dx<0||dy>48))swipe.axis='cancelled';
 return swipe.axis;
}

export function finishFolderSwipe(swipe:FolderSwipe,point:SwipePoint){
 const dx=point.x-swipe.start.x,dy=Math.abs(point.y-swipe.start.y);
 return moveFolderSwipe(swipe,point)==='right'&&dx>=72&&dx>dy*1.8;
}
