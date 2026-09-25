import type {Chart} from '@/lib/iidx-data';

const features=['CN','HCN','BSS','MSS'] as const;
export function ChartFeatures({chart}:{chart:Chart}){
 const active=features.filter(feature=>chart.importedInfo?.features?.[feature]===true);
 if(!active.length)return null;
 return <span className="chart-features" aria-label="譜面要素">{active.map(feature=><span key={feature} className={`chart-feature feature-${feature.toLowerCase()}`} role="img" aria-label={`${feature}あり`} title={`${feature}あり`}>{feature}</span>)}</span>;
}
