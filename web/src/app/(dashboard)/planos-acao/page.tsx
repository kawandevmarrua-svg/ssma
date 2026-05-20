'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/modal';
import {
  Loader2,
  Plus,
  Search,
  Clock,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  X,
  GripVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Priority = 'low' | 'medium' | 'high' | 'critical';
type Status = 'open' | 'in_progress' | 'completed' | 'verified' | 'cancelled';
type OriginType = 'checklist_nc' | 'behavioral_deviation' | 'maintenance' | 'manual';
type Category = 'corrective' | 'preventive' | 'improvement';

interface Profile { id: string; full_name: string | null }

interface ActionPlan {
  id: string;
  title: string;
  description: string | null;
  origin_type: OriginType;
  origin_id: string | null;
  checklist_id: string | null;
  inspection_id: string | null;
  machine_id: string | null;
  priority: Priority;
  status: Status;
  category: Category | null;
  responsible_id: string | null;
  created_by: string;
  verified_by: string | null;
  deadline: string | null;
  completed_at: string | null;
  verified_at: string | null;
  root_cause: string | null;
  corrective_action: string | null;
  preventive_action: string | null;
  evidence_notes: string | null;
  created_at: string;
  updated_at: string;
  responsible?: Profile;
  creator?: Profile;
}

const PRIORITY: Record<Priority, { label: string; color: string; border: string }> = {
  low:      { label: 'Baixa',   color: 'text-sky-600',    border: 'border-l-sky-400' },
  medium:   { label: 'Média',   color: 'text-amber-600',  border: 'border-l-amber-400' },
  high:     { label: 'Alta',    color: 'text-orange-600', border: 'border-l-orange-400' },
  critical: { label: 'Crítica', color: 'text-red-600',    border: 'border-l-red-500' },
};

const COLUMNS: { key: Status; label: string; dot: string }[] = [
  { key: 'open',        label: 'Aberto',       dot: 'bg-slate-400' },
  { key: 'in_progress', label: 'Em andamento',  dot: 'bg-blue-500' },
  { key: 'completed',   label: 'Concluído',     dot: 'bg-emerald-500' },
  { key: 'verified',    label: 'Verificado',    dot: 'bg-emerald-700' },
];

const STATUS_FLOW: Status[] = ['open', 'in_progress', 'completed', 'verified'];

const STATUS_LABELS: Record<Status, string> = {
  open: 'Aberto', in_progress: 'Em andamento', completed: 'Concluído',
  verified: 'Verificado', cancelled: 'Cancelado',
};

const ORIGIN_LABELS: Record<OriginType, string> = {
  checklist_nc: 'NC Checklist', behavioral_deviation: 'Desvio Comportamental',
  maintenance: 'Manutenção', manual: 'Manual',
};

const CATEGORY_LABELS: Record<Category, string> = {
  corrective: 'Corretiva', preventive: 'Preventiva', improvement: 'Melhoria',
};

function today() { return new Date().toISOString().slice(0, 10); }

export default function PlanosAcaoPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<ActionPlan[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);

  // Drag & drop
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<Status | null>(null);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ActionPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '', description: '', origin_type: 'manual' as OriginType,
    priority: 'medium' as Priority, status: 'open' as Status,
    category: '' as string, responsible_id: '', deadline: '',
    root_cause: '', corrective_action: '', preventive_action: '', evidence_notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [userRes, plansRes, usersRes] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('action_plans').select('*').order('priority').order('created_at', { ascending: false }).limit(500),
      supabase.from('profiles').select('id, full_name').eq('active', true).order('full_name'),
    ]);
    setCurrentUserId(userRes.data.user?.id ?? null);
    setUsers((usersRes.data ?? []) as Profile[]);

    const raw = (plansRes.data ?? []) as ActionPlan[];
    const ids = [...new Set(raw.flatMap((p) => [p.responsible_id, p.created_by].filter(Boolean)))];
    let pm: Record<string, Profile> = {};
    if (ids.length) {
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', ids);
      pm = Object.fromEntries((data ?? []).map((p) => [p.id, p as Profile]));
    }
    setPlans(raw.map((p) => ({ ...p, responsible: p.responsible_id ? pm[p.responsible_id] : undefined, creator: pm[p.created_by] })));
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setForm({ title: '', description: '', origin_type: 'manual', priority: 'medium', status: 'open', category: '', responsible_id: '', deadline: '', root_cause: '', corrective_action: '', preventive_action: '', evidence_notes: '' });
    setSaveError(null);
  }

  function openCreate(status: Status = 'open') {
    resetForm();
    setForm((f) => ({ ...f, status }));
    setEditingPlan(null);
    setModalOpen(true);
  }

  function openEdit(plan: ActionPlan) {
    setEditingPlan(plan);
    setForm({
      title: plan.title, description: plan.description ?? '', origin_type: plan.origin_type,
      priority: plan.priority, status: plan.status, category: plan.category ?? '',
      responsible_id: plan.responsible_id ?? '', deadline: plan.deadline ?? '',
      root_cause: plan.root_cause ?? '', corrective_action: plan.corrective_action ?? '',
      preventive_action: plan.preventive_action ?? '', evidence_notes: plan.evidence_notes ?? '',
    });
    setSaveError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim()) { setSaveError('Titulo obrigatorio.'); return; }
    if (!currentUserId) { setSaveError('Usuario nao autenticado.'); return; }
    setSaving(true);
    setSaveError(null);

    const isCompleting = form.status === 'completed' || form.status === 'verified';
    const wasCompleted = editingPlan && (editingPlan.status === 'completed' || editingPlan.status === 'verified') && editingPlan.completed_at;

    const payload = {
      title: form.title.trim(), description: form.description.trim() || null,
      origin_type: form.origin_type, priority: form.priority, status: form.status,
      category: (form.category as Category) || null, responsible_id: form.responsible_id || null,
      deadline: form.deadline || null, root_cause: form.root_cause.trim() || null,
      corrective_action: form.corrective_action.trim() || null,
      preventive_action: form.preventive_action.trim() || null,
      evidence_notes: form.evidence_notes.trim() || null,
      completed_at: isCompleting ? (wasCompleted ? editingPlan.completed_at : new Date().toISOString()) : null,
    };

    const res = editingPlan
      ? await supabase.from('action_plans').update(payload).eq('id', editingPlan.id)
      : await supabase.from('action_plans').insert({ ...payload, created_by: currentUserId });

    if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    setSaving(false);
    setModalOpen(false);
    toast.success(editingPlan ? 'Plano de ação atualizado.' : 'Plano de ação criado.');
    load();
  }

  async function changeStatus(plan: ActionPlan, newStatus: Status) {
    if (plan.status === newStatus) return;

    const upd: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'completed' && !plan.completed_at) upd.completed_at = new Date().toISOString();
    if (newStatus === 'verified') { upd.verified_at = new Date().toISOString(); upd.verified_by = currentUserId; }
    if (newStatus === 'open' || newStatus === 'in_progress') { upd.completed_at = null; upd.verified_at = null; upd.verified_by = null; }

    // Optimistic update
    setPlans((prev) => prev.map((p) => (p.id === plan.id ? { ...p, status: newStatus, ...upd } as ActionPlan : p)));

    const { error } = await supabase.from('action_plans').update(upd).eq('id', plan.id);
    if (error) {
      toast.error('Falha ao atualizar status.');
      load(); // Revert on error
    }
  }

  function moveStatus(plan: ActionPlan, direction: 'next' | 'prev') {
    const idx = STATUS_FLOW.indexOf(plan.status);
    if (idx === -1) return;
    const ni = direction === 'next' ? idx + 1 : idx - 1;
    if (ni < 0 || ni >= STATUS_FLOW.length) return;
    changeStatus(plan, STATUS_FLOW[ni]);
  }

  // Drag handlers
  function handleDragStart(e: React.DragEvent, planId: string) {
    setDraggingId(planId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', planId);
  }

  function handleDragOver(e: React.DragEvent, colStatus: Status) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropTarget !== colStatus) setDropTarget(colStatus);
  }

  function handleDragLeave(e: React.DragEvent, colStatus: Status) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const { clientX, clientY } = e;
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      if (dropTarget === colStatus) setDropTarget(null);
    }
  }

  function handleDrop(e: React.DragEvent, colStatus: Status) {
    e.preventDefault();
    setDropTarget(null);
    setDraggingId(null);
    const planId = e.dataTransfer.getData('text/plain');
    const plan = plans.find((p) => p.id === planId);
    if (plan && plan.status !== colStatus) {
      changeStatus(plan, colStatus);
    }
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDropTarget(null);
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return plans;
    const q = search.toLowerCase();
    return plans.filter((p) =>
      p.title.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q) || p.responsible?.full_name?.toLowerCase().includes(q));
  }, [plans, search]);

  const overdue = useMemo(() => plans.filter((p) => p.deadline && !['completed', 'verified', 'cancelled'].includes(p.status) && p.deadline < today()).length, [plans]);
  const cancelledPlans = useMemo(() => plans.filter((p) => p.status === 'cancelled'), [plans]);

  const columns = useMemo(() => COLUMNS.map((c) => ({
    ...c,
    items: filtered.filter((p) => p.status === c.key).sort((a, b) => {
      const ord: Priority[] = ['critical', 'high', 'medium', 'low'];
      return ord.indexOf(a.priority) - ord.indexOf(b.priority);
    }),
  })), [filtered]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Planos de Ação</h1>
          {overdue > 0 && (
            <p className="text-xs text-red-600 flex items-center gap-1 mt-0.5">
              <AlertTriangle className="h-3 w-3" />
              {overdue} atrasado{overdue > 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-8 w-48 pl-8 text-xs" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearch('')}
                className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <Button size="sm" onClick={() => openCreate()} className="h-8 gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" />
            Novo
          </Button>
        </div>
      </div>

      {/* Board */}
      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2" style={{ minHeight: 'calc(100vh - 180px)' }}>
          {columns.map((col) => (
            <div
              key={col.key}
              className={cn(
                'flex flex-col shrink-0 w-[280px] xl:flex-1 xl:min-w-[260px] rounded-lg border border-border bg-white transition-colors',
                dropTarget === col.key && draggingId && 'bg-primary/5 ring-2 ring-primary/20',
              )}
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDragLeave={(e) => handleDragLeave(e, col.key)}
              onDrop={(e) => handleDrop(e, col.key)}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className={cn('h-2.5 w-2.5 rounded-full', col.dot)} />
                  <span className="text-sm font-semibold text-foreground">{col.label}</span>
                  <span className="inline-flex items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground min-w-[1.25rem]">{col.items.length}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openCreate(col.key)}
                  className="h-6 w-6 text-muted-foreground/40 hover:text-muted-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Cards */}
              <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                {col.items.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground/50 py-16">
                    {dropTarget === col.key ? 'Soltar aqui' : 'Nenhum plano'}
                  </p>
                ) : (
                  col.items.map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      isDragging={draggingId === plan.id}
                      onEdit={() => openEdit(plan)}
                      onMove={(d) => moveStatus(plan, d)}
                      onDragStart={(e) => handleDragStart(e, plan.id)}
                      onDragEnd={handleDragEnd}
                      canPrev={STATUS_FLOW.indexOf(plan.status) > 0}
                      canNext={STATUS_FLOW.indexOf(plan.status) < STATUS_FLOW.length - 1}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cancelled */}
      {cancelledPlans.length > 0 && (
        <div className="pt-2 border-t">
          <button type="button" onClick={() => setShowCancelled(!showCancelled)} className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors">
            {showCancelled ? 'Ocultar' : 'Mostrar'} {cancelledPlans.length} cancelado{cancelledPlans.length > 1 ? 's' : ''}
          </button>
          {showCancelled && (
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {cancelledPlans.map((p) => (
                <button type="button" key={p.id} onClick={() => openEdit(p)} className="text-left rounded-md border border-dashed p-2.5 opacity-40 hover:opacity-60 transition-opacity">
                  <p className="text-xs line-through truncate">{p.title}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingPlan ? 'Editar Plano' : 'Novo Plano'}>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <Field label="Título *">
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Descreva o plano de ação" />
            </Field>

            <Field label="Descrição">
              <Textarea className="min-h-[64px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Prioridade">
                <div className="flex gap-1">
                  {(Object.entries(PRIORITY) as [Priority, (typeof PRIORITY)[Priority]][]).map(([k, v]) => (
                    <button key={k} type="button" onClick={() => setForm({ ...form, priority: k })}
                      className={cn('flex-1 py-1.5 rounded text-xs font-medium border transition-all',
                        form.priority === k ? cn(v.color, 'border-current bg-current/5 ring-1 ring-current/20') : 'border-input text-muted-foreground hover:border-muted-foreground/30')}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Status">
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Status })}>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                </Select>
              </Field>

              <Field label="Origem">
                <Select value={form.origin_type} onChange={(e) => setForm({ ...form, origin_type: e.target.value as OriginType })}>
                  {Object.entries(ORIGIN_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                </Select>
              </Field>

              <Field label="Categoria">
                <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="">—</option>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                </Select>
              </Field>

              <Field label="Responsável">
                <Select value={form.responsible_id} onChange={(e) => setForm({ ...form, responsible_id: e.target.value })}>
                  <option value="">—</option>
                  {users.map((u) => (<option key={u.id} value={u.id}>{u.full_name ?? u.id}</option>))}
                </Select>
              </Field>

              <Field label="Prazo">
                <Input type="date" className="h-9" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
              </Field>
            </div>

            <Field label="Causa raiz">
              <Textarea className="min-h-[56px]" value={form.root_cause} onChange={(e) => setForm({ ...form, root_cause: e.target.value })} placeholder="5 Porquês, Ishikawa..." />
            </Field>

            <Field label="Ação corretiva">
              <Textarea className="min-h-[56px]" value={form.corrective_action} onChange={(e) => setForm({ ...form, corrective_action: e.target.value })} />
            </Field>

            <Field label="Ação preventiva">
              <Textarea className="min-h-[56px]" value={form.preventive_action} onChange={(e) => setForm({ ...form, preventive_action: e.target.value })} />
            </Field>

            <Field label="Evidências">
              <Textarea className="min-h-[56px]" value={form.evidence_notes} onChange={(e) => setForm({ ...form, evidence_notes: e.target.value })} />
            </Field>

            {saveError && <p className="text-xs text-destructive">{saveError}</p>}

            <div className="flex gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {saving ? 'Salvando...' : editingPlan ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ── Card ──────────────────────────────────────────────────────────── */

function PlanCard({ plan, isDragging, onEdit, onMove, onDragStart, onDragEnd, canPrev, canNext }: {
  plan: ActionPlan; isDragging: boolean; onEdit: () => void;
  onMove: (d: 'next' | 'prev') => void;
  onDragStart: (e: React.DragEvent) => void; onDragEnd: () => void;
  canPrev: boolean; canNext: boolean;
}) {
  const pr = PRIORITY[plan.priority];
  const overdue = plan.deadline && !['completed', 'verified', 'cancelled'].includes(plan.status) && plan.deadline < today();

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onEdit}
      className={cn(
        'group rounded-md border border-border/60 border-l-2 bg-white p-2.5 cursor-grab active:cursor-grabbing transition-all hover:border-border',
        pr.border,
        overdue && 'ring-1 ring-red-200',
        isDragging && 'opacity-30 scale-95',
      )}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug line-clamp-2">{plan.title}</p>

          <div className="flex items-center gap-2 mt-1.5">
            <span className={cn('text-xs font-medium', pr.color)}>{pr.label}</span>
            {plan.origin_type !== 'manual' && (
              <span className="text-xs text-muted-foreground/50">{ORIGIN_LABELS[plan.origin_type]}</span>
            )}
          </div>

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2 min-w-0">
              {plan.responsible?.full_name && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {plan.responsible.full_name.charAt(0).toUpperCase()}
                  </span>
                  <span className="truncate max-w-[100px]">{plan.responsible.full_name}</span>
                </span>
              )}
              {plan.deadline && (
                <span className={cn('flex items-center gap-0.5 text-xs shrink-0', overdue ? 'text-red-500 font-medium' : 'text-muted-foreground/50')}>
                  <Clock className="h-2.5 w-2.5" />
                  {new Date(plan.deadline + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </span>
              )}
            </div>

            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                disabled={!canPrev}
                onClick={() => onMove('prev')}
                className={cn('h-6 w-6', canPrev ? 'text-muted-foreground hover:text-foreground' : 'text-transparent')}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={!canNext}
                onClick={() => onMove('next')}
                className={cn('h-6 w-6', canNext ? 'text-muted-foreground hover:text-foreground' : 'text-transparent')}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Field ─────────────────────────────────────────────────────────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
