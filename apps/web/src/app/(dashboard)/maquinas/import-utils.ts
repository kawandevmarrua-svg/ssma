import type ExcelJS from 'exceljs';

export interface ParsedItem {
  order_index: number;
  section: string | null;
  description: string;
  is_blocking: boolean;
}

export function worksheetToAoA(ws: ExcelJS.Worksheet): (string | number | null)[][] {
  const rows: (string | number | null)[][] = [];
  const lastRow = ws.actualRowCount || ws.rowCount || 0;
  const lastCol = ws.actualColumnCount || ws.columnCount || 0;
  for (let r = 1; r <= lastRow; r++) {
    const row = ws.getRow(r);
    const out: (string | number | null)[] = [];
    for (let c = 1; c <= lastCol; c++) {
      const cell = row.getCell(c);
      const v = cell.value;
      if (v == null) {
        out.push(null);
      } else if (typeof v === 'number' || typeof v === 'string') {
        out.push(v);
      } else if (typeof v === 'object' && 'richText' in (v as object)) {
        const rt = (v as { richText: { text: string }[] }).richText;
        out.push(rt.map((t) => t.text).join(''));
      } else if (typeof v === 'object' && 'text' in (v as object)) {
        out.push(String((v as { text: string }).text));
      } else if (typeof v === 'object' && 'result' in (v as object)) {
        const res = (v as { result: unknown }).result;
        out.push(res == null ? null : String(res));
      } else if (v instanceof Date) {
        out.push(v.toISOString());
      } else {
        out.push(String(v));
      }
    }
    rows.push(out);
  }
  return rows;
}

export function parseSheet(ws: ExcelJS.Worksheet): ParsedItem[] {
  const aoa = worksheetToAoA(ws);

  const items: ParsedItem[] = [];
  let currentSection: string | null = null;
  let started = false;
  const blockingMarkers = ['obrigat', 'somente para'];

  const firstCellText = (row: (string | number | null)[] | undefined): string => {
    if (!row) return '';
    for (const cell of row) {
      if (cell != null) {
        const s = String(cell).trim();
        if (s) return s;
      }
    }
    return '';
  };

  const firstNumber = (row: (string | number | null)[] | undefined): number | null => {
    if (!row) return null;
    for (const cell of row) {
      if (typeof cell === 'number' && Number.isFinite(cell) && Number.isInteger(cell)) {
        return cell;
      }
      if (typeof cell === 'string') {
        const t = cell.trim();
        if (/^\d+$/.test(t)) return parseInt(t, 10);
      }
    }
    return null;
  };

  const longestText = (
    row: (string | number | null)[] | undefined,
    excludeValue: string | number | null = null,
  ): string => {
    if (!row) return '';
    let best = '';
    for (const cell of row) {
      if (cell == null) continue;
      if (cell === excludeValue) continue;
      const s = String(cell).trim();
      if (!s) continue;
      if (typeof cell === 'number') continue;
      if (s.length > best.length) best = s;
    }
    return best;
  };

  for (const rawRow of aoa) {
    const row = rawRow as (string | number | null)[];
    const headerText = firstCellText(row).toUpperCase();

    if (!started) {
      if (
        (headerText.includes('RELA') && headerText.includes('VERIF')) ||
        headerText.includes('RELACAO DE ITENS') ||
        headerText.includes('ITENS DE VERIF')
      ) {
        started = true;
      }
      continue;
    }

    if (
      headerText.includes('RESULTADO') ||
      headerText.includes('ASSINATURA') ||
      headerText.includes('LEGENDA')
    ) {
      break;
    }

    const num = firstNumber(row);
    if (num != null) {
      const desc = longestText(row, num);
      if (desc) {
        items.push({
          order_index: num,
          section: currentSection,
          description: desc.replace(/\s+/g, ' '),
          is_blocking:
            !!currentSection &&
            blockingMarkers.some((m) => currentSection!.toLowerCase().includes(m)),
        });
      }
    } else if (headerText) {
      currentSection = firstCellText(row).replace(/\s+/g, ' ');
    }
  }

  return items;
}
