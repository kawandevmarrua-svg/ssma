'use client';

import { useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { getPageTitle } from '@/components/sidebar';
import { LogOut } from 'lucide-react';

export function Topbar({ email }: { email: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const title = getPageTitle(pathname);
  const supabase = useMemo(() => createClient(), []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card pl-14 pr-3 md:px-6">
      <span className="text-sm font-semibold text-foreground truncate">{title}</span>
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <span className="hidden sm:block text-sm text-muted-foreground truncate max-w-[200px] md:max-w-none">
          {email}
        </span>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          <LogOut className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Sair</span>
        </Button>
      </div>
    </header>
  );
}
