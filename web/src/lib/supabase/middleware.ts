import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// FIX M-7: Roles com acesso ao dashboard.
const DASHBOARD_ROLES = new Set(['admin', 'manager', 'supervisor', 'encarregado']);

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname       = request.nextUrl.pathname;
  const isAuthRoute    = pathname.startsWith('/login');
  const isLandingRoute = pathname === '/';
  const isPublicRoute  = isAuthRoute || isLandingRoute;

  // Unauthenticated: bloqueia rotas privadas
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user) {
    // FIX M-7: Verificar role do usuário uma vez, usar para ambas as decisões.
    // Uma única query cobre: (a) redirecionar autenticados de /login → /dashboard
    // e (b) bloquear roles sem acesso de rotas privadas.
    //
    // NÃO chamar supabase.auth.signOut() aqui: o middleware retorna um redirect
    // diferente de supabaseResponse, e os cookies de signOut não seriam propagados
    // → sessão ficaria ativa + loop infinito entre /login e /dashboard para operadores.
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const hasDashboardAccess = !!profile && DASHBOARD_ROLES.has(profile.role);

    if (isPublicRoute) {
      // Só redireciona para o dashboard quem realmente tem acesso.
      // Operadores autenticados ficam em /login sem loop.
      if (hasDashboardAccess) {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
      }
      return supabaseResponse;
    }

    // Rota privada: bloqueia quem não tem acesso ao dashboard.
    // O layout.tsx fará o signOut() correto do lado do cliente.
    if (!hasDashboardAccess) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    supabaseResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    supabaseResponse.headers.set('Pragma', 'no-cache');
  }

  return supabaseResponse;
}
