'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

type ObservationType = 'routine' | 'critical_activity' | 'post_incident' | 'deviation_followup' | 'scheduled_audit';
type ItemStatus = 'sim' | 'nao' | 'na';
type Category = 'risk_perception' | 'attitude' | 'ppe' | 'operation' | 'communication' | 'environment';
type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
type ImmediateAction = 'verbal_guidance' | 'activity_intervention' | 'activity_stoppage' | 'immediate_correction';
type DeviationStatus = 'open' | 'in_progress' | 'completed';
type Classification = 'safe' | 'attention' | 'critical';

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
  const [loading, setLoading] = useState(true);

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
  const [classification, setClassification] = useState<Classification>('safe');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [userRes, opsRes, inspsRes, machinesRes, actTypesRes, locationsRes] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('profiles').select('id, full_name, role').order('full_name'),
      supabase.from('behavioral_inspections').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('machines').select('id, name, tag').eq('active', true).order('name'),
      supabase.from('activity_types').select('id, code, description').eq('active', true).order('order_index'),
      supabase.from('locations').select('id, name, code').eq('active', true).order('name'),
    ]);

    setCurrentUserId(userRes.data.user?.id ?? null);
    setOperators((opsRes.data ?? []) as Profile[]);
    setMachines((machinesRes.data ?? []) as Machine[]);
    setActivityTypes((actTypesRes.data ?? []) as ActivityType[]);
    setLocations((locationsRes.data ?? []) as Location[]);

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

  function resetForm() {
    setOperatorId(''); setDate(todayStr()); setTime(timeStr());
    setUnitContract(''); setArea(''); setEquipment(''); setActivityType('');
    setObservationType('routine'); setChecklistAnswers({});
    setDeviations([blankDeviation()]); setSafeBehavior('');
    setClassification('safe'); setSaveError(null);
  }

  async function handleSave() {
    if (!operatorId) { setSaveError('Selecione o colaborador observado.'); return; }
    if (!currentUserId) { setSaveError('Usuário não autenticado.'); return; }
    setSaving(true); setSaveError(null);

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
        overall_classification: classification,
        safe_behavior_description: safeBehavior || null,
      })
      .select()
      .single();

    if (inspErr || !insp) {
      setSaveError(inspErr?.message ?? 'Erro ao salvar inspeção.');
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

    // Deviations
    const devRows = deviations
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
    resetForm();
    setView('list');
    load();
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Inspeção Comportamental</h1>
            <p className="text-sm text-muted-foreground">Central de monitoramento – Equipe SSMA · Smart Vision 360°</p>
          </div>
          <Button onClick={() => setView('form')} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova inspeção
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : inspections.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhuma inspeção registrada ainda.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {inspections.map(insp => (
              <Card key={insp.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{insp.operator?.full_name ?? '—'}</span>
                        <ClassificationBadge value={insp.overall_classification} />
                        <ObsTypeBadge value={insp.observation_type} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {insp.date}{insp.time ? ` • ${insp.time}` : ''}
                        {insp.observer?.full_name ? ` • Observador: ${insp.observer.full_name}` : ''}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── FORM VIEW ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-3xl mx-auto pb-12">
      <div className="fixed top-4 left-4 z-50">
        <Button variant="outline" size="sm" onClick={() => { resetForm(); setView('list'); }} className="gap-1 shadow-md">
          <ChevronLeft className="h-4 w-4" />
          Voltar
        </Button>
      </div>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Nova Inspeção Comportamental</h1>
        <p className="text-sm text-muted-foreground">SSMA – Smart Vision 360°</p>
      </div>

      {/* 1. IDENTIFICAÇÃO */}
      <Section title="1. Identificação">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Unidade / Contrato">
            <Input value={unitContract} onChange={e => setUnitContract(e.target.value)} placeholder="Ex: Vale – Contrato 123" />
          </Field>
          <Field label="Área / Frente de trabalho">
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={area}
              onChange={e => setArea(e.target.value)}
            >
              <option value="">Selecione a localidade...</option>
              {locations.map(l => (
                <option key={l.id} value={l.code ? `${l.name} (${l.code})` : l.name}>
                  {l.name}{l.code ? ` — ${l.code}` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Equipamento">
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={equipment}
              onChange={e => setEquipment(e.target.value)}
            >
              <option value="">Selecione o equipamento...</option>
              {machines.map(m => (
                <option key={m.id} value={m.tag ? `${m.name} (${m.tag})` : m.name}>
                  {m.name}{m.tag ? ` — ${m.tag}` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tipo de atividade">
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={activityType}
              onChange={e => setActivityType(e.target.value)}
            >
              <option value="">Selecione o tipo de atividade...</option>
              {activityTypes.map(at => (
                <option key={at.id} value={`${at.code} - ${at.description}`}>
                  {at.code} — {at.description}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Colaborador observado" className="sm:col-span-2">
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={operatorId}
              onChange={e => setOperatorId(e.target.value)}
            >
              <option value="">Selecione o colaborador...</option>
              {operators.map(op => (
                <option key={op.id} value={op.id}>{op.full_name ?? op.id}</option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      {/* 2. TIPO DE OBSERVAÇÃO */}
      <Section title="2. Tipo de Observação">
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

      {/* 3. CHECKLIST COMPORTAMENTAL */}
      <Section title="3. Checklist Comportamental">
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

      {/* 4-6. DESVIOS */}
      <Section title="4–6. Desvios / Ação Imediata / Ação Corretiva">
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
                <textarea
                  className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={dev.corrective_action}
                    onChange={e => setDeviations(deviations.map((d, i) => i === idx ? { ...d, corrective_action: e.target.value } : d))}
                  >
                    <option value="">Selecione...</option>
                    <option value="corretiva">Corretiva</option>
                    <option value="preventiva">Preventiva</option>
                  </select>
                </Field>
                <Field label="Responsável">
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={dev.responsible}
                    onChange={e => setDeviations(deviations.map((d, i) => i === idx ? { ...d, responsible: e.target.value } : d))}
                  >
                    <option value="">Selecione o responsável...</option>
                    {operators.map(op => (
                      <option key={op.id} value={op.full_name ?? op.id}>{op.full_name ?? op.id}</option>
                    ))}
                  </select>
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

      {/* 7. FEEDBACK */}
      <Section title="7. Feedback ao Colaborador">
        <Field label="Comportamento seguro observado / Descrição">
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={safeBehavior}
            onChange={e => setSafeBehavior(e.target.value)}
            placeholder="Descreva comportamentos positivos observados"
          />
        </Field>
      </Section>

      {/* 8. CLASSIFICAÇÃO */}
      <Section title="8. Classificação da Observação">
        <div className="flex gap-3 flex-wrap">
          {([
            ['safe', 'Comportamento Seguro', 'border-green-400 bg-green-50 text-green-700'],
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
  const map: Record<string, { label: string; className: string }> = {
    safe: { label: 'Comportamento Seguro', className: 'bg-green-100 text-green-700 border-green-200' },
    attention: { label: 'Oportunidade de Melhoria', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    critical: { label: 'Comportamento de Risco', className: 'bg-red-100 text-red-700 border-red-200' },
  };
  const m = map[value];
  if (!m) return null;
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold', m.className)}>
      {m.label}
    </span>
  );
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
    <span className="inline-flex items-center rounded-full border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      {map[value] ?? value}
    </span>
  );
}
