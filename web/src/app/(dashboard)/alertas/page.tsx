'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useConfirm } from '@/components/confirm-provider';
import { formatDateTime } from '@/lib/formatters';
import type { OperatorBasic, SafetyAlert } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/modal';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Plus,
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

const SEVERITY = {
  low: { label: 'Baixo', badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  medium: { label: 'Médio', badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  high: { label: 'Alto', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  critical: { label: 'Crítico', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
} as const;

export default function AlertasPage() {
  const supabase = useMemo(() => createClient(), []);
  const confirm = useConfirm();

  const PAGE_SIZE = 50;
  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const [operators, setOperators] = useState<OperatorBasic[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<SafetyAlert['severity']>('medium');
  const [operatorId, setOperatorId] = useState<string>('');
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const ALERT_SELECT = '*, creator:profiles!safety_alerts_created_by_fkey(id, full_name, email)';

  const loadAlerts = useCallback(async () => {
    const { data } = await supabase
      .from('safety_alerts')
      .select(ALERT_SELECT)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);
    const rows = (data as SafetyAlert[]) ?? [];
    setAlerts(rows);
    setHasMore(rows.length === PAGE_SIZE);
    setLoading(false);
  }, [supabase]);

  async function loadMoreAlerts() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const lastItem = alerts[alerts.length - 1];
    if (!lastItem) { setLoadingMore(false); return; }
    const { data } = await supabase
      .from('safety_alerts')
      .select(ALERT_SELECT)
      .order('created_at', { ascending: false })
      .lt('created_at', lastItem.created_at)
      .limit(PAGE_SIZE);
    const rows = (data as SafetyAlert[]) ?? [];
    setAlerts((prev) => [...prev, ...rows]);
    setHasMore(rows.length === PAGE_SIZE);
    setLoadingMore(false);
  }

  const loadOperators = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, active')
      .eq('role', 'operator')
      .eq('active', true)
      .order('full_name');
    setOperators(data ?? []);
  }, [supabase]);

  useEffect(() => {
    loadAlerts();
    loadOperators();
  }, [loadAlerts, loadOperators]);

  // Realtime: atualiza estado local sem refetch total
  useEffect(() => {
    const channel = supabase
      .channel('web-alerts-list')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'safety_alerts' },
        () => loadAlerts()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'safety_alerts' },
        (payload) => {
          const updated = payload.new as SafetyAlert;
          setAlerts((prev) => prev.map((a) => a.id === updated.id ? { ...a, ...updated } : a));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'safety_alerts' },
        (payload) => {
          const oldId = (payload.old as { id?: string })?.id;
          if (oldId) setAlerts((prev) => prev.filter((a) => a.id !== oldId));
        }
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

    const { data: inserted, error } = await supabase
      .from('safety_alerts')
      .insert({
        title: title.trim(),
        message: message.trim(),
        severity,
        operator_id: operatorId || null,
        created_by: userData.user?.id ?? null,
        read: false,
      })
      .select('id, operator_id')
      .single();

    if (error || !inserted) {
      console.error('[AlertasPage] insert error:', error?.message);
      setSending(false);
      setFormError('Falha ao criar alerta. Tente novamente.');
      return;
    }

    const { data: pushData, error: pushError } = await supabase.functions.invoke(
      'notify-blocking-item',
      {
        body: {
          type: 'custom',
          alert_id: inserted.id,
          operator_id: inserted.operator_id,
        },
      },
    );

    setSending(false);
    setShowModal(false);
    await loadAlerts();

    if (pushError) {
      console.error('[AlertasPage] push error:', pushError.message);
      toast.error('Alerta criado, mas falha ao enviar push. Tente reenviar manualmente.');
    } else {
      const count = (pushData as { tokens_count?: number } | null)?.tokens_count ?? 0;
      toast.success(
        count > 0
          ? `Alerta enviado por push para ${count} dispositivo(s).`
          : 'Alerta criado. Operadores serão notificados via Realtime quando o app estiver aberto.',
      );
    }
  }

  async function handleDelete(alert: SafetyAlert) {
    const ok = await confirm({
      title: 'Excluir alerta?',
      description: `O alerta "${alert.title}" será removido. Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      variant: 'destructive',
    });
    if (!ok) return;
    const { error } = await supabase.from('safety_alerts').delete().eq('id', alert.id);
    if (error) {
      toast.error('Falha ao excluir alerta.');
      return;
    }
    await loadAlerts();
    toast.success('Alerta excluído.');
  }

  async function handleResend(alert: SafetyAlert) {
    setResendingId(alert.id);

    const { data, error } = await supabase.functions.invoke('notify-blocking-item', {
      body: {
        type: 'custom',
        alert_id: alert.id,
        operator_id: alert.operator_id,
      },
    });

    setResendingId(null);

    if (error) {
      console.error('[AlertasPage] resend error:', error.message);
      toast.error('Falha ao reenviar push. Tente novamente.');
    } else {
      const count = (data as { tokens_count?: number } | null)?.tokens_count ?? 0;
      toast.success(
        count > 0
          ? `Push reenviado para ${count} dispositivo(s).`
          : 'Alerta reenviado. Operadores serão notificados via Realtime quando o app estiver aberto.',
      );
    }
  }

  function operatorName(id: string | null) {
    if (!id) return 'Todos os operadores';
    return operators.find((o) => o.id === id)?.full_name ?? 'Operador removido';
  }

  const totalUnread = alerts.filter((a) => !a.read).length;
  const totalResponded = alerts.filter((a) => a.response).length;

  return (
    <div className="space-y-2 sm:space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Alertas de Segurança</h1>
          <p className="text-xs sm:text-xs text-muted-foreground">
            {alerts.length} alertas · {totalUnread} não lidos · {totalResponded} respondidos
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="shrink-0">
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Novo Alerta</span>
          <span className="sm:hidden">Novo</span>
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : alerts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-6 text-center">
            <Bell className="h-7 w-7 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">
              Nenhum alerta enviado. Clique em &quot;Novo Alerta&quot; para criar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {alerts.map((alert) => {
            const sev = SEVERITY[alert.severity];
            return (
              <Card
                key={alert.id}
                className={!alert.read ? 'border-l-4 border-l-primary' : ''}
              >
                <CardContent className="px-3 py-2">
                  <div className="flex items-start gap-2">
                    <div
                      className={`mt-1 h-2 w-2 shrink-0 rounded-full ${sev.dot}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{alert.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap leading-snug">
                            {alert.message}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleResend(alert)}
                          disabled={resendingId === alert.id}
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-primary"
                          title="Reenviar push"
                        >
                          {resendingId === alert.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(alert)}
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-500"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                        <span
                          className={`rounded-full px-1.5 py-0 font-semibold ${sev.badge}`}
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
                          {formatDateTime(alert.created_at)}
                        </span>
                        {alert.read && (
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" />
                            Lido
                          </span>
                        )}
                      </div>

                      {alert.response && (
                        <div className="mt-1.5 rounded-md border-l-2 border-l-emerald-500 bg-emerald-50 px-2 py-1.5">
                          <div className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
                            <MessageSquare className="h-3 w-3" />
                            Resposta do operador
                            {alert.responded_at && (
                              <span className="font-normal text-emerald-700/70">
                                · {formatDateTime(alert.responded_at)}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-foreground mt-0.5 whitespace-pre-wrap leading-snug">
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
          {hasMore && (
            <Button
              variant="outline"
              onClick={loadMoreAlerts}
              disabled={loadingMore}
              className="h-auto w-full bg-card py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
            >
              {loadingMore ? 'Carregando...' : 'Carregar mais'}
            </Button>
          )}
        </div>
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Novo Alerta"
        description="Será enviado por push e em tempo real para o app"
      >
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
            <Textarea
              className="min-h-[100px]"
              placeholder="Descreva o alerta..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Severidade</Label>
              <Select
                value={severity}
                onChange={(e) =>
                  setSeverity(e.target.value as SafetyAlert['severity'])
                }
              >
                <option value="low">Baixo</option>
                <option value="medium">Médio</option>
                <option value="high">Alto</option>
                <option value="critical">Crítico</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Destinatário</Label>
              <Select
                value={operatorId}
                onChange={(e) => setOperatorId(e.target.value)}
              >
                <option value="">Todos os operadores</option>
                {operators.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.full_name}
                  </option>
                ))}
              </Select>
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
      </Modal>
    </div>
  );
}
