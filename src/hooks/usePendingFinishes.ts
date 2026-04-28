import { useEffect, useState } from 'react';
import { PendingFinishState, subscribePendingFinishes } from '../lib/offlineQueue';

const EMPTY: PendingFinishState = {
  checklistIds: new Set(),
  activityIds: new Set(),
};

/**
 * Retorna os IDs de checklists/atividades cujo encerramento esta na
 * fila offline. As telas de lista usam isso para esconder/marcar esses
 * itens como ja finalizados, evitando que o operador finalize 2x.
 */
export function usePendingFinishes(): PendingFinishState {
  const [state, setState] = useState<PendingFinishState>(EMPTY);

  useEffect(() => {
    return subscribePendingFinishes(setState);
  }, []);

  return state;
}
