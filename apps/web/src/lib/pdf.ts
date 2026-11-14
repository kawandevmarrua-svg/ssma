import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ChecklistRow, ChecklistResponseRow, ActivityRow } from './types';
import { formatDate, formatDateTime, formatTime, getDuration } from './formatters';

function header(doc: jsPDF, title: string, subtitle?: string) {
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('SSMA Smart Vision', 14, 20);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(title, 14, 28);
  if (subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(subtitle, 14, 34);
    doc.setTextColor(0);
  }
  doc.setLineWidth(0.5);
  doc.line(14, subtitle ? 37 : 32, 196, subtitle ? 37 : 32);
}

function footer(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Pagina ${i} de ${pages} · Gerado em ${new Date().toLocaleString('pt-BR')}`,
      14,
      doc.internal.pageSize.height - 10
    );
    doc.setTextColor(0);
  }
}

export function exportChecklistPDF(
  checklist: ChecklistRow,
  responses: ChecklistResponseRow[]
) {
  const doc = new jsPDF();
  const operatorName = checklist.profiles?.full_name || 'Operador';
  const equipmentName = checklist.equipment_types?.name || checklist.machine_name;
  const resultLabel =
    checklist.result === 'released'
      ? 'LIBERADO'
      : checklist.result === 'not_released'
        ? 'NAO LIBERADO'
        : 'PENDENTE';

  header(doc, `Relatorio de Checklist - ${equipmentName}`, `Operador: ${operatorName} · Data: ${formatDate(checklist.date)}`);

  // Info table
  autoTable(doc, {
    startY: 42,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185] },
    head: [['Campo', 'Valor']],
    body: [
      ['Equipamento', equipmentName],
      ['Operador', operatorName],
      ['Data', formatDate(checklist.date)],
      ['Resultado', resultLabel],
      ['Inicio', formatDateTime(checklist.created_at)],
      ['Fim', checklist.ended_at ? formatDateTime(checklist.ended_at) : 'Em andamento'],
      ['TAG', checklist.tag || '—'],
      ['Marca/Modelo', [checklist.brand, checklist.model].filter(Boolean).join(' ') || '—'],
      ['Turno', checklist.shift || '—'],
      ['Interferencia', checklist.had_interference ? 'Sim' : 'Nao'],
      ...(checklist.had_interference && checklist.interference_notes
        ? [['Detalhes interferencia', checklist.interference_notes]]
        : []),
      ...(checklist.notes ? [['Observacoes', checklist.notes]] : []),
      ...(checklist.end_notes ? [['Obs. encerramento', checklist.end_notes]] : []),
    ],
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { cellWidth: 'auto' },
    },
  });

  // Responses table
  if (responses.length > 0) {
    const STATUS_MAP: Record<string, string> = { C: 'Conforme', NC: 'Nao Conforme', NA: 'N/A' };

    const sorted = [...responses].sort((a, b) => {
      const aItem = a.checklist_template_items || a.machine_checklist_items;
      const bItem = b.checklist_template_items || b.machine_checklist_items;
      return (aItem?.order_index ?? 0) - (bItem?.order_index ?? 0);
    });

    const tableBody = sorted.map((r) => {
      const item = r.checklist_template_items || r.machine_checklist_items;
      return [
        item?.section || 'Geral',
        item?.description || 'Item',
        STATUS_MAP[r.status] || r.status,
        item?.is_blocking ? 'Sim' : 'Nao',
        r.response_value || '—',
        r.notes || '—',
      ];
    });

    autoTable(doc, {
      startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10,
      theme: 'striped',
      headStyles: { fillColor: [41, 128, 185] },
      head: [['Secao', 'Item', 'Status', 'Impeditivo', 'Resposta', 'Observacao']],
      body: tableBody,
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 50 },
        2: { cellWidth: 25 },
        3: { cellWidth: 20 },
        4: { cellWidth: 30 },
        5: { cellWidth: 'auto' },
      },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 2) {
          if (data.cell.raw === 'Nao Conforme') {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          } else if (data.cell.raw === 'Conforme') {
            data.cell.styles.textColor = [22, 163, 74];
          }
        }
      },
    });
  }

  footer(doc);

  const fileName = `checklist_${equipmentName.replace(/\s+/g, '_')}_${checklist.date}.pdf`;
  doc.save(fileName);
}

export function exportActivityPDF(activity: ActivityRow) {
  const doc = new jsPDF();
  const operatorName = activity.profiles?.full_name || 'Operador';
  const description = activity.description || 'Atividade';
  const status = activity.end_time ? 'CONCLUIDA' : 'EM ANDAMENTO';

  header(doc, `Relatorio de Atividade`, `Operador: ${operatorName} · Data: ${formatDate(activity.date)}`);

  const body: string[][] = [
    ['Descricao', description],
    ['Operador', operatorName],
    ['Data', formatDate(activity.date)],
    ['Status', status],
    ['Hora inicio', formatTime(activity.start_time)],
    ['Hora fim', formatTime(activity.end_time)],
    ['Duracao', getDuration(activity.start_time, activity.end_time) || '—'],
    ['Local', activity.location || '—'],
    ['TAG Equipamento', activity.equipment_tag || '—'],
  ];

  if (activity.machines?.name) {
    body.push(['Maquina', `${activity.machines.name}${activity.machines.tag ? ` (${activity.machines.tag})` : ''}`]);
  }

  if (activity.activity_types) {
    body.push(['Tipo', `${activity.activity_types.code} — ${activity.activity_types.description}`]);
  }

  if (activity.transit_start || activity.transit_end) {
    body.push(['Transito saida', formatTime(activity.transit_start)]);
    body.push(['Transito chegada', formatTime(activity.transit_end)]);
    if (activity.transit_start && activity.transit_end) {
      body.push(['Duracao transito', getDuration(activity.transit_start, activity.transit_end) || '—']);
    }
  }

  body.push(['Interferencia', activity.had_interference ? 'Sim' : 'Nao']);
  if (activity.had_interference && activity.interference_notes) {
    body.push(['Detalhes interferencia', activity.interference_notes]);
  }
  if (activity.notes) {
    body.push(['Observacoes', activity.notes]);
  }

  autoTable(doc, {
    startY: 42,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185] },
    head: [['Campo', 'Valor']],
    body,
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { cellWidth: 'auto' },
    },
  });

  footer(doc);

  const fileName = `atividade_${operatorName.replace(/\s+/g, '_')}_${activity.date}.pdf`;
  doc.save(fileName);
}

export function exportChecklistListPDF(
  checklists: ChecklistRow[]
) {
  const doc = new jsPDF('landscape');
  header(doc, `Relatorio de Checklists`, `Total: ${checklists.length} registros`);

  const RESULT_MAP: Record<string, string> = { released: 'Liberado', not_released: 'Nao Liberado' };

  autoTable(doc, {
    startY: 42,
    theme: 'striped',
    headStyles: { fillColor: [41, 128, 185] },
    head: [['Data', 'Operador', 'Equipamento', 'TAG', 'Resultado', 'Interferencia', 'Inicio', 'Fim']],
    body: checklists.map((c) => [
      formatDate(c.date),
      c.profiles?.full_name || '—',
      c.equipment_types?.name || c.machine_name,
      c.tag || '—',
      RESULT_MAP[c.result || ''] || c.status,
      c.had_interference ? 'Sim' : 'Nao',
      formatDateTime(c.created_at),
      c.ended_at ? formatDateTime(c.ended_at) : '—',
    ]),
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 4) {
        if (data.cell.raw === 'Nao Liberado') {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        } else if (data.cell.raw === 'Liberado') {
          data.cell.styles.textColor = [22, 163, 74];
        }
      }
    },
  });

  footer(doc);
  doc.save(`checklists_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportActivityListPDF(activities: ActivityRow[]) {
  const doc = new jsPDF('landscape');
  header(doc, `Relatorio de Atividades`, `Total: ${activities.length} registros`);

  autoTable(doc, {
    startY: 42,
    theme: 'striped',
    headStyles: { fillColor: [41, 128, 185] },
    head: [['Data', 'Operador', 'Descricao', 'Tipo', 'Local', 'Inicio', 'Fim', 'Duracao', 'Interferencia']],
    body: activities.map((a) => [
      formatDate(a.date),
      a.profiles?.full_name || '—',
      a.description || '—',
      a.activity_types?.code || '—',
      a.location || '—',
      formatTime(a.start_time),
      formatTime(a.end_time),
      getDuration(a.start_time, a.end_time) || '—',
      a.had_interference ? 'Sim' : 'Nao',
    ]),
  });

  footer(doc);
  doc.save(`atividades_${new Date().toISOString().split('T')[0]}.pdf`);
}
