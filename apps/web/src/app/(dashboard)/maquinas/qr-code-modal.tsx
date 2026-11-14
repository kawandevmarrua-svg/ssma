'use client';

import { useRef } from 'react';
import { Modal } from '@/components/modal';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import type { Machine } from '@/lib/types';

interface Props {
  machine: Machine | null;
  onClose: () => void;
}

export function QRCodeModal({ machine, onClose }: Props) {
  const qrRef = useRef<HTMLDivElement | null>(null);

  if (!machine) return null;

  function downloadQrCode() {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = `qr-${machine!.qr_code || machine!.name.replace(/\s+/g, '-')}.png`;
    link.click();
  }

  return (
    <Modal open={true} onClose={onClose} title="QR Code da Maquina" description={machine.name} maxWidth="max-w-sm">
      <div className="flex flex-col items-center gap-4">
        <div ref={qrRef} className="rounded-lg bg-white p-4">
          <QRCodeCanvas value={machine.qr_code || machine.id} size={220} level="M" includeMargin={false} />
        </div>
        <div className="text-center">
          <p className="font-mono text-lg font-semibold tracking-wider">{machine.qr_code || '—'}</p>
          <p className="text-xs text-muted-foreground mt-1">Identificador unico da maquina</p>
        </div>
        <p className="text-xs text-center text-muted-foreground px-2">
          Imprima e fixe na maquina. Operadores escaneiam este codigo no app para iniciar o checklist informando que estao operando esta maquina.
        </p>
        <Button className="w-full" onClick={downloadQrCode}>
          <Download className="mr-2 h-4 w-4" />
          Baixar QR Code (PNG)
        </Button>
      </div>
    </Modal>
  );
}
