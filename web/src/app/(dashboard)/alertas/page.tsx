'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
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
  Plus,
  X,
  Loader2,
  Bell,
  CheckCircle2,
  MessageSquare,
  Trash2,
  Send,
  Users,
  RefreshCw,
  UserCircle2,
} from 'lucide-react';

interface Operator {
  id: string;
  name: string;
  active: boolean;
}

interface SafetyAlert {
  id: string;
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  operator_id: string | null;
  created_by: string | null;
  read: boolean;
  response: string | null;
  responded_at: string | null;
  created_at: string;
  creator?: { id: string; full_name: string | null; email: string | null } | null;
}

const SEVERITY = {
  low: { label: 'Baixo', badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  medium: { label: 'Médio', badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  high: { label: 'Alto', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  critical: { label: 'Crítico', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
} as const;

export default function AlertasPage() {
  const supabase = useMemo(() => createClient(), []);

  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<SafetyAlert['severity']>('medium');
  const [operatorId, setOperatorId] = useState<string>('');
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadAlerts = useCallback(async () => {
    const { data } = await supabase
      .from('safety_alerts')
      .select('*, creator:profiles!safety_alerts_created_by_fkey(id, full_name, email)')
      .order('created_at', { ascending: false })
      .limit(100);
    setAlerts((data as SafetyAlert[]) ?? []);
    setLoading(false);
  }, [supabase]);

  const loadOperators = useCallback(async () => {
    const { data } = await supabase
      .from('operators')
      .select('id, name, active')
      .eq('active', true)
      .order('name');
    setOperators(data ?? []);
  }, [supabase]);

  useEffect(() => {
    loadAlerts();
    loadOperators();
  }, [loadAlerts, loadOperators]);

  // Realtime: atualiza quando operadores leem ou respondem
  useEffect(() => {
    const channel = supabase
      .channel('web-alerts-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'safety_alerts' },
        () => loadAlerts()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, loadAlerts]);

  function openCreate() {
    setTitle('');
    setMessage('');
    setSeverity('medium');
    setOperatorId('');
    setFormError(null);
    setShowModal(true);
  }

  async function handleSend() {
    if (!title.trim() || !message.trim()) {
      setFormError('Título e mensagem são obrigatórios.');
      return;
    }
    setSending(true);
    setFormError(null);

    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase.from('safety_alerts').insert({
      title: title.trim(),
      message: message.trim(),
      severity,
      operator_id: operatorId || null,
      created_by: userData.user?.id ?? null,
      read: false,
    });

    setSending(false);

    if (error) {
      setFormError(error.message);
      return;
    }

    setShowModal(false);
    await loadAlerts();
  }

  async function handleDelete(alert: SafetyAlert) {
    if (!confirm(`Excluir alerta "${alert.title}"?`)) return;
    await supabase.from('safety_alerts').delete().eq('id', alert.id);
    await loadAlerts();
  }

  async function handleResend(alert: SafetyAlert) {
    setResendingId(alert.id);
    setFeedback(null);

    const { data, error } = await supabase.functions.invoke('notify-blocking-item', {
      body: {
        type: 'custom',
        alert_id: alert.id,
        operator_id: alert.operator_id,
      },
    });

    setResendingId(null);

    if (error) {
      setFeedback({ type: 'err', text: `Falha ao reenviar: ${error.message}` });
    } else {
      const count = (data as { tokens_count?: number } | null)?.tokens_count ?? 0;
      setFeedback({
        type: count > 0 ? 'ok' : 'err',
        text:
          count > 0
            ? `Push reenviado para ${count} dispositivo(s).`
            : 'Nenhum dispositivo com push token cadastrado para esse destinatário.',
      });
    }

    setTimeout(() => setFeedback(null), 4000);
  }

  function operatorName(id: string | null) {
    if (!id) return 'Todos os operadores';
    return operators.find((o) => o.id === id)?.name ?? 'Operador removido';
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const totalUnread = alerts.filter((a) => !a.read).length;
  const totalResponded = alerts.filter((a) => a.response).length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Alertas de Segurança</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {alerts.length} alertas · {totalUnread} não lidos · {totalResponded} respondidos
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Novo Alerta</span>
          <span className="sm:hidden">Novo</span>
        </Button>
      </div>

      {feedback && (
        <div
          className={`rounded-md border px-3 py-2 text-sm ${
            feedback.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : alerts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Bell className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              Nenhum alerta enviado. Clique em &quot;Novo Alerta&quot; para criar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const sev = SEVERITY[alert.severity];
            return (
              <Card
                key={alert.id}
                className={!alert.read ? 'border-l-4 border-l-primary' : ''}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${sev.dot}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{alert.title}</p>
                          <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">
                            {alert.message}
                          </p>
                        </div>
                        <button
                          onClick={() => handleResend(alert)}
                          disabled={resendingId === alert.id}
                          className="shrink-0 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                          title="Reenviar push"
                        >
                          {resendingId === alert.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(alert)}
                          className="shrink-0 text-muted-foreground hover:text-red-500 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`rounded-full px-2 py-0.5 font-semibold ${sev.badge}`}
                        >
                          {sev.label}
                        </span>
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Users className="h-3 w-3" />
                          {operatorName(alert.operator_id)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <UserCircle2 className="h-3 w-3" />
                          {alert.creator?.full_name ||
                            alert.creator?.email ||
                            'Usuario removido'}
                        </span>
                        <span className="text-muted-foreground">
                          {formatDate(alert.created_at)}
                        </span>
                        {alert.read && (
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" />
                            Lido
                          </span>
                        )}
                      </div>

                      {alert.response && (
                        <div className="mt-3 rounded-md border-l-2 border-l-emerald-500 bg-emerald-50 p-2">
                          <div className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
                            <MessageSquare className="h-3 w-3" />
                            Resposta do operador
                            {alert.responded_at && (
                              <span className="font-normal text-emerald-700/70">
                                · {formatDate(alert.responded_at)}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">
                            {alert.response}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-lg">Novo Alerta</CardTitle>
                <CardDescription>
                  Será enviado por push e em tempo real para o app
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
                  handleSend();
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label>Título *</Label>
                  <Input
                    placeholder="Ex: Atenção no uso de EPI"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Mensagem *</Label>
                  <textarea
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="Descreva o alerta..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Severidade</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={severity}
                      onChange={(e) =>
                        setSeverity(e.target.value as SafetyAlert['severity'])
                      }
                    >
                      <option value="low">Baixo</option>
                      <option value="medium">Médio</option>
                      <option value="high">Alto</option>
                      <option value="critical">Crítico</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Destinatário</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={operatorId}
                      onChange={(e) => setOperatorId(e.target.value)}
                    >
                      <option value="">Todos os operadores</option>
                      {operators.map((op) => (
                        <option key={op.id} value={op.id}>
                          {op.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {formError && (
                  <p className="text-sm text-destructive">{formError}</p>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowModal(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1" disabled={sending}>
                    {sending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Enviar
                      </>
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
