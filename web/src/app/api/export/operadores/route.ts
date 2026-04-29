import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const format = searchParams.get('format') || 'json';
  const activeOnly = searchParams.get('active') !== 'false';

  let query = supabase
    .from('profiles')
    .select('id, email, full_name, phone, role, active, created_at')
    .eq('role', 'operator')
    .order('full_name', { ascending: true });

  if (activeOnly) query = query.eq('active', true);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data || [];

  if (format === 'csv') {
    const headers = ['id', 'nome', 'email', 'telefone', 'ativo', 'criado_em'];
    const csvRows = rows.map((r: Record<string, unknown>) =>
      [r.id, r.full_name || '', r.email, r.phone || '', r.active ? 'sim' : 'nao', r.created_at]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );

    const csv = [headers.join(','), ...csvRows].join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="operadores_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  }

  return NextResponse.json({
    total: rows.length,
    exported_at: new Date().toISOString(),
    data: rows,
  });
}
