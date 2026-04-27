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
  Users,
  Plus,
  X,
  Search,
  Phone,
  Mail,
  Loader2,
  ChevronLeft,
  Pencil,
  Activity as ActivityIcon,
  ClipboardCheck,
  Clock,
  TrendingUp,
  AlertTriangle,
  Calendar,
} from 'lucide-react';

interface Operator {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  active: boolean;
  created_at: string;
  auth_user_id: string | null;
}

interface ActivityEvent {
  id: string;
  date: string;
  description: string | null;
  location: string | null;
  equipment_tag: string | null;
  start_time: string | null;
  end_time: string | null;
  had_interference: boolean;
  created_at: string;
}

interface ChecklistEvent {
  id: string;
  date: string;
  machine_name: string;
  status: string;
  result: string | null;
  created_at: string;
}

type TimelineEvent =
  | { kind: 'activity'; ts: number; endTs: number; ref: ActivityEvent }
  | { kind: 'checklist'; ts: number; endTs: number; ref: ChecklistEvent };

type Period = '1' | '7' | '30' | 'all';

export default function OperadoresPage() {
  const supabase = useMemo(() => createClient(), []);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Detail view state
  const [selected, setSelected] = useState<Operator | null>(null);
  const [period, setPeriod] = useState<Period>('7');
  const [detailLoading, setDetailLoading] = useState(false);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [checklists, setChecklists] = useState<ChecklistEvent[]>([]);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Operator | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');
  const [active, setActive] = useState(true);

  const loadOperators = useCallback(async () => {
    const { data } = await supabase
      .from('operators')
      .select('*')
      .order('created_at', { ascending: false });
    setOperators(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadOperators();
  }, [loadOperators]);

  const loadOperatorDetail = useCallback(async (operatorId: string, p: Period) => {
    setDetailLoading(true);

    let fromIso: string | null = null;
    if (p !== 'all') {
      const days = parseInt(p, 10);
      const d = new Date();
      d.setDate(d.getDate() - (days - 1));
      d.setHours(0, 0, 0, 0);
      fromIso = d.toISOString();
    }

    let actQuery = supabase
      .from('activities')
      .select('id, date, description, location, equipment_tag, start_time, end_time, had_interference, created_at')
      .eq('operator_id', operatorId)
      .order('created_at', { ascending: true });
    if (fromIso) actQuery = actQuery.gte('created_at', fromIso);

    let chkQuery = supabase
      .from('checklists')
      .select('id, date, machine_name, status, result, created_at')
      .eq('operator_id', operatorId)
      .order('created_at', { ascending: true });
    if (fromIso) chkQuery = chkQuery.gte('created_at', fromIso);

    const [{ data: actData }, { data: chkData }] = await Promise.all([actQuery, chkQuery]);
    setActivities((actData as ActivityEvent[] | null) ?? []);
    setChecklists((chkData as ChecklistEvent[] | null) ?? []);
    setDetailLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (selected) loadOperatorDetail(selected.id, period);
  }, [selected, period, loadOperatorDetail]);

  function openDetail(op: Operator) {
    setSelected(op);
    setActivities([]);
    setChecklists([]);
  }

  function openCreate() {
    setEditing(null);
    setName('');
    setEmail('');
    setPassword('');
    setPhone('');
    setRole('');
    setActive(true);
    setError(null);
    setShowModal(true);
  }

  function openEdit(op: Operator) {
    setEditing(op);
    setName(op.name);
    setEmail(op.email || '');
    setPassword('');
    setPhone(op.phone || '');
    setRole(op.role);
    setActive(op.active);
    setError(null);
    setShowModal(true);
  }

  async function handleSave() {
    if (!name.trim() || !role.trim()) {
      setError('Nome e funcao sao obrigatorios.');
      return;
    }

    setSaving(true);
    setError(null);

    if (editing) {
      const { error: updateError } = await supabase
        .from('operators')
        .update({
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          role: role.trim(),
          active,
        })
        .eq('id', editing.id);

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }
    } else {
      if (!email.trim() || !password.trim()) {
        setError('Email e senha sao obrigatorios para novo operador.');
        setSaving(false);
        return;
      }

      if (password.length < 8) {
        setError('Senha deve ter no minimo 8 caracteres.');
        setSaving(false);
        return;
      }

      // Create a separate client to avoid logging out the current admin
      const { createClient: rawCreateClient } = await import('@supabase/supabase-js');
      const tempClient = rawCreateClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );

      const { data: authData, error: authError } = await tempClient.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim(), role: 'operator' } },
      });

      if (authError) {
        setError(authError.message);
        setSaving(false);
        return;
      }

      if (authData.user) {
        // Profile role is set by the handle_new_user trigger via signup metadata

        // Get current admin user
        const { data: { user: currentUser } } = await supabase.auth.getUser();

        // Create operator record
        const { error: opError } = await supabase.from('operators').insert({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          role: role.trim(),
          created_by: currentUser!.id,
          auth_user_id: authData.user.id,
          active: true,
        });

        if (opError) {
          setError('Conta criada mas erro ao registrar operador: ' + opError.message);
          setSaving(false);
          await loadOperators();
          setShowModal(false);
          return;
        }
      }
    }

    setSaving(false);
    setShowModal(false);
    await loadOperators();
  }

  async function handleToggleActive(op: Operator) {
    await supabase
      .from('operators')
      .update({ active: !op.active })
      .eq('id', op.id);
    await loadOperators();
  }

  function formatDuration(ms: number): string {
    if (!ms || ms < 0) return '0min';
    const totalMin = Math.round(ms / 60000);
    if (totalMin < 60) return `${totalMin}min`;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h < 24) return `${h}h${m > 0 ? ` ${m}min` : ''}`;
    const d = Math.floor(h / 24);
    const remH = h % 24;
    return `${d}d${remH > 0 ? ` ${remH}h` : ''}`;
  }

  function formatDateTime(input: string | number) {
    return new Date(input).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function formatTime(iso: string | null) {
    if (!iso) return '--:--';
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function renderEditModal() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">
                {editing ? 'Editar Operador' : 'Novo Operador'}
              </CardTitle>
              <CardDescription>
                {editing
                  ? 'Atualize os dados do operador.'
                  : 'Cadastre um operador com acesso ao app mobile.'}
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
                <Label>Nome completo *</Label>
                <Input
                  placeholder="Nome do operador"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              {!editing && (
                <>
                  <div className="space-y-2">
                    <Label>E-mail *</Label>
                    <Input
                      type="email"
                      placeholder="email@exemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Senha *</Label>
                    <Input
                      type="password"
                      placeholder="Minimo 8 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  placeholder="(00) 00000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Funcao / Cargo *</Label>
                <Input
                  placeholder="Ex: Operador de Guindaste"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  required
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
                      Ativo
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
                      Inativo
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <p className="text-sm text-destructive">{error}</p>
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
    );
  }

  const filtered = operators.filter(
    (op) =>
      op.name.toLowerCase().includes(search.toLowerCase()) ||
      op.role.toLowerCase().includes(search.toLowerCase()) ||
      (op.email && op.email.toLowerCase().includes(search.toLowerCase()))
  );

  const activeCount = operators.filter((o) => o.active).length;

  // ─── Detail view (productivity dashboard for one operator) ───
  if (selected) {
    const events: TimelineEvent[] = [
      ...activities.map<TimelineEvent>((a) => {
        const startTs = a.start_time ? new Date(a.start_time).getTime() : new Date(a.created_at).getTime();
        const endTs = a.end_time ? new Date(a.end_time).getTime() : startTs;
        return { kind: 'activity', ts: startTs, endTs, ref: a };
      }),
      ...checklists.map<TimelineEvent>((c) => {
        const ts = new Date(c.created_at).getTime();
        return { kind: 'checklist', ts, endTs: ts, ref: c };
      }),
    ].sort((a, b) => a.ts - b.ts);

    // KPIs
    const completedActivities = activities.filter((a) => !!a.end_time);
    const totalWorkedMs = completedActivities.reduce((sum, a) => {
      const s = a.start_time ? new Date(a.start_time).getTime() : 0;
      const e = a.end_time ? new Date(a.end_time).getTime() : 0;
      return s && e && e > s ? sum + (e - s) : sum;
    }, 0);
    const avgDurationMs = completedActivities.length > 0 ? totalWorkedMs / completedActivities.length : 0;
    const interferenceCount = activities.filter((a) => a.had_interference).length;

    // Compute idle gaps between consecutive events
    let totalIdleMs = 0;
    let longestGapMs = 0;
    for (let i = 1; i < events.length; i++) {
      const prevEnd = events[i - 1].endTs;
      const currStart = events[i].ts;
      const gap = currStart - prevEnd;
      if (gap > 0) {
        totalIdleMs += gap;
        if (gap > longestGapMs) longestGapMs = gap;
      }
    }

    return (
      <div className="space-y-6">
        <button
          onClick={() => { setSelected(null); setActivities([]); setChecklists([]); }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar para lista
        </button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold text-white ${
                selected.active ? 'bg-emerald-500' : 'bg-gray-400'
              }`}
            >
              {selected.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{selected.name}</h1>
              <p className="text-sm text-muted-foreground">{selected.role}</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => openEdit(selected)}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Button>
        </div>

        {/* Period filter */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground mr-2">Período:</span>
          {([
            { v: '1' as Period, label: 'Hoje' },
            { v: '7' as Period, label: '7 dias' },
            { v: '30' as Period, label: '30 dias' },
            { v: 'all' as Period, label: 'Tudo' },
          ]).map(({ v, label }) => (
            <button
              key={v}
              onClick={() => setPeriod(v)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                period === v
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:bg-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {detailLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <ActivityIcon className="h-3.5 w-3.5" />
                    Atividades
                  </div>
                  <p className="text-2xl font-bold">{activities.length}</p>
                  <p className="text-xs text-muted-foreground">{completedActivities.length} concluídas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    Checklists
                  </div>
                  <p className="text-2xl font-bold">{checklists.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Tempo trabalhado
                  </div>
                  <p className="text-2xl font-bold">{formatDuration(totalWorkedMs)}</p>
                  <p className="text-xs text-muted-foreground">média {formatDuration(avgDurationMs)}/ativ.</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Clock className="h-3.5 w-3.5" />
                    Tempo ocioso
                  </div>
                  <p className="text-2xl font-bold">{formatDuration(totalIdleMs)}</p>
                  <p className="text-xs text-muted-foreground">maior gap {formatDuration(longestGapMs)}</p>
                </CardContent>
              </Card>
            </div>

            {interferenceCount > 0 && (
              <div className="rounded-md border border-yellow-300 bg-yellow-50/50 p-3 text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className="text-yellow-700">
                  {interferenceCount} {interferenceCount === 1 ? 'atividade registrou' : 'atividades registraram'} interferência no período.
                </span>
              </div>
            )}

            {/* Timeline */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Linha do tempo
              </h3>
              {events.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">Nenhuma atividade ou checklist no período selecionado.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {events.map((ev, idx) => {
                    const prev = idx > 0 ? events[idx - 1] : null;
                    const gap = prev ? ev.ts - prev.endTs : 0;
                    return (
                      <div key={`${ev.kind}-${ev.kind === 'activity' ? ev.ref.id : ev.ref.id}`}>
                        {prev && gap > 0 && (
                          <div className="flex items-center gap-2 py-1 pl-4 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span className={gap > 30 * 60 * 1000 ? 'text-orange-600 font-medium' : ''}>
                              {formatDuration(gap)} entre eventos
                            </span>
                          </div>
                        )}
                        <Card>
                          <CardContent className="p-3">
                            <div className="flex items-start gap-3">
                              <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                                ev.kind === 'activity' ? 'bg-emerald-500' : 'bg-blue-500'
                              }`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="font-medium text-sm truncate">
                                      {ev.kind === 'activity'
                                        ? (ev.ref.description || 'Atividade')
                                        : `Checklist · ${ev.ref.machine_name}`}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                                      <span>{formatDateTime(ev.ts)}</span>
                                      {ev.kind === 'activity' && ev.ref.end_time && (
                                        <span>→ {formatTime(ev.ref.end_time)}</span>
                                      )}
                                      {ev.kind === 'activity' && ev.endTs > ev.ts && (
                                        <span className="font-medium">
                                          duração {formatDuration(ev.endTs - ev.ts)}
                                        </span>
                                      )}
                                      {ev.kind === 'activity' && ev.ref.location && (
                                        <span>· {ev.ref.location}</span>
                                      )}
                                      {ev.kind === 'activity' && ev.ref.had_interference && (
                                        <span className="text-yellow-600 inline-flex items-center gap-1">
                                          <AlertTriangle className="h-3 w-3" />
                                          interferência
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <span className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
                                    ev.kind === 'activity'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-blue-50 text-blue-700 border-blue-200'
                                  }`}>
                                    {ev.kind === 'activity' ? <ActivityIcon className="h-3 w-3" /> : <ClipboardCheck className="h-3 w-3" />}
                                    {ev.kind === 'activity' ? 'Atividade' : 'Checklist'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* Edit modal (reused) */}
        {showModal && renderEditModal()}
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Operadores</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {operators.length} operadores cadastrados, {activeCount} ativos
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Novo Operador</span>
          <span className="sm:hidden">Novo</span>
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, funcao ou email..."
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
            <Users className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              {search ? 'Nenhum operador encontrado.' : 'Nenhum operador cadastrado.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((op) => (
            <Card
              key={op.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => openDetail(op)}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
                    op.active ? 'bg-emerald-500' : 'bg-gray-400'
                  }`}
                >
                  {op.name.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{op.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{op.role}</p>
                </div>

                <div className="hidden sm:flex items-center gap-4 text-sm text-muted-foreground">
                  {op.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {op.email}
                    </span>
                  )}
                  {op.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />
                      {op.phone}
                    </span>
                  )}
                </div>

                <button
                  className="shrink-0 rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(op);
                  }}
                  title="Editar operador"
                >
                  <Pencil className="h-4 w-4" />
                </button>

                <button
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                    op.active
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleActive(op);
                  }}
                >
                  {op.active ? 'Ativo' : 'Inativo'}
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showModal && renderEditModal()}
    </div>
  );
}
