'use client';

import {useState} from 'react';
import {Smartphone} from 'lucide-react';
import {AlertDialog,AlertDialogContent,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {InstallSteps} from '@/components/offline-settings';

export function BrowserInstallNotice({displayModeReady,standalone,paused=false}:{displayModeReady:boolean;standalone:boolean;paused?:boolean}) {
  const [dismissed,setDismissed]=useState(false);
  const [guide,setGuide]=useState(false);
  return <AlertDialog open={displayModeReady&&!standalone&&!paused&&!dismissed} onOpenChange={open=>{if(!open)setDismissed(true);}}>
    <AlertDialogContent className="save-confirm browser-install-notice">
      <AlertDialogTitle><Smartphone size={22}/>{guide?'インストール手順':'ホーム画面への追加'}</AlertDialogTitle>
      <AlertDialogDescription>{guide?'iPhoneでは、次の手順でホーム画面に追加してください。':'データの保存をする場合はホーム画面に追加してください'}</AlertDialogDescription>
      {guide?<InstallSteps/>:<p className="install-notice-note">追加後は、ホーム画面の「IIDXメモ」アイコンから起動してください。</p>}
      <p className="install-notice-note">メモ・スコア・設定の保存先は、サーバーではなくこの端末内です。ほかの端末とは自動同期されません。</p>
      <p className="install-notice-note">機種変更やブラウザのデータ削除に備えて、全体設定からバックアップを残してください。</p>
      <AlertDialogFooter className="save-confirm-actions">
        {!guide&&<AlertDialogAction onClick={event=>{event.preventDefault();setGuide(true);}}>インストール手順を開く</AlertDialogAction>}
        <AlertDialogCancel>{guide?'閉じる':'了解'}</AlertDialogCancel>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
