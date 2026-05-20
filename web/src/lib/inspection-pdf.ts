import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InspectionPdfData {
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
  operator_name: string | null;
  observer_name: string | null;
}

export interface InspectionItem {
  category: string;
  description: string;
  status: string;
}

export interface InspectionDeviation {
  description: string;
  risk_level: string;
  immediate_action: string | null;
  immediate_action_description: string | null;
  corrective_action: string | null;
  responsible: string | null;
  deadline: string | null;
  status: string;
}

// ─── Maps ─────────────────────────────────────────────────────────────────────

const OBS_TYPE: Record<string, string> = {
  routine: 'Rotina',
  critical_activity: 'Atividade Crítica',
  post_incident: 'Pós-incidente',
  deviation_followup: 'Acompanhamento de Desvio',
  scheduled_audit: 'Auditoria Programada',
};

const CLASS_LABEL: Record<string, string> = {
  safe: 'Comportamento Seguro',
  attention: 'Oportunidade de Melhoria',
  critical: 'Comportamento de Risco',
};

const CATEGORY_LABEL: Record<string, string> = {
  risk_perception: '3.1 Percepção de Risco',
  attitude: '3.2 Postura e Atitude',
  ppe: '3.3 Uso de EPI',
  operation: '3.4 Operação / Execução da Tarefa',
  communication: '3.5 Comunicação e Interação',
  environment: '3.6 Condições do Ambiente',
};

const RISK_LABEL: Record<string, string> = {
  low: 'Baixo',
  medium: 'Médio',
  high: 'Alto',
  critical: 'Crítico',
};

const DEV_STATUS_LABEL: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  completed: 'Concluído',
};

const IMMED_ACTION_LABEL: Record<string, string> = {
  verbal_guidance: 'Orientação verbal',
  activity_intervention: 'Intervenção na atividade',
  activity_stoppage: 'Paralisação da atividade',
  immediate_correction: 'Correção imediata',
};

const ITEM_STATUS_LABEL: Record<string, string> = {
  sim: 'Sim',
  nao: 'Não',
  na: 'N/A',
};

// ─── Colors ───────────────────────────────────────────────────────────────────

type RGB = [number, number, number];

const COLOR: Record<string, RGB> = {
  header:    [30, 64, 175],   // blue-800
  subheader: [71, 85, 105],   // slate-600
  safe:      [22, 163, 74],   // green-600
  attention: [202, 138, 4],   // yellow-600
  critical:  [220, 38, 38],   // red-600
  risk_low:     [59, 130, 246],
  risk_medium:  [234, 179, 8],
  risk_high:    [249, 115, 22],
  risk_critical:[239, 68, 68],
  sim: [22, 163, 74],
  nao: [220, 38, 38],
  na:  [148, 163, 184],
};

function classificationColor(v: string | null): RGB {
  if (v === 'safe') return COLOR.safe;
  if (v === 'attention') return COLOR.attention;
  if (v === 'critical') return COLOR.critical;
  return COLOR.subheader;
}

function riskColor(v: string): RGB {
  return COLOR[`risk_${v}`] ?? COLOR.subheader;
}

// ─── Generator ───────────────────────────────────────────────────────────────

export function generateInspectionPdf(
  insp: InspectionPdfData,
  items: InspectionItem[],
  deviations: InspectionDeviation[],
) {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const marginL = 14;
  const marginR = 14;
  const contentW = pageW - marginL - marginR;
  let y = 14;

  // ── Header bar ──────────────────────────────────────────────────────────────
  doc.setFillColor(...COLOR.header);
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Inspeção Comportamental — SSMA Smart Vision 360°', marginL, 14);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const classLabel = CLASS_LABEL[insp.overall_classification ?? ''] ?? (insp.overall_classification ?? '—');
  doc.text(`Classificação: ${classLabel}`, pageW - marginR, 14, { align: 'right' });
  doc.text(`Status: ${insp.status === 'open' ? 'Aberta' : 'Fechada'}`, pageW - marginR, 19, { align: 'right' });

  y = 30;

  // ── Identification block ─────────────────────────────────────────────────────
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR.header);
  doc.text('1. IDENTIFICAÇÃO', marginL, y);
  y += 2;
  doc.setDrawColor(...COLOR.header);
  doc.setLineWidth(0.4);
  doc.line(marginL, y, pageW - marginR, y);
  y += 4;

  const metaCol1: [string, string][] = [
    ['Colaborador observado', insp.operator_name ?? '—'],
    ['Observador', insp.observer_name ?? '—'],
    ['Data', insp.date + (insp.time ? `  ${insp.time}` : '')],
    ['Tipo de observação', OBS_TYPE[insp.observation_type] ?? insp.observation_type],
  ];
  const metaCol2: [string, string][] = [
    ['Unidade / Contrato', insp.unit_contract ?? '—'],
    ['Área / Frente', insp.area ?? '—'],
    ['Equipamento', insp.equipment ?? '—'],
    ['Tipo de atividade', insp.activity_type ?? '—'],
  ];

  const colW = contentW / 2 - 4;
  const drawMeta = (pairs: [string, string][], x: number) => {
    let rowY = y;
    for (const [label, value] of pairs) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLOR.subheader);
      doc.setFontSize(7.5);
      doc.text(label, x, rowY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(8.5);
      doc.text(value, x, rowY + 4);
      rowY += 10;
    }
  };

  drawMeta(metaCol1, marginL);
  drawMeta(metaCol2, marginL + colW + 8);
  y += 44;

  // Classification highlight strip
  const cColor = classificationColor(insp.overall_classification);
  doc.setFillColor(...cColor);
  doc.roundedRect(marginL, y, contentW, 8, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Classificação: ${classLabel}`, pageW / 2, y + 5.5, { align: 'center' });
  y += 13;

  // ── Checklist ────────────────────────────────────────────────────────────────
  y += 2;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR.header);
  doc.text('2. CHECKLIST COMPORTAMENTAL', marginL, y);
  y += 2;
  doc.setDrawColor(...COLOR.header);
  doc.line(marginL, y, pageW - marginR, y);
  y += 3;

  if (items.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...COLOR.subheader);
    doc.setFontSize(8);
    doc.text('Nenhum item registrado.', marginL, y + 4);
    y += 10;
  } else {
    const grouped: Record<string, InspectionItem[]> = {};
    for (const item of items) {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    }

    for (const [cat, catItems] of Object.entries(grouped)) {
      autoTable(doc, {
        startY: y,
        head: [[{ content: CATEGORY_LABEL[cat] ?? cat, colSpan: 2, styles: { halign: 'left' } }]],
        body: catItems.map(it => [
          it.description,
          ITEM_STATUS_LABEL[it.status] ?? it.status,
        ]),
        headStyles: { fillColor: [241, 245, 249], textColor: [30, 64, 175], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8, textColor: [30, 30, 30] },
        columnStyles: { 1: { cellWidth: 18, halign: 'center' } },
        margin: { left: marginL, right: marginR },
        theme: 'grid',
        didDrawCell: (data) => {
          if (data.section === 'body' && data.column.index === 1) {
            const val = catItems[data.row.index]?.status;
            if (val === 'sim') doc.setTextColor(...COLOR.sim);
            else if (val === 'nao') doc.setTextColor(...COLOR.nao);
            else doc.setTextColor(...COLOR.na);
          }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 1) {
            const val = catItems[data.row.index]?.status;
            if (val === 'sim') data.cell.styles.textColor = COLOR.sim;
            else if (val === 'nao') data.cell.styles.textColor = COLOR.nao;
            else data.cell.styles.textColor = COLOR.na;
          }
        },
        tableWidth: contentW,
      });
      y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3;
    }
  }

  // ── Deviations ───────────────────────────────────────────────────────────────
  y += 2;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR.header);
  doc.text('3. DESVIOS E AÇÕES', marginL, y);
  y += 2;
  doc.setDrawColor(...COLOR.header);
  doc.line(marginL, y, pageW - marginR, y);
  y += 3;

  if (deviations.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...COLOR.subheader);
    doc.setFontSize(8);
    doc.text('Nenhum desvio registrado.', marginL, y + 4);
    y += 10;
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Descrição', 'Risco', 'Ação Imediata', 'Responsável', 'Prazo', 'Status']],
      body: deviations.map(d => [
        d.description,
        RISK_LABEL[d.risk_level] ?? d.risk_level,
        d.immediate_action ? IMMED_ACTION_LABEL[d.immediate_action] : '—',
        d.responsible ?? '—',
        d.deadline ?? '—',
        DEV_STATUS_LABEL[d.status] ?? d.status,
      ]),
      headStyles: { fillColor: COLOR.header, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7.5, textColor: [30, 30, 30] },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 38 },
        3: { cellWidth: 28 },
        4: { cellWidth: 18, halign: 'center' },
        5: { cellWidth: 22, halign: 'center' },
      },
      margin: { left: marginL, right: marginR },
      theme: 'striped',
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          const dev = deviations[data.row.index];
          data.cell.styles.textColor = riskColor(dev?.risk_level ?? '');
          data.cell.styles.fontStyle = 'bold';
        }
      },
      tableWidth: contentW,
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3;

    // Corrective actions detail
    const withActions = deviations.filter(d => d.corrective_action || d.immediate_action_description);
    if (withActions.length > 0) {
      y += 1;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLOR.subheader);
      doc.text('Detalhamento das ações:', marginL, y + 4);
      y += 7;
      for (const d of withActions) {
        const lines: string[] = [];
        if (d.immediate_action_description) lines.push(`• Ação imediata: ${d.immediate_action_description}`);
        if (d.corrective_action) lines.push(`• Ação ${d.corrective_action}: ${d.description}`);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 30, 30);
        doc.setFontSize(8);
        for (const line of lines) {
          const split = doc.splitTextToSize(line, contentW);
          doc.text(split, marginL, y);
          y += split.length * 4.5;
        }
        y += 1;
      }
    }
  }

  // ── Safe behavior ─────────────────────────────────────────────────────────
  if (insp.safe_behavior_description) {
    y += 3;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLOR.header);
    doc.text('4. COMPORTAMENTO SEGURO OBSERVADO', marginL, y);
    y += 2;
    doc.setDrawColor(...COLOR.header);
    doc.line(marginL, y, pageW - marginR, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(8.5);
    const split = doc.splitTextToSize(insp.safe_behavior_description, contentW);
    doc.text(split, marginL, y);
    y += split.length * 4.5 + 4;
  }

  // ── Footer on every page ──────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(marginL, pageH - 10, pageW - marginR, pageH - 10);
    doc.setTextColor(160, 160, 160);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Gerado em ${new Date().toLocaleString('pt-BR')} · ID ${insp.id}`,
      marginL,
      pageH - 6,
    );
    doc.text(`${i}/${pageCount}`, pageW - marginR, pageH - 6, { align: 'right' });
  }

  const dateStr = insp.date.replace(/-/g, '');
  const opName = (insp.operator_name ?? 'operador').replace(/\s+/g, '_').toLowerCase();
  doc.save(`inspecao_${dateStr}_${opName}.pdf`);
}
