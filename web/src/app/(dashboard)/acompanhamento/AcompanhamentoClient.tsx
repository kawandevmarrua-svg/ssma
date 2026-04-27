'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { createClient } from '@/lib/supabase/client';
import { MapPin, RefreshCw, Activity as ActivityIcon, ListChecks, CircleDot, WifiOff } from 'lucide-react';

interface OperatorLocation {
  operator_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  current_status: string;
  current_activity_id: string | null;
  current_checklist_id: string | null;
  recorded_at: string;
  updated_at: string;
}

interface OperatorInfo {
  id: string;
  name: string | null;
  role: string | null;
}

type Row = OperatorLocation & { operator: OperatorInfo | null };

const STATUS_LABEL: Record<string, string> = {
  online: 'Disponivel',
  in_checklist: 'Em checklist',
  in_activity: 'Em atividade',
  idle: 'Ocioso',
  offline: 'Offline',
};

const STATUS_COLOR: Record<string, string> = {
  online: '#16a34a',
  in_checklist: '#2563eb',
  in_activity: '#f97316',
  idle: '#a3a3a3',
  offline: '#6b7280',
};

const STALE_MINUTES = 30;
const STALE_MS = STALE_MINUTES * 60 * 1000;
const RECENT_WINDOW_HOURS = 24;

function statusIconHtml(status: string, stale: boolean): string {
  const color = stale ? '#9ca3af' : (STATUS_COLOR[status] ?? '#6b7280');
  const ring = stale ? '#9ca3af55' : `${color}66`;
  return `
    <div style="
      width: 28px; height: 28px; border-radius: 50%;
      background: ${color}; border: 3px solid white;
      box-shadow: 0 0 0 2px ${ring}, 0 2px 6px rgba(0,0,0,0.3);
      display:flex; align-items:center; justify-content:center;
      ${stale ? 'opacity: 0.7;' : ''}
    ">
      <div style="width:8px;height:8px;border-radius:50%;background:white;"></div>
    </div>`;
}

function popupHtml(r: Row, stale: boolean, agoLabel: string): string {
  const name = r.operator?.name ?? 'Operador';
  const role = r.operator?.role ?? '';
  const statusLabel = stale ? 'Offline / sem sinal' : (STATUS_LABEL[r.current_status] ?? r.current_status);
  const color = stale ? '#9ca3af' : (STATUS_COLOR[r.current_status] ?? '#6b7280');
  const acc = r.accuracy ? ` ± ${Math.round(r.accuracy)}m` : '';
  return `
    <div style="font-size:13px; line-height:1.4">
      <div style="font-weight:600">${escapeHtml(name)}</div>
      ${role ? `<div style="color:#6b7280;font-size:12px">${escapeHtml(role)}</div>` : ''}
      <div style="margin-top:4px">
        <span style="display:inline-block;border-radius:9999px;background:${color};color:white;padding:1px 8px;font-size:11px;font-weight:500">
          ${escapeHtml(statusLabel)}
        </span>
      </div>
      <div style="color:#6b7280;font-size:11px;margin-top:4px">Atualizado ${escapeHtml(agoLabel)}</div>
      <div style="color:#6b7280;font-size:11px">${r.latitude.toFixed(5)}, ${r.longitude.toFixed(5)}${acc}</div>
    </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );
}

function minutesAgoLabel(now: number, iso: string): string {
  const diff = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'agora';
  if (diff < 60) return `${diff} min atras`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `${h}h atras`;
  return new Date(iso).toLocaleString('pt-BR');
}

export default function AcompanhamentoClient() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState<number>(() => Date.now());
  const [selected, setSelected] = useState<string | null>(null);
  const [showStale, setShowStale] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'live' | 'disconnected'>('connecting');
  const operatorsCacheRef = useRef<Map<string, OperatorInfo>>(new Map());

  // Refs para o mapa Leaflet
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, { marker: L.Marker; circle: L.Circle | null }>>(new Map());
  const fittedRef = useRef(false);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(i);
  }, []);

  // Inicializa o mapa uma unica vez. Cleanup destroi pra suportar
  // double-invoke do React 18 dev.
  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [-15.78, -47.93],
      zoom: 4,
      scrollWheelZoom: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      fittedRef.current = false;
    };
  }, []);

  async function fetchOperatorInfo(ids: string[]): Promise<OperatorInfo[]> {
    const missing = ids.filter((id) => !operatorsCacheRef.current.has(id));
    if (missing.length === 0) {
      return ids.map((id) => operatorsCacheRef.current.get(id)!).filter(Boolean);
    }
    const { data } = await supabase
      .from('operators')
      .select('id, name, role')
      .in('id', missing);
    (data ?? []).forEach((op: OperatorInfo) => operatorsCacheRef.current.set(op.id, op));
    return ids.map((id) => operatorsCacheRef.current.get(id)!).filter(Boolean);
  }

  async function loadAll() {
    setLoading(true);
    const cutoff = new Date(Date.now() - RECENT_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
    const { data: locs, error } = await supabase
      .from('operator_locations')
      .select('*')
      .gte('updated_at', cutoff)
      .order('updated_at', { ascending: false });

    if (error) {
      console.log('Erro ao buscar localizacoes:', error.message);
      setLoading(false);
      return;
    }
    const list = (locs ?? []) as OperatorLocation[];
    const ops = await fetchOperatorInfo(list.map((l) => l.operator_id));
    const merged: Row[] = list.map((l) => ({
      ...l,
      operator: ops.find((o) => o.id === l.operator_id) ?? null,
    }));
    setRows(merged);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    const channel = supabase
      .channel('operator-locations-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'operator_locations' },
        async (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { operator_id?: string })?.operator_id;
            if (oldId) setRows((prev) => prev.filter((r) => r.operator_id !== oldId));
            return;
          }
          const loc = payload.new as OperatorLocation;
          const ops = await fetchOperatorInfo([loc.operator_id]);
          const operator = ops[0] ?? null;
          setRows((prev) => {
            const without = prev.filter((r) => r.operator_id !== loc.operator_id);
            return [{ ...loc, operator }, ...without];
          });
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('live');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setRealtimeStatus('disconnected');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { activeRows, staleRows } = useMemo(() => {
    const active: Row[] = [];
    const stale: Row[] = [];
    rows.forEach((r) => {
      const age = now - new Date(r.updated_at).getTime();
      if (age > STALE_MS || r.current_status === 'offline') stale.push(r);
      else active.push(r);
    });
    return { activeRows: active, staleRows: stale };
  }, [rows, now]);

  const visibleRows = showStale ? [...activeRows, ...staleRows] : activeRows;

  // Sincroniza markers com visibleRows
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const visibleIds = new Set(visibleRows.map((r) => r.operator_id));

    // Remove markers que sumiram
    for (const [id, entry] of markersRef.current.entries()) {
      if (!visibleIds.has(id)) {
        entry.marker.remove();
        entry.circle?.remove();
        markersRef.current.delete(id);
      }
    }

    // Adiciona/atualiza markers visiveis
    visibleRows.forEach((r) => {
      const stale = (now - new Date(r.updated_at).getTime()) > STALE_MS || r.current_status === 'offline';
      const html = statusIconHtml(r.current_status, stale);
      const existing = markersRef.current.get(r.operator_id);

      const popup = popupHtml(r, stale, minutesAgoLabel(now, r.updated_at));

      if (existing) {
        existing.marker.setLatLng([r.latitude, r.longitude]);
        existing.marker.setIcon(L.divIcon({ html, className: 'operator-marker', iconSize: [28, 28], iconAnchor: [14, 14] }));
        existing.marker.setPopupContent(popup);

        if (existing.circle) existing.circle.remove();
        if (r.accuracy && r.accuracy < 200 && !stale) {
          const circle = L.circle([r.latitude, r.longitude], {
            radius: r.accuracy,
            color: STATUS_COLOR[r.current_status] ?? '#6b7280',
            fillColor: STATUS_COLOR[r.current_status] ?? '#6b7280',
            fillOpacity: 0.1,
            weight: 1,
          }).addTo(map);
          existing.circle = circle;
        } else {
          existing.circle = null;
        }
      } else {
        const marker = L.marker([r.latitude, r.longitude], {
          icon: L.divIcon({ html, className: 'operator-marker', iconSize: [28, 28], iconAnchor: [14, 14] }),
        }).addTo(map);
        marker.bindPopup(popup);
        marker.on('click', () => setSelected(r.operator_id));

        let circle: L.Circle | null = null;
        if (r.accuracy && r.accuracy < 200 && !stale) {
          circle = L.circle([r.latitude, r.longitude], {
            radius: r.accuracy,
            color: STATUS_COLOR[r.current_status] ?? '#6b7280',
            fillColor: STATUS_COLOR[r.current_status] ?? '#6b7280',
            fillOpacity: 0.1,
            weight: 1,
          }).addTo(map);
        }
        markersRef.current.set(r.operator_id, { marker, circle });
      }
    });

    // Fit bounds na primeira vez que tiver dado
    if (!fittedRef.current && visibleRows.length > 0) {
      const bounds = L.latLngBounds(visibleRows.map((r) => [r.latitude, r.longitude]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      fittedRef.current = true;
    }
  }, [visibleRows, now]);

  // Pan + abre popup quando seleciona pela lista
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selected) return;
    const entry = markersRef.current.get(selected);
    if (!entry) return;
    map.panTo(entry.marker.getLatLng());
    entry.marker.openPopup();
  }, [selected]);

  const counts = useMemo(() => {
    const acc: Record<string, number> = { online: 0, in_checklist: 0, in_activity: 0, idle: 0, offline: 0 };
    activeRows.forEach((r) => {
      if (acc[r.current_status] === undefined) acc[r.current_status] = 0;
      acc[r.current_status]++;
    });
    return acc;
  }, [activeRows]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Acompanhamento ao vivo</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <RealtimeBadge status={realtimeStatus} />
            <span>·</span>
            <span>Posicao em tempo real dos operadores em campo.</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showStale}
              onChange={(e) => setShowStale(e.target.checked)}
              className="rounded"
            />
            Mostrar offline / antigos ({staleRows.length})
          </label>
          <button
            onClick={loadAll}
            className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm hover:bg-accent"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatusCard label="Disponivel" value={counts.online} color={STATUS_COLOR.online} icon={CircleDot} />
        <StatusCard label="Em checklist" value={counts.in_checklist} color={STATUS_COLOR.in_checklist} icon={ListChecks} />
        <StatusCard label="Em atividade" value={counts.in_activity} color={STATUS_COLOR.in_activity} icon={ActivityIcon} />
        <StatusCard label="Ocioso" value={counts.idle} color={STATUS_COLOR.idle} icon={CircleDot} />
        <StatusCard label="Offline / sem sinal" value={staleRows.length} color={STATUS_COLOR.offline} icon={WifiOff} />
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <div className="rounded-md border overflow-hidden bg-card relative" style={{ height: '70vh' }}>
          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

          {visibleRows.length === 0 && !loading && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-card/95 border rounded-md px-4 py-3 text-sm text-muted-foreground text-center pointer-events-auto shadow z-[1000]">
                <MapPin className="h-5 w-5 mx-auto mb-1 opacity-60" />
                Nenhum operador online no momento.
                {staleRows.length > 0 && (
                  <div className="text-xs mt-1">
                    {staleRows.length} operador(es) com ultima posicao &gt; {STALE_MINUTES} min atras.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <aside className="rounded-md border bg-card overflow-hidden flex flex-col" style={{ maxHeight: '70vh' }}>
          <div className="border-b px-3 py-2 text-sm font-semibold flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Operadores ({visibleRows.length})
          </div>
          <div className="overflow-y-auto divide-y">
            {visibleRows.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground text-center">
                {loading ? 'Carregando...' : 'Nenhum operador para exibir.'}
              </div>
            )}
            {visibleRows.map((r) => {
              const stale = (now - new Date(r.updated_at).getTime()) > STALE_MS || r.current_status === 'offline';
              const color = stale ? '#9ca3af' : (STATUS_COLOR[r.current_status] ?? '#6b7280');
              const isSelected = selected === r.operator_id;
              return (
                <button
                  key={r.operator_id}
                  onClick={() => setSelected(r.operator_id)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-accent transition-colors ${isSelected ? 'bg-accent' : ''} ${stale ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ background: color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {r.operator?.name ?? 'Operador'}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {stale ? 'Offline' : (STATUS_LABEL[r.current_status] ?? r.current_status)} · {minutesAgoLabel(now, r.updated_at)}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}

function RealtimeBadge({ status }: { status: 'connecting' | 'live' | 'disconnected' }) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 text-green-700 px-2 py-0.5 text-xs font-medium">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
        Ao vivo
      </span>
    );
  }
  if (status === 'connecting') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-xs font-medium">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Conectando...
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 text-red-700 px-2 py-0.5 text-xs font-medium">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
      Sem conexao em tempo real
    </span>
  );
}

function StatusCard({
  label, value, color, icon: Icon,
}: {
  label: string; value: number; color: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{label}</div>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <div className="text-2xl font-bold mt-1" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
