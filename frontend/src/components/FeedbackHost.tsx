import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';

type FeedbackType = 'success' | 'error' | 'info' | 'warning';
type FeedbackAction = { label: string; onClick: () => void | Promise<void> };
type FeedbackDetail = { message: string; type?: FeedbackType; action?: FeedbackAction };
type FeedbackItem = FeedbackDetail & { id: number };

let feedbackSequence = 0;

export function notify(message: string, type: FeedbackType = 'error', action?: FeedbackAction) {
  window.dispatchEvent(new CustomEvent<FeedbackDetail>('kakebo:feedback', { detail: { message, type, action } }));
}

export function FeedbackHost() {
  const [feedbackQueue, setFeedbackQueue] = useState<FeedbackItem[]>([]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<FeedbackDetail>).detail;
      setFeedbackQueue((current) => [...current, { ...detail, id: ++feedbackSequence }]);
    };
    const nativeAlert = window.alert;
    window.alert = (message) => notify(String(message), 'info');
    window.addEventListener('kakebo:feedback', handler);
    return () => {
      window.alert = nativeAlert;
      window.removeEventListener('kakebo:feedback', handler);
    };
  }, []);

  useEffect(() => {
    const first = feedbackQueue[0];
    if (!first) return;
    const timeout = window.setTimeout(() => setFeedbackQueue((current) => current.filter((item) => item.id !== first.id)), 5000);
    return () => window.clearTimeout(timeout);
  }, [feedbackQueue]);

  if (feedbackQueue.length === 0) return null;

  return (
    <div aria-live="polite" className="fixed right-4 top-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
      {feedbackQueue.map((feedback) => {
        const Icon = feedback.type === 'success' ? CheckCircle2 : feedback.type === 'info' ? Info : feedback.type === 'warning' ? TriangleAlert : AlertCircle;
        const color = feedback.type === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : feedback.type === 'info'
            ? 'border-blue-200 bg-blue-50 text-blue-800'
            : feedback.type === 'warning'
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-rose-200 bg-rose-50 text-rose-800';
        return <div key={feedback.id} role={feedback.type === 'error' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-xl border p-4 shadow-lg ${color}`}>
          <Icon className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="flex-1"><p className="text-sm font-medium">{feedback.message}</p>{feedback.action && <button type="button" className="mt-2 text-sm font-bold underline underline-offset-2" onClick={() => { setFeedbackQueue((current) => current.filter((item) => item.id !== feedback.id)); void feedback.action?.onClick(); }}>{feedback.action.label}</button>}</div>
          <button type="button" aria-label={`Fechar aviso: ${feedback.message}`} onClick={() => setFeedbackQueue((current) => current.filter((item) => item.id !== feedback.id))}>
            <X className="h-4 w-4" />
          </button>
        </div>;
      })}
    </div>
  );
}
