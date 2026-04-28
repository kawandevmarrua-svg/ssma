'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  HardHat,
  Plus,
  Search,
  Tag,
  Loader2,
  Upload,
  ListChecks,
  ChevronDown,
  ChevronRight,
  Trash2,
  Pencil,
  QrCode,
} from 'lucide-react';
import type { Machine, ChecklistItem, ResponseType } from '@/lib/types';
import { parseSheet, type ParsedItem } from './import-utils';
import { MachineFormModal } from './machine-form-modal';
import { QuestionFormModal } from './question-form-modal';
import { QRCodeModal } from './qr-code-modal';
import { ImportResultsModal, type ImportResult } from './import-results-modal';

const RESPONSE_TYPE_LABELS: Record<ResponseType, string> = {
  yes_no: 'Sim / Nao',
  yes_no_na: 'Sim / Nao / N.A.',
  text: 'Texto livre',
  photo: 'Foto',
  numeric: 'Numero',
};

export default function MaquinasPage() {
  const supabase = useMemo(() => createClient(), []);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Machine | null>(null);
  const [qrMachine, setQrMachine] = useState<Machine | null>(null);

  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [expandedMachineId, setExpandedMachineId] = useState<string | null>(null);
  const [itemsByMachine, setItemsByMachine] = useState<Record<string, ChecklistItem[]>>({});
  const [itemsLoadingId, setItemsLoadingId] = useState<string | null>(null);

  const [questionModal, setQuestionModal] = useState<{ machine: Machine; item: ChecklistItem | null } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadMachines = useCallback(async (term = '') => {
    let query = supabase
      .from('machines')
      .select('id, name, tag, max_load_capacity, serial_number, notes, qr_code, active, created_at, machine_checklist_items(count)')
      .order('created_at', { ascending: false });
    if (term) {
      query = query.or(`name.ilike.%${term}%,tag.ilike.%${term}%,serial_number.ilike.%${term}%`);
    }
    const { data } = await query;
    const withCounts = (data ?? []).map((m: Machine & { machine_checklist_items?: { count: number }[] }) => ({
      ...m,
      items_count: m.machine_checklist_items?.[0]?.count ?? 0,
    }));
    setMachines(withCounts);
    setLoading(false);
  }, [supabase]);

  const loadItemsFor = useCallback(async (machineId: string) => {
    setItemsLoadingId(machineId);
    const { data } = await supabase
      .from('machine_checklist_items')
      .select('id, machine_id, order_index, section, description, is_blocking, response_type')
      .eq('machine_id', machineId)
      .order('order_index', { ascending: true });
    setItemsByMachine((prev) => ({ ...prev, [machineId]: (data as ChecklistItem[]) ?? [] }));
    setItemsLoadingId(null);
  }, [supabase]);

  const toggleExpand = useCallback(async (m: Machine) => {
    if (expandedMachineId === m.id) { setExpandedMachineId(null); return; }
    setExpandedMachineId(m.id);
    if (!itemsByMachine[m.id]) await loadItemsFor(m.id);
  }, [expandedMachineId, itemsByMachine, loadItemsFor]);

  async function deleteQuestion(m: Machine, it: ChecklistItem) {
    if (!confirm(`Excluir a pergunta "${it.description.slice(0, 60)}..."?`)) return;
    await supabase.from('machine_checklist_items').delete().eq('id', it.id);
    await loadItemsFor(m.id);
    await loadMachines();
  }

  async function deleteMachine(m: Machine) {
    if (!confirm(`Excluir a maquina "${m.name}"? Todas as ${m.items_count ?? 0} perguntas vinculadas serao removidas tambem.`)) return;
    await supabase.from('machines').delete().eq('id', m.id);
    await loadMachines();
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    setImportResults(null);
    try {
      const ExcelJS = (await import('exceljs')).default;
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
          results.push({ machineName: cleanName, itemsCount: 0, status: 'skipped', message: 'Nenhuma pergunta encontrada na aba' });
          continue;
        }
        const { data: existing } = await supabase.from('machines').select('id').eq('name', cleanName).eq('created_by', currentUser.id).maybeSingle();
        let machineId: string;
        let isNew = false;
        if (existing) {
          machineId = existing.id;
          await supabase.from('machine_checklist_items').delete().eq('machine_id', machineId);
        } else {
          const { data: inserted, error: insErr } = await supabase.from('machines').insert({ name: cleanName, created_by: currentUser.id }).select('id').single();
          if (insErr || !inserted) { results.push({ machineName: cleanName, itemsCount: 0, status: 'error', message: insErr?.message || 'Erro ao criar maquina' }); continue; }
          machineId = inserted.id;
          isNew = true;
        }
        const payload = items.map((it) => ({
          machine_id: machineId, order_index: it.order_index, section: it.section, description: it.description, is_blocking: it.is_blocking, response_type: 'yes_no' as ResponseType,
        }));
        const { error: itemsErr } = await supabase.from('machine_checklist_items').insert(payload);
        if (itemsErr) { results.push({ machineName: cleanName, itemsCount: 0, status: 'error', message: 'Erro ao inserir perguntas: ' + itemsErr.message }); continue; }
        results.push({ machineName: cleanName, itemsCount: items.length, status: isNew ? 'created' : 'updated' });
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

  useEffect(() => { loadMachines(debouncedSearch); }, [loadMachines, debouncedSearch]);

  async function handleToggleActive(m: Machine) {
    await supabase.from('machines').update({ active: !m.active }).eq('id', m.id);
    await loadMachines();
  }

  const filtered = machines;

  const activeCount = useMemo(() => machines.filter((m) => m.active).length, [machines]);

  function getNextOrder(machineId: string) {
    const existing = itemsByMachine[machineId] || [];
    return existing.length > 0 ? Math.max(...existing.map((it) => it.order_index)) + 1 : 1;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Maquinas</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">{machines.length} maquinas cadastradas, {activeCount} ativas</p>
        </div>
        <div className="flex gap-2 flex-wrap shrink-0">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); }} />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            {importing ? <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" /> : <Upload className="h-4 w-4 sm:mr-2" />}
            <span className="hidden sm:inline">Importar XLSX</span><span className="sm:hidden">XLSX</span>
          </Button>
          <Button onClick={() => { setEditing(null); setShowModal(true); }}>
            <Plus className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Nova Maquina</span><span className="sm:hidden">Nova</span>
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar por nome, tag ou numero de serie..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-12 text-center"><HardHat className="h-10 w-10 text-muted-foreground mb-3" /><p className="text-muted-foreground">{search ? 'Nenhuma maquina encontrada.' : 'Nenhuma maquina cadastrada.'}</p></CardContent></Card>
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
                    <button className="shrink-0 text-muted-foreground hover:text-foreground" title={expanded ? 'Ocultar perguntas' : 'Mostrar perguntas'} onClick={() => toggleExpand(m)}>
                      {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    </button>
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${m.active ? 'bg-amber-500' : 'bg-gray-400'}`}>
                      <HardHat className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpand(m)}>
                      <p className="font-medium truncate">{m.name}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {m.qr_code && <span className="flex items-center gap-1 font-mono"><QrCode className="h-3 w-3" />{m.qr_code}</span>}
                        {m.tag && <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{m.tag}</span>}
                        <span className="flex items-center gap-1"><ListChecks className="h-3 w-3" />{m.items_count ?? 0} perguntas</span>
                      </div>
                    </div>
                    <button className="shrink-0 rounded-md border p-1.5 hover:bg-accent" title="Editar maquina" onClick={() => { setEditing(m); setShowModal(true); }}><Pencil className="h-4 w-4" /></button>
                    <button className="shrink-0 rounded-md border p-1.5 hover:bg-accent" title="Ver QR Code" onClick={() => setQrMachine(m)}><QrCode className="h-4 w-4" /></button>
                    <button className="shrink-0 rounded-md border p-1.5 hover:bg-red-50 hover:text-red-700" title="Excluir maquina" onClick={() => deleteMachine(m)}><Trash2 className="h-4 w-4" /></button>
                    <button className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${m.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`} onClick={() => handleToggleActive(m)}>{m.active ? 'Ativa' : 'Inativa'}</button>
                  </div>

                  {expanded && (
                    <div className="mt-4 border-t pt-4">
                      {isLoadingItems ? (
                        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                      ) : (
                        <>
                          {items.length === 0 ? (
                            <p className="text-center text-sm text-muted-foreground py-4">Nenhuma pergunta. Clique em &quot;Adicionar pergunta&quot; abaixo.</p>
                          ) : (
                            <div className="space-y-2">
                              {(() => {
                                const blocks: { section: string | null; items: ChecklistItem[] }[] = [];
                                for (const it of items) {
                                  const last = blocks[blocks.length - 1];
                                  if (!last || last.section !== it.section) blocks.push({ section: it.section, items: [it] });
                                  else last.items.push(it);
                                }
                                return blocks.map((b, bi) => (
                                  <div key={bi} className="space-y-1.5">
                                    {b.section && <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-2">{b.section}</p>}
                                    {b.items.map((it) => (
                                      <div key={it.id} className="flex items-start gap-2 rounded-md border p-2.5 text-sm hover:bg-muted/30">
                                        <span className="shrink-0 font-mono text-xs text-muted-foreground w-6 text-right pt-0.5">{it.order_index}</span>
                                        <div className="flex-1 min-w-0">
                                          <p>{it.description}</p>
                                          <div className="mt-1 flex flex-wrap gap-1.5">
                                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">{RESPONSE_TYPE_LABELS[it.response_type]}</span>
                                            {it.is_blocking && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">impeditivo</span>}
                                          </div>
                                        </div>
                                        <button className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title="Editar pergunta" onClick={() => setQuestionModal({ machine: m, item: it })}><Pencil className="h-3.5 w-3.5" /></button>
                                        <button className="shrink-0 rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-700" title="Excluir pergunta" onClick={() => deleteQuestion(m, it)}><Trash2 className="h-3.5 w-3.5" /></button>
                                      </div>
                                    ))}
                                  </div>
                                ));
                              })()}
                            </div>
                          )}
                          <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setQuestionModal({ machine: m, item: null })}>
                            <Plus className="mr-2 h-4 w-4" />Adicionar pergunta
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
        <MachineFormModal
          open={showModal}
          editing={editing}
          supabase={supabase}
          onClose={() => setShowModal(false)}
          onSaved={async (inserted) => {
            setShowModal(false);
            await loadMachines();
            if (inserted) setQrMachine(inserted);
          }}
        />
      )}

      <QRCodeModal machine={qrMachine} onClose={() => setQrMachine(null)} />

      <ImportResultsModal results={importResults} onClose={() => setImportResults(null)} />

      {questionModal && (
        <QuestionFormModal
          machine={questionModal.machine}
          item={questionModal.item}
          nextOrder={getNextOrder(questionModal.machine.id)}
          supabase={supabase}
          onClose={() => setQuestionModal(null)}
          onSaved={async () => {
            const machineId = questionModal.machine.id;
            setQuestionModal(null);
            await loadItemsFor(machineId);
            await loadMachines();
          }}
        />
      )}
    </div>
  );
}
