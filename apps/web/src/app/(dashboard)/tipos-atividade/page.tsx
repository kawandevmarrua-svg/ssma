'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useConfirm } from '@/components/confirm-provider';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/modal';
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Search,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  ListChecks,
  Copy,
} from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';

type Category = 'parada' | 'servico' | 'outro';

interface ActivityType {
  id: string;
  code: string;
  description: string;
  category: Category;
  allow_custom: boolean;
  active: boolean;
  order_index: number;
  use_custom_questions: boolean;
  created_at: string;
}

interface ActivityQuestion {
  id: string;
  key: string | null;
  label: string;
  critical: boolean;
  order_index: number;
  active: boolean;
  activity_type_id: string | null;
  is_global: boolean;
}

const CATEGORY_LABELS: Record<Category, string> = {
  parada: 'Paradas (P)',
  servico: 'Servicos (S)',
  outro: 'Outros',
};

export default function TiposAtividadePage() {
  const supabase = useMemo(() => createClient(), []);
  const confirm = useConfirm();
  const [items, setItems] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ActivityType | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<Category | ''>('');

  // Perguntas por tipo (apenas servicos)
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [questionsByType, setQuestionsByType] = useState<Record<string, ActivityQuestion[]>>({});
  const [questionsLoadingId, setQuestionsLoadingId] = useState<string | null>(null);
  const [questionModal, setQuestionModal] = useState<{ type: ActivityType; question: ActivityQuestion | null } | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('activity_types')
      .select('*')
      .order('category', { ascending: true })
      .order('order_index', { ascending: true });
    setItems((data as ActivityType[] | null) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const loadQuestionsFor = useCallback(async (typeId: string) => {
    setQuestionsLoadingId(typeId);
    const { data } = await supabase
      .from('activity_questions')
      .select('*')
      .eq('activity_type_id', typeId)
      .order('order_index', { ascending: true });
    setQuestionsByType((prev) => ({ ...prev, [typeId]: (data as ActivityQuestion[]) ?? [] }));
    setQuestionsLoadingId(null);
  }, [supabase]);

  const toggleExpand = useCallback(async (t: ActivityType) => {
    if (expandedId === t.id) { setExpandedId(null); return; }
    setExpandedId(t.id);
    if (!questionsByType[t.id]) await loadQuestionsFor(t.id);
  }, [expandedId, questionsByType, loadQuestionsFor]);

  async function toggleActive(t: ActivityType) {
    await supabase.from('activity_types').update({ active: !t.active }).eq('id', t.id);
    load();
  }

  async function toggleUseCustom(t: ActivityType) {
    const next = !t.use_custom_questions;
    const { error } = await supabase
      .from('activity_types')
      .update({ use_custom_questions: next })
      .eq('id', t.id);
    if (error) { toast.error('Falha ao alterar modo de perguntas.'); return; }
    setItems((prev) => prev.map((x) => (x.id === t.id ? { ...x, use_custom_questions: next } : x)));
    if (next) {
      setExpandedId(t.id);
      if (!questionsByType[t.id]) await loadQuestionsFor(t.id);
    }
    toast.success(next ? 'Usando perguntas personalizadas deste tipo.' : 'Voltou a usar as perguntas globais.');
  }

  async function copyGlobals(t: ActivityType) {
    const existing = questionsByType[t.id] ?? [];
    const ok = await confirm({
      title: 'Copiar perguntas globais?',
      description: existing.length > 0
        ? `As ${existing.length} pergunta(s) atuais deste tipo serao mantidas e as globais serao adicionadas ao final.`
        : 'As perguntas globais serao copiadas como ponto de partida. Voce pode editar livremente depois.',
      confirmText: 'Copiar',
    });
    if (!ok) return;
    const { data: globals } = await supabase
      .from('activity_questions')
      .select('label, critical, order_index')
      .eq('is_global', true)
      .is('activity_type_id', null)
      .order('order_index', { ascending: true });
    if (!globals || globals.length === 0) {
      toast.error('Nenhuma pergunta global cadastrada para copiar.');
      return;
    }
    const base = existing.length > 0 ? Math.max(...existing.map((q) => q.order_index)) : 0;
    const payload = globals.map((g, i) => ({
      label: g.label,
      critical: g.critical,
      order_index: base + i + 1,
      active: true,
      activity_type_id: t.id,
      is_global: false,
    }));
    const { error } = await supabase.from('activity_questions').insert(payload);
    if (error) { toast.error('Falha ao copiar perguntas globais.'); return; }
    await loadQuestionsFor(t.id);
    toast.success(`${payload.length} pergunta(s) copiada(s).`);
  }

  async function deleteQuestion(t: ActivityType, q: ActivityQuestion) {
    const ok = await confirm({
      title: 'Excluir pergunta?',
      description: `"${q.label.slice(0, 80)}${q.label.length > 80 ? '...' : ''}". As respostas existentes serao mantidas.`,
      confirmText: 'Excluir',
      variant: 'destructive',
    });
    if (!ok) return;
    const { error } = await supabase.from('activity_questions').delete().eq('id', q.id);
    if (error) { toast.error('Falha ao excluir pergunta.'); return; }
    await loadQuestionsFor(t.id);
    toast.success('Pergunta excluida.');
  }

  async function handleDelete(t: ActivityType) {
    const ok = await confirm({
      title: 'Excluir tipo de atividade?',
      description: `${t.code} — ${t.description}. Atividades já registradas manterão a referência (ON DELETE SET NULL).`,
      confirmText: 'Excluir',
      variant: 'destructive',
    });
    if (!ok) return;
    const { error } = await supabase.from('activity_types').delete().eq('id', t.id);
    if (error) {
      toast.error('Falha ao excluir tipo de atividade.');
      return;
    }
    load();
    toast.success('Tipo de atividade excluído.');
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((t) => {
      if (filterCategory && t.category !== filterCategory) return false;
      if (!term) return true;
      return t.code.toLowerCase().includes(term) || t.description.toLowerCase().includes(term);
    });
  }, [items, search, filterCategory]);

  const sectioned = useMemo(() => {
    const map = new Map<Category, ActivityType[]>();
    for (const t of filtered) {
      const arr = map.get(t.category) ?? [];
      arr.push(t);
      map.set(t.category, arr);
    }
    return Array.from(map, ([category, list]) => ({ category, list }));
  }, [filtered]);

  function getNextOrder(typeId: string) {
    const existing = questionsByType[typeId] || [];
    return existing.length > 0 ? Math.max(...existing.map((q) => q.order_index)) + 1 : 1;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Tipos de Atividade</h1>
          <p className="text-sm text-muted-foreground">
            Codigos P (Paradas) e S (Servicos) usados pelo operador no app mobile.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo tipo
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por codigo ou descricao..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value as Category | '')}
          className="sm:w-auto sm:min-w-[180px]"
        >
          <option value="">Todas as categorias</option>
          <option value="parada">Paradas (P)</option>
          <option value="servico">Servicos (S)</option>
          <option value="outro">Outros</option>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {items.length === 0 ? 'Nenhum tipo cadastrado.' : 'Nenhum tipo encontrado.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sectioned.map(({ category, list }) => (
            <div key={category} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {CATEGORY_LABELS[category]} <span className="text-muted-foreground/60">({list.length})</span>
              </h2>
              <div className="space-y-2">
                {list.map((t) => {
                  const isServico = t.category === 'servico';
                  const expanded = expandedId === t.id;
                  const questions = questionsByType[t.id] || [];
                  const isLoadingQ = questionsLoadingId === t.id;
                  return (
                  <Card key={t.id} className={!t.active ? 'opacity-60' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        {isServico ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                            title={expanded ? 'Ocultar perguntas' : 'Mostrar perguntas'}
                            onClick={() => toggleExpand(t)}
                          >
                            {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                          </Button>
                        ) : (
                          <span className="w-8 shrink-0" />
                        )}
                        <span className="inline-flex shrink-0 items-center rounded bg-primary/10 px-2 py-1 text-xs font-mono font-bold text-primary">
                          {t.code}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{t.description}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>Ordem #{t.order_index}</span>
                            <span>·</span>
                            <button
                              type="button"
                              onClick={() => toggleActive(t)}
                              className="underline-offset-2 hover:underline"
                            >
                              {t.active ? 'Ativo' : 'Inativo'}
                            </button>
                            {t.allow_custom && (
                              <>
                                <span>·</span>
                                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                                  TEXTO LIVRE
                                </span>
                              </>
                            )}
                            {isServico && (
                              <>
                                <span>·</span>
                                <span className="flex items-center gap-1">
                                  <ListChecks className="h-3 w-3" />
                                  {t.use_custom_questions ? 'Perguntas proprias' : 'Perguntas globais'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditing(t)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            aria-label="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(t)}
                            className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            aria-label="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {isServico && expanded && (
                        <div className="mt-4 border-t pt-4 space-y-3">
                          <label className="flex items-center gap-2 text-sm font-medium">
                            <Checkbox
                              checked={t.use_custom_questions}
                              onCheckedChange={() => toggleUseCustom(t)}
                            />
                            Personalizar perguntas deste tipo
                          </label>

                          {!t.use_custom_questions ? (
                            <p className="text-sm text-muted-foreground">
                              Este tipo usa as <strong>perguntas globais</strong> (editaveis em
                              {' '}<span className="font-medium">Perguntas de Atividade</span>). Marque acima para
                              definir perguntas proprias.
                            </p>
                          ) : (
                            <>
                              {isLoadingQ ? (
                                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                              ) : (
                                <>
                                  {questions.length === 0 ? (
                                    <p className="text-center text-sm text-muted-foreground py-4">
                                      Nenhuma pergunta propria. Adicione abaixo ou copie as globais.
                                    </p>
                                  ) : (
                                    <div className="space-y-1.5">
                                      {questions.map((q) => (
                                        <div
                                          key={q.id}
                                          className={`flex items-start gap-2 rounded-md border p-2.5 text-sm hover:bg-muted/30 ${q.critical ? 'border-l-4 border-l-destructive' : ''} ${!q.active ? 'opacity-60' : ''}`}
                                        >
                                          <span className="shrink-0 font-mono text-xs text-muted-foreground w-6 text-right pt-0.5">{q.order_index}</span>
                                          <div className="flex-1 min-w-0">
                                            <p>{q.label}</p>
                                            <div className="mt-1 flex flex-wrap gap-1.5">
                                              {q.critical && (
                                                <Badge variant="plain" className="border-transparent bg-destructive/10 text-destructive">
                                                  <AlertTriangle className="h-3 w-3" />Critica
                                                </Badge>
                                              )}
                                              {!q.active && (
                                                <Badge variant="plain" className="border-transparent bg-muted text-muted-foreground">Inativa</Badge>
                                              )}
                                            </div>
                                          </div>
                                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground" title="Editar pergunta" onClick={() => setQuestionModal({ type: t, question: q })}><Pencil className="h-3.5 w-3.5" /></Button>
                                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:bg-red-50 hover:text-red-700" title="Excluir pergunta" onClick={() => deleteQuestion(t, q)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <div className="flex flex-col sm:flex-row gap-2">
                                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setQuestionModal({ type: t, question: null })}>
                                      <Plus className="mr-2 h-4 w-4" />Adicionar pergunta
                                    </Button>
                                    <Button variant="outline" size="sm" className="flex-1" onClick={() => copyGlobals(t)}>
                                      <Copy className="mr-2 h-4 w-4" />Copiar globais
                                    </Button>
                                  </div>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <ActivityTypeForm
          item={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); load(); }}
        />
      )}

      {questionModal && (
        <ActivityQuestionForm
          type={questionModal.type}
          question={questionModal.question}
          nextOrder={getNextOrder(questionModal.type.id)}
          supabase={supabase}
          onClose={() => setQuestionModal(null)}
          onSaved={async () => {
            const typeId = questionModal.type.id;
            setQuestionModal(null);
            await loadQuestionsFor(typeId);
          }}
        />
      )}

    </div>
  );
}

interface FormProps {
  item: ActivityType | null;
  onClose: () => void;
  onSaved: () => void;
}

function ActivityTypeForm({ item, onClose, onSaved }: FormProps) {
  const supabase = useMemo(() => createClient(), []);
  const [code, setCode] = useState(item?.code ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [category, setCategory] = useState<Category>(item?.category ?? 'parada');
  const [allowCustom, setAllowCustom] = useState(item?.allow_custom ?? false);
  const [active, setActive] = useState(item?.active ?? true);
  const [orderIndex, setOrderIndex] = useState(String(item?.order_index ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!code.trim()) { setError('Codigo e obrigatorio.'); return; }
    if (!description.trim()) { setError('Descricao e obrigatoria.'); return; }
    const orderNum = parseInt(orderIndex, 10);
    if (Number.isNaN(orderNum)) { setError('Ordem invalida.'); return; }
    setSaving(true);
    setError(null);

    const payload = {
      code: code.trim(),
      description: description.trim(),
      category,
      allow_custom: allowCustom,
      active,
      order_index: orderNum,
    };

    if (item) {
      const { error: upErr } = await supabase.from('activity_types').update(payload).eq('id', item.id);
      if (upErr) { setError(upErr.message); setSaving(false); return; }
    } else {
      const { error: insErr } = await supabase.from('activity_types').insert(payload);
      if (insErr) { setError(insErr.message); setSaving(false); return; }
    }
    setSaving(false);
    toast.success(item ? 'Tipo de atividade atualizado.' : 'Tipo de atividade criado.');
    onSaved();
  }

  return (
    <Modal open={true} onClose={onClose} title={item ? 'Editar tipo' : 'Novo tipo'}>
      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Codigo *</Label>
            <Input
              placeholder="Ex: P01, S03, P_OUTROS"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="font-mono"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Categoria *</Label>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
            >
              <option value="parada">Parada (P)</option>
              <option value="servico">Servico (S)</option>
              <option value="outro">Outro</option>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Descricao *</Label>
          <Textarea
            className="min-h-[60px]"
            placeholder="Ex: Dialogo Diario de Seguranca"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Ordem</Label>
            <Input type="number" value={orderIndex} onChange={(e) => setOrderIndex(e.target.value)} />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={active}
                onCheckedChange={(c) => setActive(c === true)}
              />
              Ativo
            </label>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Checkbox
            id="allow_custom"
            className="mt-0.5"
            checked={allowCustom}
            onCheckedChange={(c) => setAllowCustom(c === true)}
          />
          <label htmlFor="allow_custom" className="text-sm">
            Pedir descricao livre ao operador (use para &ldquo;Outros (informar)&rdquo;)
          </label>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>) : item ? 'Atualizar' : 'Adicionar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

interface QuestionFormProps {
  type: ActivityType;
  question: ActivityQuestion | null;
  nextOrder: number;
  supabase: SupabaseClient;
  onClose: () => void;
  onSaved: () => void;
}

function ActivityQuestionForm({ type, question, nextOrder, supabase, onClose, onSaved }: QuestionFormProps) {
  const [label, setLabel] = useState(question?.label ?? '');
  const [critical, setCritical] = useState(question?.critical ?? false);
  const [active, setActive] = useState(question?.active ?? true);
  const [orderIndex, setOrderIndex] = useState(String(question?.order_index ?? nextOrder));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!label.trim()) { setError('A pergunta e obrigatoria.'); return; }
    const orderNum = parseInt(orderIndex, 10);
    if (Number.isNaN(orderNum)) { setError('Ordem invalida.'); return; }
    setSaving(true);
    setError(null);

    if (question) {
      const { data, error: upErr } = await supabase
        .from('activity_questions')
        .update({ label: label.trim(), critical, active, order_index: orderNum })
        .eq('id', question.id)
        .select('id');
      if (upErr) { setError(upErr.message); setSaving(false); return; }
      if (!data || data.length === 0) { setError('Sem permissao para alterar esta pergunta.'); setSaving(false); return; }
    } else {
      const { error: insErr } = await supabase.from('activity_questions').insert({
        label: label.trim(),
        critical,
        active,
        order_index: orderNum,
        activity_type_id: type.id,
        is_global: false,
      });
      if (insErr) { setError(insErr.message); setSaving(false); return; }
    }
    setSaving(false);
    toast.success(question ? 'Pergunta atualizada.' : 'Pergunta adicionada.');
    onSaved();
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={question ? 'Editar pergunta' : 'Nova pergunta'}
      description={`${type.code} — ${type.description}`}
    >
      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
        <div className="space-y-2">
          <Label>Pergunta *</Label>
          <Textarea
            className="min-h-[80px]"
            placeholder="Ex: Voce esta apto para operar?"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Ordem</Label>
            <Input type="number" value={orderIndex} onChange={(e) => setOrderIndex(e.target.value)} />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={active} onCheckedChange={(c) => setActive(c === true)} />
              Ativa
            </label>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="q_critical" checked={critical} onCheckedChange={(c) => setCritical(c === true)} />
          <label htmlFor="q_critical" className="text-sm">
            Pergunta critica (resposta NAO gera alerta automatico ao gestor)
          </label>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>) : question ? 'Atualizar' : 'Adicionar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
