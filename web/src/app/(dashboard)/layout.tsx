import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';

const ALLOWED_ROLES = new Set(['admin', 'manager', 'encarregado']);

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !ALLOWED_ROLES.has(profile.role)) {
    await supabase.auth.signOut();
    redirect('/login');
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar email={user.email ?? null} />
        <main className="flex-1 overflow-y-auto bg-muted/30 p-3 sm:p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
