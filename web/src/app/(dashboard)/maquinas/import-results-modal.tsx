'use client';

import { Modal } from '@/components/modal';
import { FileSpreadsheet } from 'lucide-react';

export interface ImportResult {
  machineName: string;
  itemsCount: number;
  status: 'created' | 'updated' | 'skipped' | 'error';
  message?: string;
}

interface Props {
  results: ImportResult[] | null;
  onClose: () => void;
}

export function ImportResultsModal({ results, onClose }: Props) {
  if (!results) return null;

  const created = results.filter((r) => r.status === 'created').length;
  const updated = results.filter((r) => r.status === 'updated').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const errors = results.filter((r) => r.status === 'error').length;

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="Resultado da importacao"
      description={`${created} criadas, ${updated} atualizadas, ${skipped} ignoradas, ${errors} com erro`}
    >
      <div className="space-y-2">
        {results.map((r, i) => (
          <div key={i} className="flex items-start justify-between gap-2 rounded-md border p-2 text-sm">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{r.machineName}</p>
              {r.message && <p className="text-xs text-muted-foreground">{r.message}</p>}
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
              r.status === 'created' ? 'bg-emerald-100 text-emerald-700'
                : r.status === 'updated' ? 'bg-blue-100 text-blue-700'
                : r.status === 'skipped' ? 'bg-gray-100 text-gray-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {r.status === 'created' ? `+ ${r.itemsCount} perguntas`
                : r.status === 'updated' ? `${r.itemsCount} perguntas`
                : r.status === 'skipped' ? 'ignorada'
                : 'erro'}
            </span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
