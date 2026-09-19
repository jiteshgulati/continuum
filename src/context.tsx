import { createContext, useContext, useState } from 'react';
import type { Bootstrap } from './api';
export interface AppContextValue {
  data: Bootstrap;
  refresh: () => Promise<void>;
  toast: (text: string) => void;
}
export const AppContext = createContext<AppContextValue>(null!);
export const useApp = () => useContext(AppContext);
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ctx = useContext(AppContext);
  async function run<T>(fn: () => Promise<T>, success?: string): Promise<T | undefined> {
    setBusy(true);
    setError('');
    try {
      const result = await fn();
      if (ctx) await ctx.refresh();
      if (success && ctx) ctx.toast(success);
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, setError, run };
}
