'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  HardHat,
  Plus,
  X,
  Search,
  Tag,
  Loader2,
  Download,
  QrCode,
  Upload,
  FileSpreadsheet,
  ListChecks,
  ChevronDown,
  ChevronRight,
  Trash2,
  Pencil,
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import ExcelJS from 'exceljs';

interface Machine {
  id: string;
  name: string;
  tag: string | null;
  max_load_capacity: string | null;
  serial_number: string | null;
  notes: string | null;
  qr_code: string | null;
  active: boolean;
  created_at: string;
  items_count?: number;
}

type ResponseType = 'yes_no' | 'yes_no_na' | 'text' | 'photo' | 'numeric';

const RESPONSE_TYPE_LABELS: Record<ResponseType, string> = {
  yes_no: 'Sim / Nao',
  yes_no_na: 'Sim / Nao / N.A.',
  text: 'Texto livre',
  photo: 'Foto',
  numeric: 'Numero',
};

interface ChecklistItem {
  id: string;
  machine_id: string;
  order_index: number;
  section: string | null;
  description: string;
  is_blocking: boolean;
  response_type: ResponseType;
}

interface ParsedItem {
  order_index: number;
  section: string | null;
  description: string;
  is_blocking: boolean;
}

interface ImportResult {
  machineName: string;
  itemsCount: number;
  status: 'created' | 'updated' | 'skipped' | 'error';
  message?: string;
}

export default function MaquinasPage() {
  const supabase = useMemo(() => createClient(), []);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Machine | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrMachine, setQrMachine] = useState<Machine | null>(null);
  const qrRef = useRef<HTMLDivElement | null>(null);

  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [expandedMachineId, setExpandedMachineId] = useState<string | null>(null);
  const [itemsByMachine, setItemsByMachine] = useState<Record<string, ChecklistItem[]>>({});
  const [itemsLoadingId, setItemsLoadingId] = useState<string | null>(null);

  const [questionModal, setQuestionModal] = useState<{
    machine: Machine;
    item: ChecklistItem | null;
  } | null>(null);
  const [qDescription, setQDescription] = useState('');
  const [qSection, setQSection] = useState('');
  const [qOrderIndex, setQOrderIndex] = useState('');
  const [qResponseType, setQResponseType] = useState<ResponseType>('yes_no');
  const [qIsBlocking, setQIsBlocking] = useState(false);
  const [qSaving, setQSaving] = useState(false);
  const [qError, setQError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [maxLoadCapacity, setMaxLoadCapacity] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [active, setActive] = useState(true);

  const loadMachines = useCallback(async () => {
    const { data } = await supabase
      .from('machines')
      .select('*, machine_checklist_items(count)')
      .order('created_at', { ascending: false });
    const withCounts = (data ?? []).map((m: Machine & { machine_checklist_items?: { count: number }[] }) => ({
      ...m,
      items_count: m.machine_checklist_items?.[0]?.count ?? 0,
    }));
    setMachines(withCounts);
    setLoading(false);
  }, [supabase]);

  const loadItemsFor = useCallback(
    async (machineId: string) => {
      setItemsLoadingId(machineId);
      const { data } = await supabase
        .from('machine_checklist_items')
        .select('*')
        .eq('machine_id', machineId)
        .order('order_index', { ascending: true });
      setItemsByMachine((prev) => ({
        ...prev,
        [machineId]: (data as ChecklistItem[]) ?? [],
      }));
      setItemsLoadingId(null);
    },
    [supabase],
  );

  const toggleExpand = useCallback(
    async (m: Machine) => {
      if (expandedMachineId === m.id) {
        setExpandedMachineId(null);
        return;
      }
      setExpandedMachineId(m.id);
      if (!itemsByMachine[m.id]) await loadItemsFor(m.id);
    },
    [expandedMachineId, itemsByMachine, loadItemsFor],
  );

  function openCreateQuestion(m: Machine) {
    const existing = itemsByMachine[m.id] || [];
    const nextOrder =
      existing.length > 0
        ? Math.max(...existing.map((it) => it.order_index)) + 1
        : 1;
    setQuestionModal({ machine: m, item: null });
    setQDescription('');
    setQSection('');
    setQOrderIndex(String(nextOrder));
    setQResponseType('yes_no');
    setQIsBlocking(false);
    setQError(null);
  }

  function openEditQuestion(m: Machine, it: ChecklistItem) {
    setQuestionModal({ machine: m, item: it });
    setQDescription(it.description);
    setQSection(it.section || '');
    setQOrderIndex(String(it.order_index));
    setQResponseType(it.response_type);
    setQIsBlocking(it.is_blocking);
    setQError(null);
  }

  async function saveQuestion() {
    if (!questionModal) return;
    if (!qDescription.trim()) {
      setQError('A pergunta e obrigatoria.');
      return;
    }
    const orderNum = parseInt(qOrderIndex, 10);
    if (Number.isNaN(orderNum)) {
      setQError('Ordem invalida.');
      return;
    }
    setQSaving(true);
    setQError(null);

    const payload = {
      machine_id: questionModal.machine.id,
      order_index: orderNum,
      section: qSection.trim() || null,
      description: qDescription.trim(),
      response_type: qResponseType,
      is_blocking: qIsBlocking,
    };

    if (questionModal.item) {
      const { error: upErr } = await supabase
        .from('machine_checklist_items')
        .update(payload)
        .eq('id', questionModal.item.id);
      if (upErr) {
        setQError(upErr.message);
        setQSaving(false);
        return;
      }
    } else {
      const { error: insErr } = await supabase
        .from('machine_checklist_items')
        .insert(payload);
      if (insErr) {
        setQError(insErr.message);
        setQSaving(false);
        return;
      }
    }

    setQSaving(false);
    setQuestionModal(null);
    await loadItemsFor(questionModal.machine.id);
    await loadMachines();
  }

  async function deleteQuestion(m: Machine, it: ChecklistItem) {
    if (!confirm(`Excluir a pergunta "${it.description.slice(0, 60)}..."?`)) return;
    await supabase.from('machine_checklist_items').delete().eq('id', it.id);
    await loadItemsFor(m.id);
    await loadMachines();
  }

  async function deleteMachine(m: Machine) {
    if (
      !confirm(
        `Excluir a maquina "${m.name}"? Todas as ${m.items_count ?? 0} perguntas vinculadas serao removidas tambem.`,
      )
    )
      return;
    await supabase.from('machines').delete().eq('id', m.id);
    await loadMachines();
  }

  function worksheetToAoA(ws: ExcelJS.Worksheet): (string | number | null)[][] {
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

  function parseSheet(ws: ExcelJS.Worksheet): ParsedItem[] {
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

  async function handleImportFile(file: File) {
    setImporting(true);
    setImportResults(null);

    try {
      const buffer = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        setImportResults([{ machineName: '-', itemsCount: 0, status: 'error', message: 'Usuario nao autenticado' }]);
        setImporting(false);
        return;
      }

      const results: ImportResult[] = [];

      for (const ws of wb.worksheets) {
        const sheetName = ws.name;
        const cleanName = sheetName.replace(/^\s*\d+\.\s*/, '').trim();
        if (!cleanName) continue;

        const items = parseSheet(ws);

        if (items.length === 0) {
          results.push({
            machineName: cleanName,
            itemsCount: 0,
            status: 'skipped',
            message: 'Nenhuma pergunta encontrada na aba',
          });
          continue;
        }

        const { data: existing } = await supabase
          .from('machines')
          .select('id')
          .eq('name', cleanName)
          .eq('created_by', currentUser.id)
          .maybeSingle();

        let machineId: string;
        let isNew = false;

        if (existing) {
          machineId = existing.id;
          await supabase.from('machine_checklist_items').delete().eq('machine_id', machineId);
        } else {
          const { data: inserted, error: insErr } = await supabase
            .from('machines')
            .insert({ name: cleanName, created_by: currentUser.id })
            .select('id')
            .single();
          if (insErr || !inserted) {
            results.push({
              machineName: cleanName,
              itemsCount: 0,
              status: 'error',
              message: insErr?.message || 'Erro ao criar maquina',
            });
            continue;
          }
          machineId = inserted.id;
          isNew = true;
        }

        const payload = items.map((it) => ({
          machine_id: machineId,
          order_index: it.order_index,
          section: it.section,
          description: it.description,
          is_blocking: it.is_blocking,
          response_type: 'yes_no' as ResponseType,
        }));

        const { error: itemsErr } = await supabase
          .from('machine_checklist_items')
          .insert(payload);

        if (itemsErr) {
          results.push({
            machineName: cleanName,
            itemsCount: 0,
            status: 'error',
            message: 'Erro ao inserir perguntas: ' + itemsErr.message,
          });
          continue;
        }

        results.push({
          machineName: cleanName,
          itemsCount: items.length,
          status: isNew ? 'created' : 'updated',
        });
      }

      setImportResults(results);
      await loadMachines();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setImportResults([{ machineName: '-', itemsCount: 0, status: 'error', message: msg }]);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  useEffect(() => {
    loadMachines();
  }, [loadMachines]);

  function resetForm() {
    setName('');
    setTag('');
    setMaxLoadCapacity('');
    setSerialNumber('');
    setNotes('');
    setActive(true);
    setError(null);
  }

  function openCreate() {
    setEditing(null);
    resetForm();
    setShowModal(true);
  }

  function openEdit(m: Machine) {
    setEditing(m);
    setName(m.name);
    setTag(m.tag || '');
    setMaxLoadCapacity(m.max_load_capacity || '');
    setSerialNumber(m.serial_number || '');
    setNotes(m.notes || '');
    setActive(m.active);
    setError(null);
    setShowModal(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('Nome da maquina e obrigatorio.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      name: name.trim(),
      tag: tag.trim() || null,
      max_load_capacity: maxLoadCapacity.trim() || null,
      serial_number: serialNumber.trim() || null,
      notes: notes.trim() || null,
      active,
    };

    if (editing) {
      const { error: updateError } = await supabase
        .from('machines')
        .update(payload)
        .eq('id', editing.id);

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }

      setSaving(false);
      setShowModal(false);
      await loadMachines();
    } else {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const { data: inserted, error: insertError } = await supabase
        .from('machines')
        .insert({ ...payload, created_by: currentUser!.id })
        .select()
        .single();

      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }

      setSaving(false);
      setShowModal(false);
      await loadMachines();
      if (inserted) setQrMachine(inserted as Machine);
    }
  }

  function downloadQrCode(m: Machine) {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = `qr-${m.qr_code || m.name.replace(/\s+/g, '-')}.png`;
    link.click();
  }

  async function handleToggleActive(m: Machine) {
    await supabase
      .from('machines')
      .update({ active: !m.active })
      .eq('id', m.id);
    await loadMachines();
  }

  const filtered = machines.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      (m.tag && m.tag.toLowerCase().includes(q)) ||
      (m.serial_number && m.serial_number.toLowerCase().includes(q))
    );
  });

  const activeCount = machines.filter((m) => m.active).length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Maquinas</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {machines.length} maquinas cadastradas, {activeCount} ativas
          </p>
        </div>
        <div className="flex gap-2 flex-wrap shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImportFile(f);
            }}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? (
              <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 sm:mr-2" />
            )}
            <span className="hidden sm:inline">Importar XLSX</span>
            <span className="sm:hidden">XLSX</span>
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Nova Maquina</span>
            <span className="sm:hidden">Nova</span>
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, tag ou numero de serie..."
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <HardHat className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              {search ? 'Nenhuma maquina encontrada.' : 'Nenhuma maquina cadastrada.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((m) => {
            const expanded = expandedMachineId === m.id;
            const items = itemsByMachine[m.id] || [];
            const isLoadingItems = itemsLoadingId === m.id;
            return (
              <Card key={m.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <button
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      title={expanded ? 'Ocultar perguntas' : 'Mostrar perguntas'}
                      onClick={() => toggleExpand(m)}
                    >
                      {expanded ? (
                        <ChevronDown className="h-5 w-5" />
                      ) : (
                        <ChevronRight className="h-5 w-5" />
                      )}
                    </button>

                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${
                        m.active ? 'bg-amber-500' : 'bg-gray-400'
                      }`}
                    >
                      <HardHat className="h-5 w-5" />
                    </div>

                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => toggleExpand(m)}
                    >
                      <p className="font-medium truncate">{m.name}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {m.qr_code && (
                          <span className="flex items-center gap-1 font-mono">
                            <QrCode className="h-3 w-3" />
                            {m.qr_code}
                          </span>
                        )}
                        {m.tag && (
                          <span className="flex items-center gap-1">
                            <Tag className="h-3 w-3" />
                            {m.tag}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <ListChecks className="h-3 w-3" />
                          {m.items_count ?? 0} perguntas
                        </span>
                      </div>
                    </div>

                    <button
                      className="shrink-0 rounded-md border p-1.5 hover:bg-accent"
                      title="Editar maquina"
                      onClick={() => openEdit(m)}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>

                    <button
                      className="shrink-0 rounded-md border p-1.5 hover:bg-accent"
                      title="Ver QR Code"
                      onClick={() => setQrMachine(m)}
                    >
                      <QrCode className="h-4 w-4" />
                    </button>

                    <button
                      className="shrink-0 rounded-md border p-1.5 hover:bg-red-50 hover:text-red-700"
                      title="Excluir maquina"
                      onClick={() => deleteMachine(m)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>

                    <button
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                        m.active
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                      onClick={() => handleToggleActive(m)}
                    >
                      {m.active ? 'Ativa' : 'Inativa'}
                    </button>
                  </div>

                  {expanded && (
                    <div className="mt-4 border-t pt-4">
                      {isLoadingItems ? (
                        <div className="flex justify-center py-6">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <>
                          {items.length === 0 ? (
                            <p className="text-center text-sm text-muted-foreground py-4">
                              Nenhuma pergunta. Clique em &quot;Adicionar pergunta&quot; abaixo.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {(() => {
                                const blocks: { section: string | null; items: ChecklistItem[] }[] = [];
                                for (const it of items) {
                                  const last = blocks[blocks.length - 1];
                                  if (!last || last.section !== it.section) {
                                    blocks.push({ section: it.section, items: [it] });
                                  } else {
                                    last.items.push(it);
                                  }
                                }
                                return blocks.map((b, bi) => (
                                  <div key={bi} className="space-y-1.5">
                                    {b.section && (
                                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-2">
                                        {b.section}
                                      </p>
                                    )}
                                    {b.items.map((it) => (
                                      <div
                                        key={it.id}
                                        className="flex items-start gap-2 rounded-md border p-2.5 text-sm hover:bg-muted/30"
                                      >
                                        <span className="shrink-0 font-mono text-xs text-muted-foreground w-6 text-right pt-0.5">
                                          {it.order_index}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                          <p>{it.description}</p>
                                          <div className="mt-1 flex flex-wrap gap-1.5">
                                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                                              {RESPONSE_TYPE_LABELS[it.response_type]}
                                            </span>
                                            {it.is_blocking && (
                                              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                                                impeditivo
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <button
                                          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                                          title="Editar pergunta"
                                          onClick={() => openEditQuestion(m, it)}
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-700"
                                          title="Excluir pergunta"
                                          onClick={() => deleteQuestion(m, it)}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                ));
                              })()}
                            </div>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3 w-full"
                            onClick={() => openCreateQuestion(m)}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Adicionar pergunta
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-lg">
                  {editing ? 'Editar Maquina' : 'Nova Maquina'}
                </CardTitle>
                <CardDescription>
                  {editing
                    ? 'Atualize os dados da maquina.'
                    : 'Cadastre uma nova maquina/equipamento.'}
                </CardDescription>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSave();
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label>Nome da maquina *</Label>
                  <Input
                    placeholder="Ex: Caminhao Basculante 01"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tag / Identificacao</Label>
                  <Input
                    placeholder="Ex: CB-001"
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Numero de serie</Label>
                  <Input
                    placeholder="Ex: SN-12345"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Capacidade maxima de carga</Label>
                  <Input
                    placeholder="Ex: 25 toneladas"
                    value={maxLoadCapacity}
                    onChange={(e) => setMaxLoadCapacity(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Observacoes</Label>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Notas adicionais sobre a maquina..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                {editing && (
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
                          active
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-background text-muted-foreground border-input hover:bg-accent'
                        }`}
                        onClick={() => setActive(true)}
                      >
                        Ativa
                      </button>
                      <button
                        type="button"
                        className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
                          !active
                            ? 'bg-red-500 text-white border-red-500'
                            : 'bg-background text-muted-foreground border-input hover:bg-accent'
                        }`}
                        onClick={() => setActive(false)}
                      >
                        Inativa
                      </button>
                    </div>
                  </div>
                )}

                {error && <p className="text-sm text-destructive">{error}</p>}

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowModal(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1" disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : editing ? (
                      'Atualizar'
                    ) : (
                      'Cadastrar'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {qrMachine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-lg">QR Code da Maquina</CardTitle>
                <CardDescription>{qrMachine.name}</CardDescription>
              </div>
              <button
                onClick={() => setQrMachine(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <div ref={qrRef} className="rounded-lg bg-white p-4">
                <QRCodeCanvas
                  value={qrMachine.qr_code || qrMachine.id}
                  size={220}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <div className="text-center">
                <p className="font-mono text-lg font-semibold tracking-wider">
                  {qrMachine.qr_code || '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Identificador unico da maquina
                </p>
              </div>
              <p className="text-xs text-center text-muted-foreground px-2">
                Imprima e fixe na maquina. Operadores escaneiam este codigo no app
                para iniciar o checklist informando que estao operando esta maquina.
              </p>
              <Button
                className="w-full"
                onClick={() => downloadQrCode(qrMachine)}
              >
                <Download className="mr-2 h-4 w-4" />
                Baixar QR Code (PNG)
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {importResults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Resultado da importacao
                </CardTitle>
                <CardDescription>
                  {importResults.filter((r) => r.status === 'created').length} criadas,{' '}
                  {importResults.filter((r) => r.status === 'updated').length} atualizadas,{' '}
                  {importResults.filter((r) => r.status === 'skipped').length} ignoradas,{' '}
                  {importResults.filter((r) => r.status === 'error').length} com erro
                </CardDescription>
              </div>
              <button
                onClick={() => setImportResults(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {importResults.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between gap-2 rounded-md border p-2 text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{r.machineName}</p>
                      {r.message && (
                        <p className="text-xs text-muted-foreground">{r.message}</p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        r.status === 'created'
                          ? 'bg-emerald-100 text-emerald-700'
                          : r.status === 'updated'
                          ? 'bg-blue-100 text-blue-700'
                          : r.status === 'skipped'
                          ? 'bg-gray-100 text-gray-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {r.status === 'created'
                        ? `+ ${r.itemsCount} perguntas`
                        : r.status === 'updated'
                        ? `${r.itemsCount} perguntas`
                        : r.status === 'skipped'
                        ? 'ignorada'
                        : 'erro'}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {questionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-lg">
                  {questionModal.item ? 'Editar pergunta' : 'Nova pergunta'}
                </CardTitle>
                <CardDescription>{questionModal.machine.name}</CardDescription>
              </div>
              <button
                onClick={() => setQuestionModal(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveQuestion();
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label>Pergunta *</Label>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Ex: Cinto de seguranca em boas condicoes?"
                    value={qDescription}
                    onChange={(e) => setQDescription(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tipo de resposta *</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={qResponseType}
                    onChange={(e) => setQResponseType(e.target.value as ResponseType)}
                  >
                    {(Object.keys(RESPONSE_TYPE_LABELS) as ResponseType[]).map((k) => (
                      <option key={k} value={k}>
                        {RESPONSE_TYPE_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Ordem</Label>
                    <Input
                      type="number"
                      value={qOrderIndex}
                      onChange={(e) => setQOrderIndex(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Secao (opcional)</Label>
                    <Input
                      placeholder="Ex: Obrigatorio para lavra"
                      value={qSection}
                      onChange={(e) => setQSection(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="is_blocking"
                    type="checkbox"
                    className="h-4 w-4 rounded border"
                    checked={qIsBlocking}
                    onChange={(e) => setQIsBlocking(e.target.checked)}
                  />
                  <label htmlFor="is_blocking" className="text-sm">
                    Pergunta impeditiva (NC bloqueia a liberacao da maquina)
                  </label>
                </div>

                {qError && <p className="text-sm text-destructive">{qError}</p>}

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setQuestionModal(null)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1" disabled={qSaving}>
                    {qSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : questionModal.item ? (
                      'Atualizar'
                    ) : (
                      'Adicionar'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
