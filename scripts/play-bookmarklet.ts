import {showPlayImporter} from '../lib/play-importer-overlay';

(()=>{
 const version=Number(location.pathname.match(/^\/game\/2dx\/(\d+)\//)?.[1]);
 if(location.protocol!=='https:'||location.hostname!=='p.eagate.573.jp'||!version){alert('取得に使うブラウザでIIDX公式サイトの楽曲データを開いてから、このブックマークを実行してください。');return;}
 showPlayImporter(document,version);
})();
