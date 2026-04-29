'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const DashboardClient = dynamic(() => import('./DashboardClient'), {
  loading: () => (
    <div className="flex justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
  ssr: false,
});

export default function DashboardPage() {
  return <DashboardClient />;
}
