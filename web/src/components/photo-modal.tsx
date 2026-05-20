'use client';

import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface PhotoModalProps {
  src: string | null;
  alt?: string;
  onClose: () => void;
}

export function PhotoModal({ src, alt = 'Foto', onClose }: PhotoModalProps) {
  return (
    <Dialog open={!!src} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        className="w-auto max-w-3xl border-0 bg-transparent p-0 shadow-none"
      >
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <Button
          variant="outline"
          size="icon"
          onClick={onClose}
          className="absolute -right-3 -top-3 z-10 h-8 w-8 rounded-full bg-white shadow-md hover:bg-gray-100"
        >
          <X className="h-5 w-5" />
        </Button>
        {src && (
          <img src={src} alt={alt} className="max-h-[85vh] rounded-lg object-contain" />
        )}
      </DialogContent>
    </Dialog>
  );
}
