'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const MapaClient = dynamic(() => import('./MapaClient'), {
  loading: () => (
    <div className="flex justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
  ssr: false,
});

export default function MapaPage() {
  return <MapaClient />;
}
