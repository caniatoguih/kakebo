import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext { requestId: string; usuarioId?: string }

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext(context: RequestContext, callback: () => void): void {
  storage.run(context, callback);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function setContextUser(usuarioId: string): void {
  const context = storage.getStore();
  if (context) context.usuarioId = usuarioId;
}
