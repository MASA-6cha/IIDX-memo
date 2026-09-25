'use client';
import {useCallback, useEffect, useRef, useState} from 'react';

type OfflineState = 'checking' | 'saving' | 'ready' | 'error' | 'unavailable';
type Receipt = {ready:boolean;savedAt?:string;error?:boolean};

function askWorker(worker:ServiceWorker, type:string, timeout=10000):Promise<Receipt> {
  return new Promise((resolve,reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => {channel.port1.close();reject(new Error('応答を確認できませんでした。'));},timeout);
    channel.port1.onmessage = event => {clearTimeout(timer);channel.port1.close();resolve(event.data as Receipt);};
    worker.postMessage({type},[channel.port2]);
  });
}

export function useOfflineApp() {
  const base=import.meta.env.BASE_URL;
  const [state,setState] = useState<OfflineState>('checking');
  const [online,setOnline] = useState(true);
  const [standalone,setStandalone] = useState(false);
  const [displayModeReady,setDisplayModeReady] = useState(false);
  const [savedAt,setSavedAt] = useState('');
  const [updateAvailable,setUpdateAvailable] = useState(false);
  const [checkingUpdate,setCheckingUpdate] = useState(false);
  const [message,setMessage] = useState('');
  const registration = useRef<ServiceWorkerRegistration|null>(null);
  const refreshRegistration = useRef<()=>Promise<void>>(async()=>{});
  const reloadRequested = useRef(false);
  const applyingTimer = useRef<ReturnType<typeof setTimeout>|undefined>(undefined);

  useEffect(() => {
    let alive = true;
    const cleanups:Array<()=>void> = [];
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const setConnection = () => setOnline(navigator.onLine);
    const setDisplayMode = () => setStandalone(displayMode.matches || (navigator as Navigator & {standalone?:boolean}).standalone===true);
    setConnection();setDisplayMode();setDisplayModeReady(true);
    window.addEventListener('online',setConnection);window.addEventListener('offline',setConnection);
    displayMode.addEventListener('change',setDisplayMode);
    cleanups.push(()=>{window.removeEventListener('online',setConnection);window.removeEventListener('offline',setConnection);displayMode.removeEventListener('change',setDisplayMode);});

    const readActive = async(reg:ServiceWorkerRegistration) => {
      if (!reg.active) return;
      try {
        const receipt = await askWorker(reg.active,'IIDX_OFFLINE_STATUS');
        if (!alive) return;
        setState(receipt.ready?'ready':'error');setSavedAt(receipt.savedAt??'');
        if (!receipt.ready) setMessage('アプリ本体の保存が完了していません。通信できる場所で保存し直してください。');
      } catch {
        if (alive) {setState('error');setMessage('保存状態を確認できませんでした。通信できる場所で再試行してください。');}
      }
    };
    const watch = (reg:ServiceWorkerRegistration) => {
      const worker = reg.installing;
      if (!worker) return;
      if (!reg.active) setState('saving');
      const changed = () => {
        if (!alive) return;
        if (worker.state==='installed') {
          setCheckingUpdate(false);
          if (reg.active) {setUpdateAvailable(true);setMessage('新しいアプリを保存しました。編集を終えてから更新できます。');}
        }
        if (worker.state==='activated') void readActive(reg);
        if (worker.state==='redundant') {
          setCheckingUpdate(false);
          if (!reg.active) setState('error');
          setMessage('アプリの保存に失敗しました。通信を確認して再試行してください。');
        }
      };
      worker.addEventListener('statechange',changed);
      cleanups.push(()=>worker.removeEventListener('statechange',changed));
      changed();
    };
    const register = async() => {
      try {
        // Reuse the installed worker first, so an offline launch needs no download.
        const existing = await navigator.serviceWorker.getRegistration(base);
        const reg = existing?.active ? existing : await navigator.serviceWorker.register(`${base}sw.js`,{scope:base,updateViaCache:'none'});
        if (!alive) return;
        registration.current=reg;
        setUpdateAvailable(!!reg.waiting);
        const found = () => watch(reg);
        reg.addEventListener('updatefound',found);
        cleanups.push(()=>reg.removeEventListener('updatefound',found));
        watch(reg);
        if (reg.active) void readActive(reg);
        else setState('saving');
        if (existing?.active && navigator.onLine) void reg.update().catch(()=>{});
      } catch {
        if (alive) {setState('error');setMessage('アプリ本体を保存できませんでした。通信・端末の空き容量を確認して再試行してください。');}
      }
    };
    refreshRegistration.current=register;
    if (process.env.NODE_ENV!=='production' || !window.isSecureContext || !('serviceWorker' in navigator)) {
      setState('unavailable');
      setMessage('この画面ではアプリ本体を保存できません。配布URLをSafariで開いてください。');
    } else {
      const controllerChanged = () => {
        if (reloadRequested.current) {clearTimeout(applyingTimer.current);window.location.reload();}
        else if (registration.current) void readActive(registration.current);
      };
      navigator.serviceWorker.addEventListener('controllerchange',controllerChanged);
      cleanups.push(()=>navigator.serviceWorker.removeEventListener('controllerchange',controllerChanged));
      void register();
    }
    return () => {alive=false;cleanups.forEach(cleanup=>cleanup());clearTimeout(applyingTimer.current);};
  },[]);

  const retry = useCallback(async() => {
    if (!navigator.onLine) {setMessage('通信に接続してから保存してください。');return;}
    setState('saving');setMessage('');
    const worker = registration.current?.active;
    if (!worker) {await refreshRegistration.current();return;}
    try {
      const result=await askWorker(worker,'IIDX_REPAIR_OFFLINE',100000);
      setState(result.ready?'ready':'error');setSavedAt(result.savedAt??'');
      setMessage(result.ready?'アプリ本体を端末に保存しました。':'保存できませんでした。通信・端末の空き容量を確認してください。');
    } catch {setState('error');setMessage('保存できませんでした。通信を確認して再試行してください。');}
  },[]);

  const checkUpdate = useCallback(async() => {
    if (!navigator.onLine) {setMessage('アプリの更新確認には通信が必要です。');return;}
    setCheckingUpdate(true);setMessage('');
    try {
      const reg=registration.current;
      if (!reg) {await refreshRegistration.current();setCheckingUpdate(false);return;}
      await reg.update();
      if (reg.waiting) {setUpdateAvailable(true);setMessage('新しいアプリを保存しました。');setCheckingUpdate(false);}
      else if (!reg.installing) {setMessage('現在のアプリは最新版です。');setCheckingUpdate(false);}
    } catch {setCheckingUpdate(false);setMessage('更新を確認できませんでした。保存済みのアプリは引き続き使えます。');}
  },[]);

  const applyUpdate = useCallback(() => {
    const waiting=registration.current?.waiting;
    if (!waiting) {setUpdateAvailable(false);return;}
    reloadRequested.current=true;
    waiting.postMessage({type:'IIDX_APPLY_UPDATE'});
    applyingTimer.current=setTimeout(()=>{
      reloadRequested.current=false;setMessage('更新を反映できませんでした。一度アプリを閉じて開き直してください。');
    },15000);
  },[]);

  return {state,online,standalone,displayModeReady,savedAt,updateAvailable,checkingUpdate,message,retry,checkUpdate,applyUpdate};
}

export type OfflineApp = ReturnType<typeof useOfflineApp>;
