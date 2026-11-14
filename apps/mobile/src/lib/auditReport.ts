import * as Crypto from 'expo-crypto';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from './supabase';

export type AuditFilter = {
  operatorId: string;
  operatorName: string;
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
};

type ChecklistRow = {
  id: string;
  date: string;
  machine_name: string;
  tag: string | null;
  shift: string | null;
  status: 'pending' | 'completed';
  result: 'released' | 'not_released' | null;
  ended_at: string | null;
  inspector_name: string | null;
  created_at: string;
};

type ActivityRow = {
  id: string;
  date: string;
  description: string | null;
  location: string | null;
  equipment_tag: string | null;
  start_time: string | null;
  end_time: string | null;
  checklist_id: string | null;
  activity_type: { code: string; description: string; category: string } | null;
};

function escape(str: string | null | undefined): string {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR');
}

function formatTime(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function durationMin(start: string | null, end: string | null): string {
  if (!start || !end) return '-';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (Number.isNaN(ms) || ms < 0) return '-';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}min`;
}

async function ensureAuthorized(filter: AuditFilter): Promise<void> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    throw new Error('Sessao expirada. Faca login novamente.');
  }
  const callerId = userData.user.id;

  if (filter.operatorId === callerId) return;

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', callerId)
    .maybeSingle();
  if (profileErr) {
    throw new Error('Falha ao verificar permissao.');
  }
  const role = profile?.role;
  if (role !== 'admin' && role !== 'manager' && role !== 'supervisor' && role !== 'encarregado') {
    throw new Error('Sem permissao para gerar auditoria de outro operador.');
  }
}

async function fetchData(filter: AuditFilter) {
  await ensureAuthorized(filter);

  const [checklistsRes, activitiesRes] = await Promise.all([
    supabase
      .from('checklists')
      .select('id, date, machine_name, tag, shift, status, result, ended_at, inspector_name, created_at')
      .eq('operator_id', filter.operatorId)
      .gte('date', filter.from)
      .lte('date', filter.to)
      .order('date', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('activities')
      .select(`
        id, date, description, location, equipment_tag, start_time, end_time, checklist_id,
        activity_type:activity_types(code, description, category)
      `)
      .eq('operator_id', filter.operatorId)
      .gte('date', filter.from)
      .lte('date', filter.to)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true }),
  ]);

  if (checklistsRes.error) throw new Error(`Checklists: ${checklistsRes.error.message}`);
  if (activitiesRes.error) throw new Error(`Atividades: ${activitiesRes.error.message}`);

  const checklists = (checklistsRes.data ?? []) as ChecklistRow[];
  const rawActivities = (activitiesRes.data ?? []) as unknown as Array<
    Omit<ActivityRow, 'activity_type'> & {
      activity_type: ActivityRow['activity_type'] | ActivityRow['activity_type'][] | null;
    }
  >;

  // Supabase pode retornar array em joins; normalizamos para objeto unico.
  const activities: ActivityRow[] = rawActivities.map((a) => ({
    ...a,
    activity_type: Array.isArray(a.activity_type) ? a.activity_type[0] ?? null : a.activity_type,
  }));

  return { checklists, activities };
}

async function buildHtml(filter: AuditFilter, checklists: ChecklistRow[], activities: ActivityRow[]): Promise<string> {
  const checklistById = new Map(checklists.map((c) => [c.id, c]));

  const totalActivities = activities.length;
  const linkedActivities = activities.filter((a) => a.checklist_id && checklistById.has(a.checklist_id)).length;
  const releasedChecklists = checklists.filter((c) => c.result === 'released').length;
  const notReleasedChecklists = checklists.filter((c) => c.result === 'not_released').length;

  const checklistRows = checklists.length
    ? checklists.map((c) => {
        const resultLabel = c.result === 'released' ? 'Liberado' : c.result === 'not_released' ? 'Nao liberado' : '-';
        const resultClass = c.result === 'released' ? 'ok' : c.result === 'not_released' ? 'bad' : 'warn';
        const statusLabel = c.status === 'completed' ? 'Finalizado' : 'Em andamento';
        return `
          <tr>
            <td>${escape(formatDate(c.date))}</td>
            <td>${escape(c.machine_name)}</td>
            <td>${escape(c.tag ?? '-')}</td>
            <td>${escape(c.shift ?? '-')}</td>
            <td><span class="badge ${resultClass}">${resultLabel}</span></td>
            <td>${escape(statusLabel)}</td>
            <td>${escape(formatTime(c.ended_at))}</td>
          </tr>
        `;
      }).join('')
    : '<tr><td colspan="7" class="muted">Nenhum checklist no periodo.</td></tr>';

  const activityRows = activities.length
    ? activities.map((a) => {
        const linked = a.checklist_id ? checklistById.get(a.checklist_id) : null;
        const linkedLabel = linked
          ? `${escape(linked.machine_name)}${linked.tag ? ' (' + escape(linked.tag) + ')' : ''}`
          : a.activity_type?.category === 'parada'
          ? '<span class="muted">Parada — n/a</span>'
          : '<span class="bad">Sem checklist</span>';
        const typeLabel = a.activity_type
          ? `${escape(a.activity_type.code)} — ${escape(a.activity_type.description)}`
          : '-';
        return `
          <tr>
            <td>${escape(formatDate(a.date))}</td>
            <td>${typeLabel}</td>
            <td>${escape(a.description ?? '-')}</td>
            <td>${escape(a.location ?? '-')}</td>
            <td>${escape(formatTime(a.start_time))}</td>
            <td>${escape(formatTime(a.end_time))}</td>
            <td>${escape(durationMin(a.start_time, a.end_time))}</td>
            <td>${linkedLabel}</td>
          </tr>
        `;
      }).join('')
    : '<tr><td colspan="8" class="muted">Nenhuma atividade no periodo.</td></tr>';

  const generatedAt = new Date().toLocaleString('pt-BR');

  const integrityPayload = JSON.stringify({
    operatorId: filter.operatorId,
    operatorName: filter.operatorName,
    from: filter.from,
    to: filter.to,
    generatedAt,
    checklists: checklists.map((c) => c.id),
    activities: activities.map((a) => a.id),
  });
  const integrityHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    integrityPayload,
  );
  const integrityShort = integrityHash.slice(0, 16);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Auditoria de Atividades</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #111; padding: 24px; font-size: 11px; position: relative; }
  body::before {
    content: "CONFIDENCIAL";
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-30deg);
    font-size: 110px;
    font-weight: 800;
    color: rgba(249, 115, 22, 0.08);
    letter-spacing: 12px;
    z-index: 0;
    pointer-events: none;
  }
  h1, h2, .meta, .summary, table, .footer { position: relative; z-index: 1; }
  h1 { font-size: 18px; margin: 0 0 4px; color: #F97316; }
  h2 { font-size: 14px; margin: 24px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #F97316; }
  .meta { color: #555; font-size: 11px; margin-bottom: 16px; }
  .meta strong { color: #111; }
  .summary { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
  .summary .box { flex: 1 1 120px; border: 1px solid #ddd; border-radius: 4px; padding: 8px 12px; }
  .summary .box .lbl { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
  .summary .box .val { font-size: 18px; font-weight: 700; color: #111; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f5f5f5; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; color: #444; }
  tr:nth-child(even) td { background: #fafafa; }
  .badge { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: 700; }
  .badge.ok { background: #DCFCE7; color: #166534; }
  .badge.bad { background: #FEE2E2; color: #991B1B; }
  .badge.warn { background: #FEF3C7; color: #92400E; }
  .muted { color: #999; text-align: center; }
  .bad { color: #991B1B; font-weight: 600; }
  .footer { margin-top: 24px; font-size: 9px; color: #888; text-align: center; }
</style>
</head>
<body>

<h1>Relatorio de Auditoria de Atividades</h1>
<div class="meta">
  <div><strong>Operador:</strong> ${escape(filter.operatorName)}</div>
  <div><strong>Periodo:</strong> ${escape(formatDate(filter.from))} a ${escape(formatDate(filter.to))}</div>
  <div><strong>Gerado em:</strong> ${escape(generatedAt)}</div>
</div>

<div class="summary">
  <div class="box"><div class="lbl">Atividades</div><div class="val">${totalActivities}</div></div>
  <div class="box"><div class="lbl">Atividades c/ checklist</div><div class="val">${linkedActivities}</div></div>
  <div class="box"><div class="lbl">Checklists liberados</div><div class="val">${releasedChecklists}</div></div>
  <div class="box"><div class="lbl">Checklists nao liberados</div><div class="val">${notReleasedChecklists}</div></div>
</div>

<h2>Checklists realizados</h2>
<table>
  <thead>
    <tr>
      <th>Data</th>
      <th>Maquina</th>
      <th>TAG</th>
      <th>Turno</th>
      <th>Resultado</th>
      <th>Status</th>
      <th>Encerrado</th>
    </tr>
  </thead>
  <tbody>${checklistRows}</tbody>
</table>

<h2>Atividades executadas</h2>
<table>
  <thead>
    <tr>
      <th>Data</th>
      <th>Tipo</th>
      <th>Descricao</th>
      <th>Local</th>
      <th>Inicio</th>
      <th>Fim</th>
      <th>Duracao</th>
      <th>Checklist vinculado</th>
    </tr>
  </thead>
  <tbody>${activityRows}</tbody>
</table>

<div class="footer">
  Documento gerado pelo aplicativo Marrua para fins de auditoria interna.<br/>
  Operador: ${escape(filter.operatorId)} &middot; Hash de integridade: ${escape(integrityShort)}
</div>

</body>
</html>`;
}

export async function generateAuditReport(filter: AuditFilter): Promise<string> {
  const { checklists, activities } = await fetchData(filter);
  const html = await buildHtml(filter, checklists, activities);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  return uri;
}

export async function shareAuditReport(uri: string): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Compartilhamento nao disponivel neste dispositivo.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Relatorio de auditoria',
    UTI: 'com.adobe.pdf',
  });
}
