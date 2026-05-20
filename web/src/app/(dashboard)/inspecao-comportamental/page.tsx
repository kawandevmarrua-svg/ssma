'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, ChevronLeft, Download, LockOpen, Lock, FileText, ClipboardCheck, Briefcase, AlertTriangle } from 'lucide-react';
import { generateInspectionPdf } from '@/lib/inspection-pdf';
import { resolveSignedUrl } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { SupabaseClient } from '@supabase/supabase-js';

type ObservationType = 'routine' | 'critical_activity' | 'post_incident' | 'deviation_followup' | 'scheduled_audit';
type ItemStatus = 'sim' | 'nao' | 'na';
type Category = 'risk_perception' | 'attitude' | 'ppe' | 'operation' | 'communication' | 'environment';
type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
type ImmediateAction = 'verbal_guidance' | 'activity_intervention' | 'activity_stoppage' | 'immediate_correction';
type DeviationStatus = 'open' | 'in_progress' | 'completed';
type Classification = 'safe' | 'attention' | 'critical';
type InspectionStatus = 'open' | 'closed';

interface Profile { id: string; full_name: string | null; role: string; }
interface Machine { id: string; name: string; tag: string | null; }
interface ActivityType { id: string; code: string; description: string; }
interface Location { id: string; name: string; code: string | null; }

interface Inspection {
  id: string;
  observer_id: string;
  operator_id: string;
  date: string;
  time: string | null;
  observation_type: ObservationType;
  overall_classification: Classification | null;
  status: InspectionStatus;
  unit_contract: string | null;
  area: string | null;
  equipment: string | null;
  activity_type: string | null;
  safe_behavior_description: string | null;
  created_at: string;
  operator?: Profile;
  observer?: Profile;
}

interface Deviation {
  description: string;
  risk_level: RiskLevel;
  immediate_action: ImmediateAction | null;
  immediate_action_description: string;
  corrective_action: string;
  responsible: string;
  deadline: string;
  status: DeviationStatus;
}

const CHECKLIST: Record<Category, { label: string; items: string[] }> = {
  risk_perception: {
    label: '3.1 Percepção de Risco',
    items: [
      'Demonstrou consciência dos riscos da atividade',
      'Realizou APR / análise de risco antes da atividade',
      'Conhece os limites operacionais do equipamento',
      'Identificou perigos no entorno',
    ],
  },
  attitude: {
    label: '3.2 Postura e Atitude',
    items: [
      'Mantém atenção plena durante a atividade',
      'Não apresenta comportamento de pressa / excesso de confiança',
      'Segue orientações e procedimentos',
      'Demonstra responsabilidade com sua segurança e dos demais',
    ],
  },
  ppe: {
    label: '3.3 Uso de EPI',
    items: [
      'Utiliza todos os EPIs obrigatórios',
      'EPIs em bom estado de conservação',
      'Uso correto dos EPIs durante toda a atividade',
    ],
  },
  operation: {
    label: '3.4 Operação / Execução da Tarefa',
    items: [
      'Realizou checklist do equipamento',
      'Opera dentro dos limites seguros',
      'Mantém distância segura de pessoas/equipamentos',
      'Segue padrão operacional definido',
      'Não improvisa',
    ],
  },
  communication: {
    label: '3.5 Comunicação e Interação',
    items: [
      'Comunicação clara com equipe',
      'Utiliza sinalização adequada (rádio, gestos, etc.)',
      'Interrompe atividade em caso de dúvida',
      'Aceita orientação / feedback',
    ],
  },
  environment: {
    label: '3.6 Condições do Ambiente',
    items: [
      'Área organizada e limpa',
      'Condições seguras de trabalho',
      'Ausência de interferências de risco',
      'Controle ambiental adequado (derramamento, poeira, etc.)',
    ],
  },
};

const CATEGORIES = Object.keys(CHECKLIST) as Category[];

function blankDeviation(): Deviation {
  return {
    description: '',
    risk_level: 'low',
    immediate_action: null,
    immediate_action_description: '',
    corrective_action: '',
    responsible: '',
    deadline: '',
    status: 'open',
  };
}

function todayStr() { return new Date().toISOString().slice(0, 10); }
function timeStr() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
}
function monthStartStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InspecaoComportamentalPage() {
  const supabase = useMemo(() => createClient(), []);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [operators, setOperators] = useState<Profile[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState<Set<string>>(new Set());

  // List filters
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'closed'>('all');

  // Export state
  const [showExport, setShowExport] = useState(false);
  const [exportFrom, setExportFrom] = useState(monthStartStr());
  const [exportTo, setExportTo] = useState(todayStr());
  const [exportOperator, setExportOperator] = useState('');
  const [exportStatusFilter, setExportStatusFilter] = useState('');
  const [exporting, setExporting] = useState(false);

  // Form state
  const [operatorId, setOperatorId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [time, setTime] = useState(timeStr());
  const [unitContract, setUnitContract] = useState('');
  const [area, setArea] = useState('');
  const [equipment, setEquipment] = useState('');
  const [activityType, setActivityType] = useState('');
  const [observationType, setObservationType] = useState<ObservationType>('routine');
  const [checklistAnswers, setChecklistAnswers] = useState<Record<string, ItemStatus>>({});
  const [deviations, setDeviations] = useState<Deviation[]>([blankDeviation()]);
  const [safeBehavior, setSafeBehavior] = useState('');
  const [hasRisk, setHasRisk] = useState<boolean | null>(null);
  const [classification, setClassification] = useState<Classification>('safe');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    const [userRes, opsRes, inspsRes, machinesRes, actTypesRes, locationsRes] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('profiles').select('id, full_name, role').order('full_name'),
      supabase.from('behavioral_inspections').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('machines').select('id, name, tag').eq('active', true).order('name'),
      supabase.from('activity_types').select('id, code, description').eq('active', true).order('order_index'),
      supabase.from('locations').select('id, name, code').eq('active', true).order('name'),
    ]);

    const userId = userRes.data.user?.id ?? null;
    setCurrentUserId(userId);
    setOperators((opsRes.data ?? []) as Profile[]);
    setMachines((machinesRes.data ?? []) as Machine[]);
    setActivityTypes((actTypesRes.data ?? []) as ActivityType[]);
    setLocations((locationsRes.data ?? []) as Location[]);

    if (userId) {
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', userId).single();
      setCurrentUserRole(prof?.role ?? null);
    }

    const insp = (inspsRes.data ?? []) as Inspection[];
    const ids = [...new Set([...insp.map(i => i.operator_id), ...insp.map(i => i.observer_id)])];
    let profileMap: Record<string, Profile> = {};
    if (ids.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name, role').in('id', ids);
      profileMap = Object.fromEntries((profs ?? []).map(p => [p.id, p as Profile]));
    }
    setInspections(insp.map(i => ({ ...i, operator: profileMap[i.operator_id], observer: profileMap[i.observer_id] })));
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const canManage = ['admin', 'manager', 'encarregado'].includes(currentUserRole ?? '');

  async function handleToggleStatus(insp: Inspection) {
    const newStatus: InspectionStatus = insp.status === 'open' ? 'closed' : 'open';
    const { error } = await supabase
      .from('behavioral_inspections')
      .update({ status: newStatus })
      .eq('id', insp.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setInspections(prev => prev.map(i => i.id === insp.id ? { ...i, status: newStatus } : i));
    toast.success(newStatus === 'closed' ? 'Inspeção encerrada.' : 'Inspeção reaberta.');
  }

  async function handleDownloadPdf(insp: Inspection) {
    setPageError(null);
    setPdfLoading(prev => new Set(prev).add(insp.id));
    try {
      const [{ data: items }, { data: devs }] = await Promise.all([
        supabase
          .from('behavioral_inspection_items')
          .select('category, description, status')
          .eq('inspection_id', insp.id)
          .order('category'),
        supabase
          .from('behavioral_deviations')
          .select('description, risk_level, immediate_action, immediate_action_description, corrective_action, responsible, deadline, status')
          .eq('inspection_id', insp.id),
      ]);
      generateInspectionPdf(
        {
          ...insp,
          operator_name: insp.operator?.full_name ?? null,
          observer_name: insp.observer?.full_name ?? null,
        },
        items ?? [],
        devs ?? [],
      );
    } catch {
      setPageError('Erro ao gerar PDF.');
    } finally {
      setPdfLoading(prev => { const n = new Set(prev); n.delete(insp.id); return n; });
    }
  }

  async function handleExport() {
    setExporting(true);
    const params = new URLSearchParams({ format: 'csv', from: exportFrom, to: exportTo });
    if (exportOperator) params.set('operator_id', exportOperator);
    if (exportStatusFilter) params.set('status', exportStatusFilter);

    try {
      const res = await fetch(`/api/export/inspections?${params.toString()}`);
      if (!res.ok) {
        const json = await res.json();
        setPageError(json.error ?? 'Erro ao exportar.');
        setExporting(false);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inspecoes_comportamentais_${exportFrom}_${exportTo}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setShowExport(false);
    } catch {
      setPageError('Erro ao exportar.');
    }
    setExporting(false);
  }

  function resetForm() {
    setOperatorId(''); setDate(todayStr()); setTime(timeStr());
    setUnitContract(''); setArea(''); setEquipment(''); setActivityType('');
    setObservationType('routine'); setChecklistAnswers({});
    setDeviations([blankDeviation()]); setSafeBehavior('');
    setHasRisk(null); setClassification('safe'); setSaveError(null);
  }

  async function handleSave() {
    if (!operatorId) { setSaveError('Selecione o colaborador observado.'); return; }
    if (hasRisk === null) { setSaveError('Informe se houve risco na operação.'); return; }
    if (!currentUserId) { setSaveError('Usuário não autenticado.'); return; }
    setSaving(true); setSaveError(null);

    const finalClassification: Classification = hasRisk ? classification : 'safe';

    const { data: insp, error: inspErr } = await supabase
      .from('behavioral_inspections')
      .insert({
        observer_id: currentUserId,
        operator_id: operatorId,
        date: todayStr(),
        time: timeStr(),
        unit_contract: unitContract || null,
        area: area || null,
        equipment: equipment || null,
        activity_type: activityType || null,
        observation_type: observationType,
        overall_classification: finalClassification,
        safe_behavior_description: safeBehavior || null,
        status: 'open',
      })
      .select()
      .single();

    if (inspErr || !insp) {
      console.error('[InspecaoComportamental] insert error:', inspErr?.message);
      setSaveError('Falha ao salvar inspeção. Tente novamente.');
      setSaving(false);
      return;
    }

    // Checklist items
    const itemRows = CATEGORIES.flatMap(cat =>
      CHECKLIST[cat].items.map((desc, idx) => ({
        inspection_id: insp.id,
        category: cat,
        description: desc,
        status: checklistAnswers[`${cat}_${idx}`] ?? 'na',
      }))
    );
    await supabase.from('behavioral_inspection_items').insert(itemRows);

    // Deviations (somente quando houve risco)
    const devRows = (hasRisk ? deviations : [])
      .filter(d => d.description.trim())
      .map(d => ({
        inspection_id: insp.id,
        description: d.description,
        risk_level: d.risk_level,
        immediate_action: d.immediate_action || null,
        immediate_action_description: d.immediate_action_description || null,
        corrective_action: d.corrective_action || null,
        responsible: d.responsible || null,
        deadline: d.deadline || null,
        status: d.status,
      }));
    if (devRows.length > 0) await supabase.from('behavioral_deviations').insert(devRows);

    setSaving(false);
    toast.success('Inspeção registrada.');
    resetForm();
    setView('list');
    load();
  }

  const filteredInspections = useMemo(() => {
    if (filterStatus === 'all') return inspections;
    return inspections.filter(i => (i.status ?? 'open') === filterStatus);
  }, [inspections, filterStatus]);

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Inspeção Comportamental</h1>
            <p className="text-sm text-muted-foreground">Central de monitoramento – Equipe SSMA · Smart Vision 360°</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowExport(!showExport)} className="gap-2">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
            <Button onClick={() => setView('form')} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova inspeção
            </Button>
          </div>
        </div>

        {pageError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {pageError}
          </div>
        )}

        {/* Export panel */}
        {showExport && (
          <Card>
            <CardContent className="pt-5 pb-5">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Exportar Relatório CSV</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">De</Label>
                  <Input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Até</Label>
                  <Input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Colaborador</Label>
                  <Select
                    value={exportOperator}
                    onChange={e => setExportOperator(e.target.value)}
                  >
                    <option value="">Todos</option>
                    {operators.map(op => (
                      <option key={op.id} value={op.id}>{op.full_name ?? op.id}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</Label>
                  <Select
                    value={exportStatusFilter}
                    onChange={e => setExportStatusFilter(e.target.value)}
                  >
                    <option value="">Todos</option>
                    <option value="open">Abertas</option>
                    <option value="closed">Fechadas</option>
                  </Select>
                </div>
              </div>
              <div className="mt-4 flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowExport(false)}>Cancelar</Button>
                <Button size="sm" onClick={handleExport} disabled={exporting} className="gap-2">
                  {exporting && <Loader2 className="h-3 w-3 animate-spin" />}
                  {exporting ? 'Gerando...' : 'Baixar CSV'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status filter tabs */}
        <Tabs value={filterStatus} onValueChange={(v) => setFilterStatus(v as 'all' | 'open' | 'closed')}>
          <TabsList>
            {([
              ['all', 'Todas'],
              ['open', 'Abertas'],
              ['closed', 'Fechadas'],
            ] as ['all' | 'open' | 'closed', string][]).map(([v, l]) => (
              <TabsTrigger key={v} value={v}>
                {l}
                <span className="ml-1.5 text-xs text-muted-foreground">
                  ({v === 'all' ? inspections.length : inspections.filter(i => (i.status ?? 'open') === v).length})
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredInspections.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {filterStatus === 'all' ? 'Nenhuma inspeção registrada ainda.' : `Nenhuma inspeção ${filterStatus === 'open' ? 'aberta' : 'fechada'}.`}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredInspections.map(insp => {
              const isClosed = (insp.status ?? 'open') === 'closed';
              const isOwner = insp.observer_id === currentUserId;
              const canToggle = canManage || isOwner;
              return (
                <Card key={insp.id} className={isClosed ? 'opacity-70' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{insp.operator?.full_name ?? '—'}</span>
                          <ClassificationBadge value={insp.overall_classification} />
                          <ObsTypeBadge value={insp.observation_type} />
                          <InspectionStatusBadge status={insp.status ?? 'open'} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {insp.date}{insp.time ? ` • ${insp.time}` : ''}
                          {insp.observer?.full_name ? ` • Observador: ${insp.observer.full_name}` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDownloadPdf(insp)}
                        disabled={pdfLoading.has(insp.id)}
                        className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                        aria-label="Baixar PDF"
                        title="Baixar PDF"
                      >
                        {pdfLoading.has(insp.id)
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <FileText className="h-4 w-4" />
                        }
                      </button>
                      {canToggle && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleStatus(insp)}
                          className={cn(
                            'gap-1.5 shrink-0',
                            isClosed
                              ? 'border-green-300 text-green-700 hover:bg-green-50'
                              : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                          )}
                        >
                          {isClosed
                            ? <><LockOpen className="h-3.5 w-3.5" />Reabrir</>
                            : <><Lock className="h-3.5 w-3.5" />Fechar</>
                          }
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── FORM VIEW ─────────────────────────────────────────────────────────────
  return (
    <div className={cn(
      'mx-auto pb-12 max-w-3xl',
      operatorId && 'lg:max-w-[1500px]'
    )}>
      <div className="mb-5 space-y-3">
        <Button variant="outline" size="sm" onClick={() => { resetForm(); setView('list'); }} className="gap-1">
          <ChevronLeft className="h-4 w-4" />
          Voltar
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Nova Inspeção Comportamental</h1>
          <p className="text-sm text-muted-foreground">SSMA – Smart Vision 360°</p>
        </div>
      </div>

      <div className={cn(
        operatorId && 'lg:grid lg:grid-cols-[minmax(0,1fr)_570px] lg:gap-6 lg:items-start xl:grid-cols-[minmax(0,1fr)_660px]'
      )}>
      <div className="space-y-5 min-w-0">

      {/* 1. IDENTIFICAÇÃO */}
      <Section title="1. Identificação">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Unidade / Contrato">
            <Input value={unitContract} onChange={e => setUnitContract(e.target.value)} placeholder="Ex: Vale – Contrato 123" />
          </Field>
          <Field label="Área / Frente de trabalho">
            <Select
              value={area}
              onChange={e => setArea(e.target.value)}
            >
              <option value="">Selecione a localidade...</option>
              {locations.map(l => (
                <option key={l.id} value={l.code ? `${l.name} (${l.code})` : l.name}>
                  {l.name}{l.code ? ` — ${l.code}` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Equipamento">
            <Select
              value={equipment}
              onChange={e => setEquipment(e.target.value)}
            >
              <option value="">Selecione o equipamento...</option>
              {machines.map(m => (
                <option key={m.id} value={m.tag ? `${m.name} (${m.tag})` : m.name}>
                  {m.name}{m.tag ? ` — ${m.tag}` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tipo de atividade">
            <Select
              value={activityType}
              onChange={e => setActivityType(e.target.value)}
            >
              <option value="">Selecione o tipo de atividade...</option>
              {activityTypes.map(at => (
                <option key={at.id} value={`${at.code} - ${at.description}`}>
                  {at.code} — {at.description}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Colaborador observado" className="sm:col-span-2">
            <Select
              value={operatorId}
              onChange={e => setOperatorId(e.target.value)}
            >
              <option value="">Selecione o colaborador...</option>
              {operators.map(op => (
                <option key={op.id} value={op.id}>{op.full_name ?? op.id}</option>
              ))}
            </Select>
          </Field>
        </div>
      </Section>

      {/* 2. AVALIAÇÃO DE RISCO */}
      <Section title="2. Houve risco na operação?">
        <div className="space-y-3">
          <div className="flex gap-3 flex-wrap">
            {([
              [true, 'Sim, houve risco', 'border-red-400 bg-red-50 text-red-700'],
              [false, 'Não, operação segura', 'border-green-400 bg-green-50 text-green-700'],
            ] as [boolean, string, string][]).map(([v, l, cls]) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => {
                  setHasRisk(v);
                  setClassification(v ? 'attention' : 'safe');
                }}
                className={cn(
                  'px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-colors',
                  hasRisk === v ? cls : 'border-input bg-background text-muted-foreground'
                )}
              >
                {l}
              </button>
            ))}
          </div>
          {hasRisk === false && (
            <p className="text-sm text-green-700">
              Operação classificada como <strong>Comportamento Seguro</strong>. Os campos de desvio não são necessários.
            </p>
          )}
        </div>
      </Section>

      {/* 3. DESVIOS (somente quando houve risco) */}
      {hasRisk === true && (
      <Section title="3. Desvios / Ação Imediata / Ação Corretiva">
        <div className="space-y-4">
          {deviations.map((dev, idx) => (
            <div key={idx} className="rounded-md border p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Desvio {idx + 1}</p>
                {deviations.length > 1 && (
                  <button
                    type="button"
                    className="text-xs text-destructive hover:underline"
                    onClick={() => setDeviations(deviations.filter((_, i) => i !== idx))}
                  >
                    Remover
                  </button>
                )}
              </div>

              <Field label="Descrição do desvio">
                <Textarea
                  className="min-h-[72px]"
                  value={dev.description}
                  onChange={e => setDeviations(deviations.map((d, i) => i === idx ? { ...d, description: e.target.value } : d))}
                  placeholder="Descreva o desvio observado"
                />
              </Field>

              <Field label="Classificação do risco">
                <div className="flex gap-2 flex-wrap">
                  {([
                    ['low', 'Baixo', 'bg-blue-100 text-blue-700 border-blue-300'],
                    ['medium', 'Médio', 'bg-yellow-100 text-yellow-700 border-yellow-300'],
                    ['high', 'Alto', 'bg-orange-100 text-orange-700 border-orange-300'],
                    ['critical', 'Crítico', 'bg-red-100 text-red-700 border-red-300'],
                  ] as [RiskLevel, string, string][]).map(([v, l, cls]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setDeviations(deviations.map((d, i) => i === idx ? { ...d, risk_level: v } : d))}
                      className={cn('px-3 py-1 rounded-full border text-xs font-semibold transition-colors', dev.risk_level === v ? cls : 'bg-background border-input text-muted-foreground')}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Ação imediata">
                <div className="space-y-1">
                  {([
                    ['verbal_guidance', 'Orientação verbal'],
                    ['activity_intervention', 'Intervenção na atividade'],
                    ['activity_stoppage', 'Paralisação da atividade'],
                    ['immediate_correction', 'Correção imediata realizada'],
                  ] as [ImmediateAction, string][]).map(([v, l]) => (
                    <label key={v} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        checked={dev.immediate_action === v}
                        onChange={() => setDeviations(deviations.map((d, i) => i === idx ? { ...d, immediate_action: v } : d))}
                      />
                      {l}
                    </label>
                  ))}
                </div>
              </Field>

              <Field label="Descrição da ação imediata">
                <Input
                  value={dev.immediate_action_description}
                  onChange={e => setDeviations(deviations.map((d, i) => i === idx ? { ...d, immediate_action_description: e.target.value } : d))}
                  placeholder="Descreva a ação tomada"
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Ação corretiva / preventiva">
                  <Select
                    value={dev.corrective_action}
                    onChange={e => setDeviations(deviations.map((d, i) => i === idx ? { ...d, corrective_action: e.target.value } : d))}
                  >
                    <option value="">Selecione...</option>
                    <option value="corretiva">Corretiva</option>
                    <option value="preventiva">Preventiva</option>
                  </Select>
                </Field>
                <Field label="Responsável">
                  <Select
                    value={dev.responsible}
                    onChange={e => setDeviations(deviations.map((d, i) => i === idx ? { ...d, responsible: e.target.value } : d))}
                  >
                    <option value="">Selecione o responsável...</option>
                    {operators.map(op => (
                      <option key={op.id} value={op.full_name ?? op.id}>{op.full_name ?? op.id}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Prazo">
                  <Input
                    type="date"
                    value={dev.deadline}
                    onChange={e => setDeviations(deviations.map((d, i) => i === idx ? { ...d, deadline: e.target.value } : d))}
                  />
                </Field>
                <Field label="Status">
                  <div className="flex gap-1">
                    {([
                      ['open', 'Aberto'],
                      ['in_progress', 'Em andamento'],
                      ['completed', 'Concluído'],
                    ] as [DeviationStatus, string][]).map(([v, l]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setDeviations(deviations.map((d, i) => i === idx ? { ...d, status: v } : d))}
                        className={cn(
                          'flex-1 py-1.5 rounded border text-xs font-semibold transition-colors',
                          dev.status === v ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input text-muted-foreground'
                        )}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setDeviations([...deviations, blankDeviation()])}
          >
            <Plus className="h-3 w-3" />
            Adicionar desvio
          </Button>
        </div>
      </Section>
      )}

      {/* 4. TIPO DE OBSERVAÇÃO */}
      <Section title="4. Tipo de Observação">
        <div className="space-y-2">
          {([
            ['routine', 'Rotina'],
            ['critical_activity', 'Atividade crítica'],
            ['post_incident', 'Pós-incidente'],
            ['deviation_followup', 'Acompanhamento de desvio'],
            ['scheduled_audit', 'Auditoria comportamental programada'],
          ] as [ObservationType, string][]).map(([v, l]) => (
            <label key={v} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" className="h-4 w-4" checked={observationType === v} onChange={() => setObservationType(v)} />
              {l}
            </label>
          ))}
        </div>
      </Section>

      {/* 5. CHECKLIST COMPORTAMENTAL */}
      <Section title="5. Checklist Comportamental">
        <div className="space-y-6">
          {CATEGORIES.map(cat => (
            <div key={cat}>
              <p className="text-sm font-semibold mb-3">{CHECKLIST[cat].label}</p>
              <div className="space-y-2">
                {CHECKLIST[cat].items.map((item, idx) => {
                  const key = `${cat}_${idx}`;
                  const cur = checklistAnswers[key];
                  return (
                    <div key={key} className="flex items-center justify-between gap-4 rounded-md border p-3">
                      <span className="text-sm flex-1">{item}</span>
                      <div className="flex gap-1 shrink-0">
                        {(['sim', 'nao', 'na'] as ItemStatus[]).map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setChecklistAnswers({ ...checklistAnswers, [key]: s })}
                            className={cn(
                              'px-3 py-1 rounded text-xs font-semibold border transition-colors',
                              cur === s
                                ? s === 'sim' ? 'bg-green-500 border-green-500 text-white'
                                  : s === 'nao' ? 'bg-red-500 border-red-500 text-white'
                                  : 'bg-slate-500 border-slate-500 text-white'
                                : 'bg-background border-input text-muted-foreground hover:bg-muted'
                            )}
                          >
                            {s === 'sim' ? 'Sim' : s === 'nao' ? 'Não' : 'NA'}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* 6. FEEDBACK */}
      <Section title="6. Feedback ao Colaborador">
        <Field label="Comportamento seguro observado / Descrição">
          <Textarea
            className="min-h-[80px]"
            value={safeBehavior}
            onChange={e => setSafeBehavior(e.target.value)}
            placeholder="Descreva comportamentos positivos observados"
          />
        </Field>
      </Section>

      {/* 7. CLASSIFICAÇÃO (somente quando houve risco) */}
      {hasRisk === true && (
      <Section title="7. Classificação da Observação">
        <div className="flex gap-3 flex-wrap">
          {([
            ['attention', 'Oportunidade de Melhoria', 'border-yellow-400 bg-yellow-50 text-yellow-700'],
            ['critical', 'Comportamento de Risco', 'border-red-400 bg-red-50 text-red-700'],
          ] as [Classification, string, string][]).map(([v, l, cls]) => (
            <button
              key={v}
              type="button"
              onClick={() => setClassification(v)}
              className={cn(
                'px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-colors',
                classification === v ? cls : 'border-input bg-background text-muted-foreground'
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </Section>
      )}

      {saveError && <p className="text-sm text-destructive">{saveError}</p>}

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => { resetForm(); setView('list'); }} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? 'Salvando...' : 'Salvar inspeção'}
        </Button>
      </div>
      </div>

      {operatorId && (
        <aside className="mt-6 lg:mt-0 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <OperatorDailySnapshot
            supabase={supabase}
            operatorId={operatorId}
            operatorName={operators.find(o => o.id === operatorId)?.full_name ?? null}
            date={date}
          />
        </aside>
      )}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">{title}</h2>
        {children}
      </CardContent>
    </Card>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</Label>
      {children}
    </div>
  );
}

function ClassificationBadge({ value }: { value: string | null }) {
  if (!value) return null;
  const map: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' }> = {
    safe: { label: 'Comportamento Seguro', variant: 'success' },
    attention: { label: 'Oportunidade de Melhoria', variant: 'warning' },
    critical: { label: 'Comportamento de Risco', variant: 'danger' },
  };
  const m = map[value];
  if (!m) return null;
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

function ObsTypeBadge({ value }: { value: string }) {
  const map: Record<string, string> = {
    routine: 'Rotina',
    critical_activity: 'Atividade crítica',
    post_incident: 'Pós-incidente',
    deviation_followup: 'Acompanhamento de desvio',
    scheduled_audit: 'Auditoria programada',
  };
  return (
    <Badge variant="outline" className="font-normal">
      {map[value] ?? value}
    </Badge>
  );
}

function InspectionStatusBadge({ status }: { status: InspectionStatus }) {
  return status === 'open'
    ? <Badge variant="info">Aberta</Badge>
    : <Badge variant="muted">Fechada</Badge>;
}

// ─── Operator Daily Snapshot ─────────────────────────────────────────────────

interface DayChecklistResponse {
  id: string;
  status: string;
  photo_url: string | null;
  notes: string | null;
  checklist_template_items: { description: string; section: string | null; is_blocking: boolean } | null;
  machine_checklist_items: { description: string; section: string | null; is_blocking: boolean } | null;
}

interface DayChecklist {
  id: string;
  machine_name: string | null;
  tag: string | null;
  result: string | null;
  status: string | null;
  created_at: string;
  equipment_photo_1_url: string | null;
  equipment_photo_2_url: string | null;
  equipment_photo_3_url: string | null;
  equipment_photo_4_url: string | null;
  environment_photo_url: string | null;
  responses?: DayChecklistResponse[];
}

interface DayActivity {
  id: string;
  description: string | null;
  location: string | null;
  equipment_tag: string | null;
  start_time: string | null;
  end_time: string | null;
  had_interference: boolean | null;
  interference_notes: string | null;
  notes: string | null;
  equipment_photo_url: string | null;
  start_photo_url: string | null;
  end_photo_url: string | null;
  activity_types: { code: string; description: string } | null;
}

function OperatorDailySnapshot({
  supabase,
  operatorId,
  operatorName,
  date,
}: {
  supabase: SupabaseClient;
  operatorId: string;
  operatorName: string | null;
  date: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checklists, setChecklists] = useState<DayChecklist[]>([]);
  const [activities, setActivities] = useState<DayActivity[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      setChecklists([]);
      setActivities([]);
      setUrls({});

      const [clRes, actRes] = await Promise.all([
        supabase
          .from('checklists')
          .select('id, machine_name, tag, result, status, created_at, equipment_photo_1_url, equipment_photo_2_url, equipment_photo_3_url, equipment_photo_4_url, environment_photo_url')
          .eq('operator_id', operatorId)
          .eq('date', date)
          .order('created_at', { ascending: false }),
        supabase
          .from('activities')
          .select('id, description, location, equipment_tag, start_time, end_time, had_interference, interference_notes, notes, equipment_photo_url, start_photo_url, end_photo_url, activity_types(code, description)')
          .eq('operator_id', operatorId)
          .eq('date', date)
          .order('created_at', { ascending: false }),
      ]);

      if (cancelled) return;

      if (clRes.error || actRes.error) {
        const msg = clRes.error?.message || actRes.error?.message || 'Erro ao carregar dados.';
        console.error('[OperatorDailySnapshot] fetch error:', msg);
        setError(msg);
        setLoading(false);
        return;
      }

      const rawCls = (clRes.data ?? []) as DayChecklist[];
      const acts = (actRes.data ?? []) as unknown as DayActivity[];

      const respByCl: Record<string, DayChecklistResponse[]> = {};
      if (rawCls.length > 0) {
        const ids = rawCls.map(c => c.id);
        const { data: respData, error: respErr } = await supabase
          .from('checklist_responses')
          .select('id, checklist_id, status, photo_url, notes, checklist_template_items(description, section, is_blocking), machine_checklist_items(description, section, is_blocking)')
          .in('checklist_id', ids);
        if (cancelled) return;
        if (respErr) {
          console.error('[OperatorDailySnapshot] responses error:', respErr.message);
          setError(respErr.message);
          setLoading(false);
          return;
        }
        for (const r of (respData ?? []) as unknown as (DayChecklistResponse & { checklist_id: string })[]) {
          (respByCl[r.checklist_id] ||= []).push(r);
        }
      }

      const cls: DayChecklist[] = rawCls.map(c => ({ ...c, responses: respByCl[c.id] ?? [] }));

      setChecklists(cls);
      setActivities(acts);
      setLoading(false);

      const urlPaths: { key: string; bucket: string; path: string }[] = [];
      for (const c of cls) {
        const cps: [string, string | null][] = [
          [`cl_${c.id}_eq1`, c.equipment_photo_1_url],
          [`cl_${c.id}_eq2`, c.equipment_photo_2_url],
          [`cl_${c.id}_eq3`, c.equipment_photo_3_url],
          [`cl_${c.id}_eq4`, c.equipment_photo_4_url],
          [`cl_${c.id}_env`, c.environment_photo_url],
        ];
        for (const [k, p] of cps) if (p) urlPaths.push({ key: k, bucket: 'checklist-photos', path: p });
        for (const r of c.responses ?? []) {
          if (r.photo_url) urlPaths.push({ key: `resp_${r.id}`, bucket: 'checklist-photos', path: r.photo_url });
        }
      }
      for (const a of acts) {
        const aps: [string, string | null][] = [
          [`act_${a.id}_eq`, a.equipment_photo_url],
          [`act_${a.id}_start`, a.start_photo_url],
          [`act_${a.id}_end`, a.end_photo_url],
        ];
        for (const [k, p] of aps) if (p) urlPaths.push({ key: k, bucket: 'activity-photos', path: p });
      }

      await Promise.all(urlPaths.map(async ({ key, bucket, path }) => {
        const u = await resolveSignedUrl(supabase, bucket, path);
        if (cancelled || !u) return;
        setUrls(prev => ({ ...prev, [key]: u }));
      }));
    }
    load();
    return () => { cancelled = true; };
  }, [supabase, operatorId, date]);

  return (
    <Card>
      <CardContent className="pt-5 pb-5 space-y-4">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Atividade do dia</h2>
          <p className="text-sm font-semibold mt-1">{operatorName ?? '—'}</p>
          <p className="text-xs text-muted-foreground">{date}</p>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? null : (
          <>
            <section>
              <div className="flex items-center gap-2 mb-2">
                <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Checklists ({checklists.length})
                </h3>
              </div>
              {checklists.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhum checklist hoje.</p>
              ) : (
                <div className="space-y-3">
                  {checklists.map(c => (
                    <ChecklistSnapshotCard key={c.id} checklist={c} urls={urls} />
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Atividades ({activities.length})
                </h3>
              </div>
              {activities.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhuma atividade hoje.</p>
              ) : (
                <div className="space-y-3">
                  {activities.map(a => (
                    <ActivitySnapshotCard key={a.id} activity={a} urls={urls} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ChecklistSnapshotCard({ checklist, urls }: { checklist: DayChecklist; urls: Record<string, string> }) {
  const [open, setOpen] = useState(true);
  const resultMap: Record<string, { label: string; cls: string; dot: string }> = {
    released: { label: 'Liberado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    not_released: { label: 'Não Liberado', cls: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
    pending: { label: 'Pendente', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  };
  const key = checklist.status === 'pending' ? 'pending' : (checklist.result ?? 'pending');
  const r = resultMap[key] ?? resultMap.pending;
  const time = new Date(checklist.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const eqPhotos = (['eq1', 'eq2', 'eq3', 'eq4', 'env'] as const)
    .map(k => urls[`cl_${checklist.id}_${k}`])
    .filter(Boolean) as string[];
  const responses = checklist.responses ?? [];
  const ncCount = responses.filter(rp => rp.status === 'NC').length;
  const cCount = responses.filter(rp => rp.status === 'C').length;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-3 py-2 bg-muted/30 border-b flex items-center gap-2">
        <span className={cn('h-2 w-2 rounded-full shrink-0', r.dot)} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate leading-tight">
            {checklist.machine_name ?? '—'}
            {checklist.tag && <span className="text-muted-foreground font-normal"> · {checklist.tag}</span>}
          </p>
          <p className="text-xs text-muted-foreground">{time} · {cCount + ncCount}/{responses.length} respondidos{ncCount > 0 ? ` · ${ncCount} NC` : ''}</p>
        </div>
        <Badge variant="plain" className={cn('shrink-0 border', r.cls)}>
          {r.label}
        </Badge>
      </div>

      {eqPhotos.length > 0 && (
        <div className="p-2 border-b">
          <div className="flex gap-1.5 overflow-x-auto">
            {eqPhotos.map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="shrink-0">
                <img src={u} alt="" className="h-14 w-14 object-cover rounded border" />
              </a>
            ))}
          </div>
        </div>
      )}

      {responses.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="w-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-accent/40 text-left flex items-center justify-between"
          >
            <span>Perguntas ({cCount} C · {ncCount} NC · {responses.length - cCount - ncCount} NA)</span>
            <span>{open ? '−' : '+'}</span>
          </button>
          {open && (
            <div className="px-3 pb-3 space-y-1.5 max-h-80 overflow-y-auto">
              {responses.map(rp => {
                const item = rp.checklist_template_items ?? rp.machine_checklist_items;
                const photo = urls[`resp_${rp.id}`];
                const statusCls = rp.status === 'C'
                  ? 'bg-emerald-100 text-emerald-700'
                  : rp.status === 'NC'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-600';
                return (
                  <div key={rp.id} className="flex items-start gap-2 text-xs py-1 border-b border-border/40 last:border-0">
                    <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-xs font-bold', statusCls)}>
                      {rp.status}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="leading-snug">{item?.description ?? '—'}</p>
                      {item?.is_blocking && rp.status === 'NC' && (
                        <span className="inline-flex items-center gap-1 text-xs text-red-700 mt-0.5">
                          <AlertTriangle className="h-3 w-3" /> Bloqueante
                        </span>
                      )}
                      {rp.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{rp.notes}</p>}
                    </div>
                    {photo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <a href={photo} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        <img src={photo} alt="" className="h-12 w-12 object-cover rounded border" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ActivitySnapshotCard({ activity, urls }: { activity: DayActivity; urls: Record<string, string> }) {
  const photos = (['eq', 'start', 'end'] as const)
    .map(k => ({ k, url: urls[`act_${activity.id}_${k}`] }))
    .filter(p => p.url) as { k: string; url: string }[];
  const typeLabel = activity.activity_types
    ? `${activity.activity_types.code} — ${activity.activity_types.description}`
    : (activity.description ?? '—');
  const time = [activity.start_time, activity.end_time].filter(Boolean).join(' → ') || '—';
  const photoLabel: Record<string, string> = { eq: 'Equip.', start: 'Início', end: 'Fim' };

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-3 py-2 bg-muted/30 border-b flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate leading-tight">{typeLabel}</p>
          <p className="text-xs text-muted-foreground truncate">
            {time}{activity.location ? ` · ${activity.location}` : ''}
            {activity.equipment_tag ? ` · ${activity.equipment_tag}` : ''}
          </p>
        </div>
        {activity.had_interference && (
          <Badge variant="warning" className="shrink-0">
            <AlertTriangle className="h-3 w-3" /> Interf.
          </Badge>
        )}
      </div>

      {photos.length > 0 && (
        <div className="p-2 border-b">
          <div className="grid grid-cols-3 gap-1.5">
            {photos.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <a key={p.k} href={p.url} target="_blank" rel="noopener noreferrer" className="block relative">
                <img src={p.url} alt="" className="w-full h-20 object-cover rounded border" />
                <span className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 py-0.5 text-xs font-semibold text-white">
                  {photoLabel[p.k]}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {(activity.description && activity.activity_types) || activity.notes || (activity.had_interference && activity.interference_notes) ? (
        <div className="p-3 space-y-2 text-xs">
          {activity.description && activity.activity_types && (
            <p>{activity.description}</p>
          )}
          {activity.notes && (
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Obs: </span>
              <span>{activity.notes}</span>
            </div>
          )}
          {activity.had_interference && activity.interference_notes && (
            <div className="rounded bg-orange-50 border border-orange-200 px-2 py-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-orange-700">Interferência: </span>
              <span className="text-orange-900">{activity.interference_notes}</span>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
