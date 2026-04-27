'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  const isDev = process.env.NODE_ENV !== 'production';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h2 className="text-xl font-semibold">Algo deu errado</h2>
      <p className="text-sm text-muted-foreground max-w-xl">
        {error.message || 'Erro inesperado. Tente novamente.'}
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground">ID: {error.digest}</p>
      )}
      {isDev && error.stack && (
        <pre className="max-w-3xl overflow-auto rounded-md border bg-muted p-3 text-left text-xs">
          {error.stack}
        </pre>
      )}
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  );
}
