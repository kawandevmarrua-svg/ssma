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

  if (!profile || !['admin', 'manager', 'supervisor', 'encarregado'].includes(profile.role)) {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const format = searchParams.get('format') || 'csv';
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const operatorId = searchParams.get('operator_id');
  const status = searchParams.get('status');
  const limit = Math.min(parseInt(searchParams.get('limit') || '1000', 10), 5000);

  let query = supabase
    .from('behavioral_inspections')
    .select(`
      id, date, time, status, observation_type, overall_classification,
      unit_contract, area, equipment, activity_type, safe_behavior_description, created_at,
      operator:profiles!behavioral_inspections_operator_id_fkey(full_name),
      observer:profiles!behavioral_inspections_observer_id_fkey(full_name),
      behavioral_deviations(id, description, risk_level, status)
    `)
    .order('date', { ascending: false })
    .limit(limit);

  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);
  if (operatorId) query = query.eq('operator_id', operatorId);
  if (status && (status === 'open' || status === 'closed')) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type InspectionRow = {
    id: string;
    date: string;
    time: string | null;
    status: string;
    observation_type: string;
    overall_classification: string | null;
    unit_contract: string | null;
    area: string | null;
    equipment: string | null;
    activity_type: string | null;
    safe_behavior_description: string | null;
    created_at: string;
    operator: { full_name: string | null } | null;
    observer: { full_name: string | null } | null;
    behavioral_deviations: Array<{ id: string; description: string; risk_level: string; status: string }>;
  };

  const rows = (data || []) as unknown as InspectionRow[];

  const obsTypeMap: Record<string, string> = {
    routine: 'Rotina',
    critical_activity: 'Atividade critica',
    post_incident: 'Pos-incidente',
    deviation_followup: 'Acompanhamento de desvio',
    scheduled_audit: 'Auditoria programada',
  };

  const classMap: Record<string, string> = {
    safe: 'Comportamento Seguro',
    attention: 'Oportunidade de Melhoria',
    critical: 'Comportamento de Risco',
  };

  if (format === 'csv') {
    const headers = [
      'id', 'data', 'hora', 'status', 'colaborador', 'observador',
      'tipo_observacao', 'classificacao', 'unidade_contrato', 'area',
      'equipamento', 'tipo_atividade', 'total_desvios',
      'desvios_criticos', 'desvios_altos', 'desvios_medios', 'desvios_baixos',
      'desvios_abertos', 'desvios_concluidos', 'comportamento_seguro',
    ];

    const csvRows = rows.map((r) => {
      const devs = r.behavioral_deviations ?? [];
      return [
        r.id,
        r.date,
        r.time ?? '',
        r.status === 'open' ? 'Aberta' : 'Fechada',
        r.operator?.full_name ?? '',
        r.observer?.full_name ?? '',
        obsTypeMap[r.observation_type] ?? r.observation_type,
        classMap[r.overall_classification ?? ''] ?? r.overall_classification ?? '',
        r.unit_contract ?? '',
        r.area ?? '',
        r.equipment ?? '',
        r.activity_type ?? '',
        devs.length,
        devs.filter(d => d.risk_level === 'critical').length,
        devs.filter(d => d.risk_level === 'high').length,
        devs.filter(d => d.risk_level === 'medium').length,
        devs.filter(d => d.risk_level === 'low').length,
        devs.filter(d => d.status === 'open').length,
        devs.filter(d => d.status === 'completed').length,
        r.safe_behavior_description ?? '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',');
    });

    const csv = [headers.join(','), ...csvRows].join('\n');
    const dateStr = new Date().toISOString().split('T')[0];
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="inspecoes_comportamentais_${dateStr}.csv"`,
      },
    });
  }

  return NextResponse.json({
    total: rows.length,
    exported_at: new Date().toISOString(),
    data: rows,
  });
}
