'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Badge } from '@/components/ui/badge';
import { useConfirm } from '@/components/confirm-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/modal';
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  GripVertical,
} from 'lucide-react';

interface ActivityQuestion {
  id: string;
  key: string | null;
  label: string;
  critical: boolean;
  order_index: number;
  active: boolean;
  created_at: string;
}

export default function PerguntasAtividadePage() {
  const supabase = useMemo(() => createClient(), []);
  const confirm = useConfirm();
  const [questions, setQuestions] = useState<ActivityQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ActivityQuestion | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    const { data } = await supabase
      .from('activity_questions')
      .select('*')
      .order('order_index', { ascending: true });
    setQuestions((data as ActivityQuestion[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleActive(q: ActivityQuestion) {
    await supabase.from('activity_questions').update({ active: !q.active }).eq('id', q.id);
    load();
  }

  async function move(q: ActivityQuestion, dir: -1 | 1) {
    const idx = questions.findIndex((x) => x.id === q.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= questions.length) return;
    const other = questions[swapIdx];
    await Promise.all([
      supabase.from('activity_questions').update({ order_index: other.order_index }).eq('id', q.id),
      supabase.from('activity_questions').update({ order_index: q.order_index }).eq('id', other.id),
    ]);
    load();
  }

  async function handleDelete(q: ActivityQuestion) {
    const ok = await confirm({
      title: 'Excluir pergunta?',
      description: `"${q.label}". As respostas existentes serão mantidas, mas esta pergunta deixará de aparecer no app.`,
      confirmText: 'Excluir',
      variant: 'destructive',
    });
    if (!ok) return;
    const { error } = await supabase.from('activity_questions').delete().eq('id', q.id);
    if (error) {
      toast.error('Falha ao excluir pergunta.');
      return;
    }
    load();
    toast.success('Pergunta excluída.');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Perguntas de Atividade</h1>
          <p className="text-sm text-muted-foreground">
            Edite as perguntas que o operador responde ao iniciar uma atividade de servico no app mobile.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova pergunta
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : questions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma pergunta cadastrada. Adicione a primeira.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {questions.map((q, i) => (
            <Card
              key={q.id}
              className={!q.active ? 'opacity-60' : q.critical ? 'border-l-4 border-l-destructive' : ''}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => move(q, -1)}
                      disabled={i === 0}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      aria-label="Subir"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <GripVertical className="h-3 w-3 text-muted-foreground" />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => move(q, 1)}
                      disabled={i === questions.length - 1}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      aria-label="Descer"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{q.label}</p>
                      {q.critical && (
                        <Badge variant="plain" className="shrink-0 border border-destructive/30 bg-destructive/10 text-destructive">
                          <AlertTriangle className="h-3 w-3" />
                          Critica
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>Ordem #{q.order_index}</span>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => toggleActive(q)}
                        className="underline-offset-2 hover:underline"
                      >
                        {q.active ? 'Ativa' : 'Inativa'}
                      </button>
                      {q.key && (
                        <>
                          <span>·</span>
                          <span className="font-mono text-xs">key: {q.key}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditing(q)}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(q)}
                      className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <QuestionForm
          question={editing}
          nextOrder={(questions[questions.length - 1]?.order_index ?? 0) + 1}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); load(); }}
        />
      )}

    </div>
  );
}

interface QuestionFormProps {
  question: ActivityQuestion | null;
  nextOrder: number;
  onClose: () => void;
  onSaved: () => void;
}

function QuestionForm({ question, nextOrder, onClose, onSaved }: QuestionFormProps) {
  const supabase = useMemo(() => createClient(), []);
  const [label, setLabel] = useState(question?.label ?? '');
  const [critical, setCritical] = useState(question?.critical ?? false);
  const [active, setActive] = useState(question?.active ?? true);
  const [orderIndex, setOrderIndex] = useState(String(question?.order_index ?? nextOrder));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!label.trim()) {
      setError('A pergunta e obrigatoria.');
      return;
    }
    const orderNum = parseInt(orderIndex, 10);
    if (Number.isNaN(orderNum)) {
      setError('Ordem invalida.');
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      label: label.trim(),
      critical,
      active,
      order_index: orderNum,
    };

    if (question) {
      const { error: upErr } = await supabase
        .from('activity_questions')
        .update(payload)
        .eq('id', question.id);
      if (upErr) { setError(upErr.message); setSaving(false); return; }
    } else {
      const { error: insErr } = await supabase
        .from('activity_questions')
        .insert(payload);
      if (insErr) { setError(insErr.message); setSaving(false); return; }
    }
    setSaving(false);
    toast.success(question ? 'Pergunta atualizada.' : 'Pergunta criada.');
    onSaved();
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={question ? 'Editar pergunta' : 'Nova pergunta'}
    >
      <form
        onSubmit={(e) => { e.preventDefault(); handleSave(); }}
        className="space-y-4"
      >
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
              <Checkbox
                checked={active}
                onCheckedChange={(c) => setActive(c === true)}
              />
              Ativa
            </label>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="critical"
            checked={critical}
            onCheckedChange={(c) => setCritical(c === true)}
          />
          <label htmlFor="critical" className="text-sm">
            Pergunta critica (resposta NAO gera alerta automatico ao gestor)
          </label>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>) : question ? 'Atualizar' : 'Adicionar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
