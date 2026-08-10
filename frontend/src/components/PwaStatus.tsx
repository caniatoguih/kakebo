import { useCallback, useEffect, useState } from 'react';
import { CloudOff, RefreshCw, X } from 'lucide-react';
import { registerSW } from 'virtual:pwa-register';
import { Button } from '@/components/ui/button';

const UPDATE_EVENT = 'kakebo:pwa-update';
const OFFLINE_KEY = 'kakebo:offline';

const updateServiceWorker = registerSW({
  immediate: true,
  onNeedRefresh: () => window.dispatchEvent(new Event(UPDATE_EVENT)),
  onRegisterError: (error) => console.error('Falha ao registrar o service worker.', error),
});

export function PwaStatus() {
  const [online, setOnline] = useState(() => navigator.onLine && sessionStorage.getItem(OFFLINE_KEY) !== 'true');
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const markOnline = useCallback(() => { sessionStorage.removeItem(OFFLINE_KEY); setOnline(true); }, []);
  const markOffline = useCallback(() => { sessionStorage.setItem(OFFLINE_KEY, 'true'); setOnline(false); }, []);
  const checkConnection = useCallback(() => fetch('/api/health', { cache: 'no-store' }).then(markOnline).catch(markOffline), [markOffline, markOnline]);

  useEffect(() => {
    const handleUpdate = () => setUpdateAvailable(true);
    window.addEventListener('online', markOnline);
    window.addEventListener('offline', markOffline);
    window.addEventListener(UPDATE_EVENT, handleUpdate);
    void checkConnection();
    return () => {
      window.removeEventListener('online', markOnline);
      window.removeEventListener('offline', markOffline);
      window.removeEventListener(UPDATE_EVENT, handleUpdate);
    };
  }, [checkConnection, markOffline, markOnline]);

  return <>
    {!online && <div role="status" className="fixed inset-x-3 top-3 z-[110] mx-auto flex max-w-xl items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-950 shadow-lg">
      <CloudOff className="h-5 w-5 shrink-0" />
      <p className="flex-1 text-sm font-medium">Você está offline. Telas já carregadas continuam visíveis, mas alterações financeiras exigem conexão.</p>
      <Button variant="outline" size="sm" onClick={() => void checkConnection()}>Verificar conexão</Button>
    </div>}
    {updateAvailable && <div role="alert" className="fixed inset-x-3 bottom-20 z-[110] mx-auto flex max-w-xl items-center gap-3 rounded-xl border bg-card p-3 shadow-xl md:bottom-4">
      <RefreshCw className="h-5 w-5 shrink-0 text-emerald-600" />
      <p className="flex-1 text-sm font-medium">Uma nova versão do Kakebo está disponível.</p>
      <Button size="sm" onClick={() => void updateServiceWorker(true)}>Atualizar agora</Button>
      <Button aria-label="Lembrar da atualização depois" variant="ghost" size="icon" onClick={() => setUpdateAvailable(false)}><X /></Button>
    </div>}
  </>;
}
