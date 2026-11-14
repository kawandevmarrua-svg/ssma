'use client';

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm precisa estar dentro de <ConfirmProvider>');
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setState(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback((result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setState(null);
  }, []);

  const destructive = state?.variant === 'destructive';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={!!state} onOpenChange={(o) => { if (!o) close(false); }}>
        <DialogContent showCloseButton={false} className="max-w-md">
          <DialogHeader>
            <div className="flex items-start gap-3">
              {destructive && (
                <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-destructive/10 p-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                </span>
              )}
              <div className="space-y-1.5">
                <DialogTitle>{state?.title}</DialogTitle>
                {state?.description && (
                  <DialogDescription asChild>
                    <div>{state.description}</div>
                  </DialogDescription>
                )}
              </div>
            </div>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => close(false)}>
              {state?.cancelText ?? 'Cancelar'}
            </Button>
            <Button
              autoFocus
              variant={destructive ? 'destructive' : 'default'}
              onClick={() => close(true)}
            >
              {state?.confirmText ?? 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
