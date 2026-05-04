'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/modal';
import { Loader2, Plus, AlertTriangle, Wrench, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type Priority = 'low' | 'medium' | 'high' | 'critical';
type OrderStatus = 'open' | 'in_progress' | 'completed';

interface Machine { id: string; name: string; tag: string | null; }
interface Profile { id: string; full_name: string | null; }

interface NotReleased {
  id: string;
  machine_name: string;
  tag: string | null;
  date: string;
  operator_name: string | null;
  notes: string | null;
}

interface MaintenanceOrder {
  id: string;
  machine_id: string | null;
  checklist_id: string | null;
  title: string;
  description: string | null;
  priority: Priority;
  status: OrderStatus;
  responsible: string | null;
  scheduled_date: string | null;
  completed_at: string | null;
  created_at: string;
  machine?: Machine;
}

const PRIORITY_MAP: Record<Priority, { label: string; className: string }> = {
  low:      { label: 'Baixa',    className: 'bg-blue-100 text-blue-700 border-blue-200' },
  medium:   { label: 'Média',    className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  high:     { label: 'Alta',     className: 'bg-orange-100 text-orange-700 border-orange-200' },
  critical: { label: 'Crítica',  className: 'bg-red-100 text-red-700 border-red-200' },
};

const STATUS_MAP: Record<OrderStatus, { label: string; icon: React.ReactNode; className: string }> = {
  open:        { label: 'Aberto',       icon: <Clock className="h-3 w-3" />,         className: 'text-muted-foreground' },
  in_progress: { label: 'Em andamento', icon: <Wrench className="h-3 w-3" />,        className: 'text-yellow-600' },
  completed:   { label: 'Concluído',    icon: <CheckCircle2 className="h-3 w-3" />,  className: 'text-green-600' },
};

export default function ManutencaoPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [notReleased, setNotReleased] = useState<NotReleased[]>([]);
  const [orders, setOrders] = useState<MaintenanceOrder[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingOrder, setEditingOrder] = useState<MaintenanceOrder | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [userRes, machRes, usersRes, clRes, ordersRes] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('machines').select('id, name, tag').eq('active', true).order('name'),
      supabase.from('profiles').select('id, full_name').order('full_name'),
      supabase
        .from('checklists')
        .select('id, machine_name, tag, date, notes, operator_id')
        .eq('result', 'not_released')
        .eq('status', 'completed')
        .order('date', { ascending: false })
        .limit(50),
      supabase
        .from('maintenance_orders')
        .select('*, machine:machines(id, name, tag)')
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    setCurrentUserId(userRes.data.user?.id ?? null);
    setMachines((machRes.data ?? []) as Machine[]);
    setUsers((usersRes.data ?? []) as Profile[]);

    const profileMap = Object.fromEntries(
      ((usersRes.data ?? []) as Profile[]).map(p => [p.id, p.full_name])
    );
    setNotReleased(
      (clRes.data ?? []).map((c: any) => ({
        id: c.id,
        machine_name: c.machine_name,
        tag: c.tag,
        date: c.date,
        operator_name: profileMap[c.operator_id] ?? null,
        notes: c.notes,
      }))
    );

    setOrders((ordersRes.data ?? []) as MaintenanceOrder[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(order: MaintenanceOrder, status: OrderStatus) {
    await supabase
      .from('maintenance_orders')
      .update({ status, ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {}) })
      .eq('id', order.id);
    load();
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Manutenção</h1>
          <p className="text-sm text-muted-foreground">Equipamentos reprovados e ordens de manutenção</p>
        </div>
        <Button onClick={() => setCreating(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova ordem
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Equipamentos não liberados */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Equipamentos Não Liberados
              {notReleased.length > 0 && (
                <span className="rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-xs font-semibold">
                  {notReleased.length}
                </span>
              )}
            </h2>
            {notReleased.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum equipamento reprovado.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {notReleased.map(cl => (
                  <Card key={cl.id} className="border-l-4 border-l-destructive">
                    <CardContent className="p-4 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm">{cl.machine_name}</p>
                        {cl.tag && <span className="text-xs font-mono text-muted-foreground">{cl.tag}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">{cl.date}{cl.operator_name ? ` • ${cl.operator_name}` : ''}</p>
                      {cl.notes && <p className="text-xs text-muted-foreground line-clamp-2">{cl.notes}</p>}
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 w-full gap-1 text-xs"
                        onClick={() => {
                          setCreating(true);
                        }}
                      >
                        <Plus className="h-3 w-3" />
                        Criar ordem
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Ordens de manutenção */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Ordens de Manutenção
            </h2>

            {/* Filtro rápido por status */}
            <OrdersList orders={orders} onStatusChange={updateStatus} onEdit={setEditingOrder} />
          </section>
        </>
      )}

      {(creating || editingOrder) && (
        <OrderForm
          machines={machines}
          users={users}
          currentUserId={currentUserId}
          order={editingOrder}
          supabase={supabase}
          onClose={() => { setCreating(false); setEditingOrder(null); }}
          onSaved={() => { setCreating(false); setEditingOrder(null); load(); }}
        />
      )}
    </div>
  );
}

// ─── Orders list ─────────────────────────────────────────────────────────────

function OrdersList({
  orders,
  onStatusChange,
  onEdit,
}: {
  orders: MaintenanceOrder[];
  onStatusChange: (o: MaintenanceOrder, s: OrderStatus) => void;
  onEdit: (o: MaintenanceOrder) => void;
}) {
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {(['all', 'open', 'in_progress', 'completed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1 rounded-full border text-xs font-semibold transition-colors',
              filter === f ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input text-muted-foreground'
            )}
          >
            {f === 'all' ? 'Todos' : STATUS_MAP[f as OrderStatus].label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma ordem encontrada.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(order => {
            const p = PRIORITY_MAP[order.priority];
            const s = STATUS_MAP[order.status];
            return (
              <Card key={order.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4 flex-wrap">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{order.title}</span>
                        <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold', p.className)}>
                          {p.label}
                        </span>
                        <span className={cn('inline-flex items-center gap-1 text-xs font-medium', s.className)}>
                          {s.icon} {s.label}
                        </span>
                      </div>
                      {order.machine && (
                        <p className="text-xs text-muted-foreground">
                          {order.machine.name}{order.machine.tag ? ` — ${order.machine.tag}` : ''}
                        </p>
                      )}
                      {order.description && <p className="text-xs text-muted-foreground line-clamp-2">{order.description}</p>}
                      <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                        {order.responsible && <span>Responsável: {order.responsible}</span>}
                        {order.scheduled_date && <span>Prazo: {order.scheduled_date}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0 flex-wrap">
                      {order.status !== 'in_progress' && order.status !== 'completed' && (
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => onStatusChange(order, 'in_progress')}>
                          Iniciar
                        </Button>
                      )}
                      {order.status !== 'completed' && (
                        <Button size="sm" variant="outline" className="text-xs text-green-600" onClick={() => onStatusChange(order, 'completed')}>
                          Concluir
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-xs" onClick={() => onEdit(order)}>
                        Editar
                      </Button>
                    </div>
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

// ─── Order form ───────────────────────────────────────────────────────────────

function OrderForm({
  machines,
  users,
  currentUserId,
  order,
  supabase,
  onClose,
  onSaved,
}: {
  machines: Machine[];
  users: Profile[];
  currentUserId: string | null;
  order: MaintenanceOrder | null;
  supabase: ReturnType<typeof createClient>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(order?.title ?? '');
  const [description, setDescription] = useState(order?.description ?? '');
  const [machineId, setMachineId] = useState(order?.machine_id ?? '');
  const [priority, setPriority] = useState<Priority>(order?.priority ?? 'medium');
  const [responsible, setResponsible] = useState(order?.responsible ?? '');
  const [scheduledDate, setScheduledDate] = useState(order?.scheduled_date ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!title.trim()) { setError('Título obrigatório.'); return; }
    setSaving(true); setError(null);

    const payload = {
      title: title.trim(),
      description: description || null,
      machine_id: machineId || null,
      priority,
      responsible: responsible || null,
      scheduled_date: scheduledDate || null,
    };

    if (order) {
      const { error: e } = await supabase.from('maintenance_orders').update(payload).eq('id', order.id);
      if (e) { setError(e.message); setSaving(false); return; }
    } else {
      const { error: e } = await supabase.from('maintenance_orders').insert({ ...payload, created_by: currentUserId });
      if (e) { setError(e.message); setSaving(false); return; }
    }
    setSaving(false);
    onSaved();
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={order ? 'Editar ordem' : 'Nova ordem de manutenção'}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Título *</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Troca de pneu dianteiro" />
        </div>

        <div className="space-y-1.5">
          <Label>Equipamento</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={machineId}
            onChange={e => setMachineId(e.target.value)}
          >
            <option value="">Selecione...</option>
            {machines.map(m => (
              <option key={m.id} value={m.id}>{m.name}{m.tag ? ` — ${m.tag}` : ''}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label>Descrição</Label>
          <textarea
            className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Descreva o problema ou serviço necessário"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Prioridade</Label>
          <div className="flex gap-2 flex-wrap">
            {(Object.entries(PRIORITY_MAP) as [Priority, typeof PRIORITY_MAP[Priority]][]).map(([v, m]) => (
              <button
                key={v}
                type="button"
                onClick={() => setPriority(v)}
                className={cn('px-3 py-1 rounded-full border text-xs font-semibold transition-colors', priority === v ? m.className : 'bg-background border-input text-muted-foreground')}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Responsável</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={responsible}
              onChange={e => setResponsible(e.target.value)}
            >
              <option value="">Selecione...</option>
              {users.map(u => (
                <option key={u.id} value={u.full_name ?? u.id}>{u.full_name ?? u.id}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Prazo</Label>
            <Input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1 gap-2" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Salvando...' : order ? 'Atualizar' : 'Criar ordem'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
