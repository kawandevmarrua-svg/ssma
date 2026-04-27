'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
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

function statusIcon(status: string): L.DivIcon {
  const color = STATUS_COLOR[status] ?? '#6b7280';
  const html = `
    <div style="
      width: 28px; height: 28px; border-radius: 50%;
      background: ${color}; border: 3px solid white;
      box-shadow: 0 0 0 2px ${color}66, 0 2px 6px rgba(0,0,0,0.3);
      display:flex; align-items:center; justify-content:center;
    ">
      <div style="width:8px;height:8px;border-radius:50%;background:white;"></div>
    </div>`;
  return L.divIcon({
    html,
    className: 'operator-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function FitBounds({ rows }: { rows: Row[] }) {
  const map = useMap();
  const fittedRef = useRef(false);
  useEffect(() => {
    if (fittedRef.current) return;
    if (rows.length === 0) return;
    const bounds = L.latLngBounds(rows.map((r) => [r.latitude, r.longitude] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    fittedRef.current = true;
  }, [rows, map]);
  return null;
}

export default function AcompanhamentoClient() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState<number>(() => Date.now());
  const [selected, setSelected] = useState<string | null>(null);
  const operatorsCacheRef = useRef<Map<string, OperatorInfo>>(new Map());

  // tick para atualizar "ha X min"
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(i);
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
    const { data: locs, error } = await supabase
      .from('operator_locations')
      .select('*')
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    const acc: Record<string, number> = { online: 0, in_checklist: 0, in_activity: 0, idle: 0, offline: 0 };
    rows.forEach((r) => {
      if (acc[r.current_status] === undefined) acc[r.current_status] = 0;
      acc[r.current_status]++;
    });
    return acc;
  }, [rows]);

  function minutesAgo(iso: string): string {
    const diff = Math.floor((now - new Date(iso).getTime()) / 60000);
    if (diff < 1) return 'agora';
    if (diff < 60) return `${diff} min atras`;
    const h = Math.floor(diff / 60);
    if (h < 24) return `${h}h atras`;
    return new Date(iso).toLocaleString('pt-BR');
  }

  const center: [number, number] = useMemo(() => {
    if (rows.length === 0) return [-15.78, -47.93]; // Brasil
    const avgLat = rows.reduce((s, r) => s + r.latitude, 0) / rows.length;
    const avgLng = rows.reduce((s, r) => s + r.longitude, 0) / rows.length;
    return [avgLat, avgLng];
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Acompanhamento ao vivo</h1>
          <p className="text-sm text-muted-foreground">
            Posicao em tempo real dos operadores em campo. Atualiza automaticamente.
          </p>
        </div>
        <button
          onClick={loadAll}
          className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm hover:bg-accent"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatusCard label="Disponivel" value={counts.online} color={STATUS_COLOR.online} icon={CircleDot} />
        <StatusCard label="Em checklist" value={counts.in_checklist} color={STATUS_COLOR.in_checklist} icon={ListChecks} />
        <StatusCard label="Em atividade" value={counts.in_activity} color={STATUS_COLOR.in_activity} icon={ActivityIcon} />
        <StatusCard label="Ocioso" value={counts.idle} color={STATUS_COLOR.idle} icon={CircleDot} />
        <StatusCard label="Offline" value={counts.offline} color={STATUS_COLOR.offline} icon={WifiOff} />
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <div className="rounded-md border overflow-hidden bg-card" style={{ height: '70vh' }}>
          <MapContainer
            center={center}
            zoom={rows.length > 0 ? 13 : 4}
            scrollWheelZoom
            style={{ width: '100%', height: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds rows={rows} />
            {rows.map((r) => (
              <Marker
                key={r.operator_id}
                position={[r.latitude, r.longitude]}
                icon={statusIcon(r.current_status)}
                eventHandlers={{ click: () => setSelected(r.operator_id) }}
              >
                <Popup>
                  <div className="space-y-1 text-sm">
                    <div className="font-semibold">{r.operator?.name ?? 'Operador'}</div>
                    {r.operator?.role && (
                      <div className="text-xs text-gray-500">{r.operator.role}</div>
                    )}
                    <div>
                      <span
                        className="inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white"
                        style={{ background: STATUS_COLOR[r.current_status] ?? '#6b7280' }}
                      >
                        {STATUS_LABEL[r.current_status] ?? r.current_status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">Atualizado {minutesAgo(r.updated_at)}</div>
                    <div className="text-xs text-gray-500">
                      {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}
                      {r.accuracy ? ` ± ${Math.round(r.accuracy)}m` : ''}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        <aside className="rounded-md border bg-card overflow-hidden flex flex-col" style={{ maxHeight: '70vh' }}>
          <div className="border-b px-3 py-2 text-sm font-semibold flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Operadores ({rows.length})
          </div>
          <div className="overflow-y-auto divide-y">
            {rows.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground text-center">
                {loading ? 'Carregando...' : 'Nenhum operador com localizacao registrada.'}
              </div>
            )}
            {rows.map((r) => {
              const color = STATUS_COLOR[r.current_status] ?? '#6b7280';
              const isSelected = selected === r.operator_id;
              return (
                <button
                  key={r.operator_id}
                  onClick={() => setSelected(r.operator_id)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-accent transition-colors ${isSelected ? 'bg-accent' : ''}`}
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
                        {STATUS_LABEL[r.current_status] ?? r.current_status} · {minutesAgo(r.updated_at)}
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
