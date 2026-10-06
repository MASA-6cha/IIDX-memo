import type {CSSProperties} from 'react';

/** Separate layers keep the existing outline behind an opaque gradient fill. */
export function TitleColorText({text,style,gradientStyle}:{text:string;style:CSSProperties|undefined;gradientStyle:CSSProperties|undefined}){
 if(!gradientStyle)return <>{text}</>;
 return <span className="series-gradient-text">
  {style?.textShadow&&<span className="series-gradient-outline" aria-hidden="true" style={style}>{text}</span>}
  <span className="series-gradient-fill" style={gradientStyle}>{text}</span>
 </span>;
}
