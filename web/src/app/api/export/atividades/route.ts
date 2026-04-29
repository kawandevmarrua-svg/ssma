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
  const operatorId = searchParams.get('operator_id');
  const limit = Math.min(parseInt(searchParams.get('limit') || '1000', 10), 5000);

  let query = supabase
    .from('activities')
    .select(
      'id, date, location, description, start_time, end_time, equipment_tag, had_interference, interference_notes, notes, transit_start, transit_end, created_at, operator_id, machine_id, activity_type_id, profiles(full_name, email), machines(name, tag), activity_types(code, description, category)'
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);
  if (operatorId) query = query.eq('operator_id', operatorId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data || [];

  if (format === 'csv') {
    const headers = [
      'id', 'data', 'operador', 'email', 'descricao', 'tipo_codigo', 'tipo_descricao',
      'tipo_categoria', 'local', 'maquina', 'tag_maquina', 'tag_equipamento',
      'hora_inicio', 'hora_fim', 'transito_saida', 'transito_chegada',
      'interferencia', 'notas_interferencia', 'observacoes', 'criado_em',
    ];
    const csvRows = rows.map((r: Record<string, unknown>) => {
      const p = r.profiles as { full_name?: string; email?: string } | null;
      const m = r.machines as { name?: string; tag?: string } | null;
      const at = r.activity_types as { code?: string; description?: string; category?: string } | null;
      return [
        r.id,
        r.date,
        p?.full_name || '',
        p?.email || '',
        r.description || '',
        at?.code || '',
        at?.description || '',
        at?.category || '',
        r.location || '',
        m?.name || '',
        m?.tag || '',
        r.equipment_tag || '',
        r.start_time || '',
        r.end_time || '',
        r.transit_start || '',
        r.transit_end || '',
        r.had_interference ? 'sim' : 'nao',
        r.interference_notes || '',
        r.notes || '',
        r.created_at,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',');
    });

    const csv = [headers.join(','), ...csvRows].join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="atividades_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  }

  return NextResponse.json({
    total: rows.length,
    exported_at: new Date().toISOString(),
    data: rows,
  });
}
