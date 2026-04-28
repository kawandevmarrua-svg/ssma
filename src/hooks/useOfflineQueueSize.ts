import { useEffect, useState } from 'react';
import { subscribeQueueSize, subscribeDeadLetterCount } from '../lib/offlineQueue';

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

/**
 * Quantidade de jobs que falharam apos MAX_ATTEMPTS e foram movidos
 * para a dead-letter. > 0 indica que houve perda real e operador
 * deve acionar suporte.
 */
export function useDeadLetterCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeDeadLetterCount(setCount);
    return unsubscribe;
  }, []);

  return count;
}
