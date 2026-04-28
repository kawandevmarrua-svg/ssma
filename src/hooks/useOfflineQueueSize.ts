import { useEffect, useState } from 'react';
import { subscribeQueueSize } from '../lib/offlineQueue';

/**
 * Retorna a quantidade atual de jobs pendentes na fila offline.
 * Atualiza automaticamente quando a fila muda.
 */
export function useOfflineQueueSize(): number {
  const [size, setSize] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeQueueSize(setSize);
    return unsubscribe;
  }, []);

  return size;
}
