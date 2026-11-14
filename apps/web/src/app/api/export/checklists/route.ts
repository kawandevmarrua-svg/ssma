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
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const result = searchParams.get('result');
  const limit = Math.min(parseInt(searchParams.get('limit') || '1000', 10), 5000);

  let query = supabase
    .from('checklists')
    .select(
      'id, machine_name, date, status, result, brand, model, tag, shift, max_load_capacity, inspector_name, inspector_registration, notes, end_notes, ended_at, had_interference, interference_notes, created_at, operator_id, profiles(full_name, email), equipment_types(name)'
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);
  if (result) query = query.eq('result', result);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data || [];

  if (format === 'csv') {
    const headers = [
      'id', 'data', 'operador', 'email', 'equipamento', 'tipo_equipamento',
      'tag', 'marca', 'modelo', 'turno', 'resultado', 'status',
      'interferencia', 'notas_interferencia', 'observacoes', 'obs_encerramento',
      'inicio', 'fim',
    ];
    const csvRows = rows.map((r: Record<string, unknown>) => {
      const p = r.profiles as { full_name?: string; email?: string } | null;
      const eq = r.equipment_types as { name?: string } | null;
      return [
        r.id,
        r.date,
        p?.full_name || '',
        p?.email || '',
        r.machine_name,
        eq?.name || '',
        r.tag || '',
        r.brand || '',
        r.model || '',
        r.shift || '',
        r.result || '',
        r.status,
        r.had_interference ? 'sim' : 'nao',
        r.interference_notes || '',
        r.notes || '',
        r.end_notes || '',
        r.created_at,
        r.ended_at || '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',');
    });

    const csv = [headers.join(','), ...csvRows].join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="checklists_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  }

  return NextResponse.json({
    total: rows.length,
    exported_at: new Date().toISOString(),
    data: rows,
  });
}
