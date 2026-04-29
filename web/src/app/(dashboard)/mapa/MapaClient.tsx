'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  WifiOff,
  MapPin,
  ListChecks,
  Activity,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Award,
  Star,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Zap,
  ThumbsUp,
  Eye,
  Route,
  Flag,
  Navigation,
  RefreshCw,
} from 'lucide-react';

// ══════════════════════════════════════════════════════════════
// Leaflet icons
// ══════════════════════════════════════════════════════════════

function createColorIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:${color};border:2px solid white;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center"><div style="width:10px;height:10px;border-radius:50%;background:white;transform:rotate(45deg)"></div></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
}

function createSmallIcon(color: string, label: string) {
  return L.divIcon({
    className: '',
    html: `<div style="width:22px;height:22px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;color:white">${label}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -11],
  });
}

const STATUS_ICONS: Record<string, L.DivIcon> = {
  online: createColorIcon('#10b981'),
  in_activity: createColorIcon('#3b82f6'),
  in_checklist: createColorIcon('#f59e0b'),
  idle: createColorIcon('#9ca3af'),
  offline: createColorIcon('#ef4444'),
};

const ROUTE_START_ICON = createSmallIcon('#6366f1', 'A');
const ROUTE_END_ICON = createSmallIcon('#059669', 'B');

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════

interface OperatorLocation {
  operator_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  battery_level: number | null;
  current_status: string;
  updated_at: string;
  profiles?: { full_name: string | null } | null;
}

interface LocationItem {
  id: string;
  name: string;
  code: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface OperatorMetrics {
  operatorId: string;
  name: string;
  checklistsToday: number;
  checklistsMonth: number;
  activitiesToday: number;
  activitiesMonth: number;
  ncCount: number;
  ncBlockingCount: number;
  interferencesCount: number;
  releasedCount: number;
  notReleasedCount: number;
  inspectionsCount: number;
  deviationsOpen: number;
  deviationsTotal: number;
  score: number | null;
  productivityIndex: number | null;
}

interface RoutePoint {
  lat: number;
  lng: number;
  label: string;
  time: string;
}

interface OperatorRoute {
  operatorId: string;
  points: RoutePoint[];
  distanceKm: number;
}

// ══════════════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════════════

const STATUS_LABELS: Record<string, string> = {
  online: 'Online',
  in_activity: 'Em Atividade',
  in_checklist: 'Em Checklist',
  idle: 'Inativo',
  offline: 'Offline',
};

const STATUS_COLORS: Record<string, string> = {
  online: 'text-emerald-600',
  in_activity: 'text-blue-600',
  in_checklist: 'text-yellow-600',
  idle: 'text-gray-500',
  offline: 'text-red-600',
};

const STATUS_DOT: Record<string, string> = {
  online: 'bg-emerald-500',
  in_activity: 'bg-blue-500',
  in_checklist: 'bg-yellow-500',
  idle: 'bg-gray-400',
  offline: 'bg-red-500',
};

const STATUS_BG: Record<string, string> = {
  online: 'border-emerald-200 bg-emerald-50/30',
  in_activity: 'border-blue-200 bg-blue-50/30',
  in_checklist: 'border-yellow-200 bg-yellow-50/30',
  idle: 'border-gray-200 bg-gray-50/30',
  offline: 'border-red-200 bg-red-50/30',
};

const ROUTE_COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#64748b'];

// ══════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════

function timeSince(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function totalRouteDistance(points: RoutePoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
  }
  return total;
}

/** Gera rota mocada para demonstracao: ponto de inicio, intermediarios e posicao atual */
function generateMockRoute(op: OperatorLocation): OperatorRoute {
  // Seed determinístico por operator_id
  const seed = op.operator_id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const rng = (i: number) => {
    const x = Math.sin(seed * 9301 + i * 49297) * 49297;
    return x - Math.floor(x);
  };

  // Ponto de inicio: 2-8km de distancia da posicao atual
  const angle1 = rng(1) * 2 * Math.PI;
  const dist1 = 0.02 + rng(2) * 0.05; // ~2-7km em graus
  const startLat = op.latitude + Math.cos(angle1) * dist1;
  const startLng = op.longitude + Math.sin(angle1) * dist1;

  // Ponto intermediario
  const midLat = (startLat + op.latitude) / 2 + (rng(3) - 0.5) * 0.01;
  const midLng = (startLng + op.longitude) / 2 + (rng(4) - 0.5) * 0.01;

  const now = new Date();
  const startTime = new Date(now.getTime() - (2 + rng(5) * 4) * 3600000); // 2-6h atras
  const midTime = new Date((startTime.getTime() + now.getTime()) / 2);

  const points: RoutePoint[] = [
    { lat: startLat, lng: startLng, label: 'Inicio do turno', time: startTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) },
    { lat: midLat, lng: midLng, label: 'Ponto intermediario', time: midTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) },
    { lat: op.latitude, lng: op.longitude, label: 'Posicao atual', time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) },
  ];

  return {
    operatorId: op.operator_id,
    points,
    distanceKm: totalRouteDistance(points),
  };
}

// ══════════════════════════════════════════════════════════════
// Proactivity
// ══════════════════════════════════════════════════════════════

interface ProactivityBadge {
  label: string;
  color: string;
  bg: string;
  icon: typeof Star;
}

function getProactivityBadges(m: OperatorMetrics, route: OperatorRoute | undefined): ProactivityBadge[] {
  const badges: ProactivityBadge[] = [];

  if (route && route.distanceKm >= 5) {
    badges.push({ label: `${route.distanceKm.toFixed(1)}km percorridos`, color: 'text-indigo-700', bg: 'bg-indigo-100', icon: Route });
  }

  if (m.checklistsMonth >= 20) {
    badges.push({ label: 'Alto volume de checklists', color: 'text-emerald-700', bg: 'bg-emerald-100', icon: ListChecks });
  }

  if (m.activitiesMonth >= 15) {
    badges.push({ label: 'Alto volume de atividades', color: 'text-blue-700', bg: 'bg-blue-100', icon: Activity });
  }

  if (m.checklistsMonth >= 5 && m.ncCount === 0) {
    badges.push({ label: 'Zero nao conformidades', color: 'text-emerald-700', bg: 'bg-emerald-100', icon: ShieldCheck });
  }

  if (m.checklistsMonth >= 5 && m.notReleasedCount === 0) {
    badges.push({ label: '100% checklists liberados', color: 'text-emerald-700', bg: 'bg-emerald-100', icon: Award });
  }

  if ((m.checklistsMonth + m.activitiesMonth) >= 5 && m.interferencesCount === 0) {
    badges.push({ label: 'Zero interferencias', color: 'text-emerald-700', bg: 'bg-emerald-100', icon: ThumbsUp });
  }

  if (m.score !== null && m.score >= 90) {
    badges.push({ label: `Score excelente: ${m.score.toFixed(0)}`, color: 'text-amber-700', bg: 'bg-amber-100', icon: Star });
  } else if (m.score !== null && m.score >= 75) {
    badges.push({ label: `Bom score: ${m.score.toFixed(0)}`, color: 'text-blue-700', bg: 'bg-blue-100', icon: TrendingUp });
  }

  if (m.checklistsToday > 0 || m.activitiesToday > 0) {
    badges.push({ label: 'Ativo hoje', color: 'text-emerald-700', bg: 'bg-emerald-100', icon: Zap });
  }

  if (m.inspectionsCount > 0) {
    badges.push({ label: `${m.inspectionsCount} inspecao(oes) comportamental`, color: 'text-violet-700', bg: 'bg-violet-100', icon: Eye });
  }

  return badges;
}

function getProactivityAlerts(m: OperatorMetrics): { label: string; color: string; bg: string }[] {
  const alerts: { label: string; color: string; bg: string }[] = [];
  if (m.ncCount > 5) alerts.push({ label: `${m.ncCount} nao conformidades`, color: 'text-red-700', bg: 'bg-red-100' });
  if (m.notReleasedCount > 3) alerts.push({ label: `${m.notReleasedCount} checklists nao liberados`, color: 'text-red-700', bg: 'bg-red-100' });
  if (m.interferencesCount > 3) alerts.push({ label: `${m.interferencesCount} interferencias`, color: 'text-orange-700', bg: 'bg-orange-100' });
  if (m.deviationsOpen > 0) alerts.push({ label: `${m.deviationsOpen} desvio(s) em aberto`, color: 'text-red-700', bg: 'bg-red-100' });
  if (m.ncBlockingCount > 0) alerts.push({ label: `${m.ncBlockingCount} NC bloqueante(s)`, color: 'text-red-700', bg: 'bg-red-100' });
  if (m.score !== null && m.score < 50) alerts.push({ label: `Score baixo: ${m.score.toFixed(0)}`, color: 'text-red-700', bg: 'bg-red-100' });
  return alerts;
}

// ══════════════════════════════════════════════════════════════
// Operator Route Map (mini-map with route)
// ══════════════════════════════════════════════════════════════

function OperatorRouteMap({ route, status }: { route: OperatorRoute; status: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapInstanceRef.current) return;

    const pts = route.points;
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      dragging: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    // Polyline (rota)
    const latlngs: L.LatLngExpression[] = pts.map((p) => [p.lat, p.lng]);
    L.polyline(latlngs, { color: '#6366f1', weight: 4, opacity: 0.8, dashArray: '8 6' }).addTo(map);

    // Start marker
    L.marker([pts[0].lat, pts[0].lng], { icon: ROUTE_START_ICON })
      .bindPopup(`<strong>${pts[0].label}</strong><br/><span style="font-size:11px">${pts[0].time}</span>`)
      .addTo(map);

    // Intermediary markers
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i];
      L.circleMarker([p.lat, p.lng], { radius: 5, color: '#6366f1', fillColor: '#6366f1', fillOpacity: 1, weight: 2 })
        .bindPopup(`<strong>${p.label}</strong><br/><span style="font-size:11px">${p.time}</span>`)
        .addTo(map);
    }

    // End marker (posicao atual)
    const last = pts[pts.length - 1];
    L.marker([last.lat, last.lng], { icon: STATUS_ICONS[status] || STATUS_ICONS.online })
      .bindPopup(`<strong>${last.label}</strong><br/><span style="font-size:11px">${last.time}</span>`)
      .addTo(map);

    // Fit bounds
    map.fitBounds(latlngs as L.LatLngBoundsExpression, { padding: [30, 30] });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="h-full w-full rounded-lg" />;
}

// ══════════════════════════════════════════════════════════════
// Global map with all routes
// ══════════════════════════════════════════════════════════════

function GlobalMap({
  operators,
  routes,
  locations,
  showLocations,
  showRoutes,
  selectedOperatorId,
}: {
  operators: OperatorLocation[];
  routes: Map<string, OperatorRoute>;
  locations: LocationItem[];
  showLocations: boolean;
  showRoutes: boolean;
  selectedOperatorId: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseLayerRef = useRef<L.LayerGroup | null>(null);
  const highlightLayerRef = useRef<L.LayerGroup | null>(null);
  const fittedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: [-15.78, -47.93], zoom: 4, scrollWheelZoom: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
    baseLayerRef.current = L.layerGroup().addTo(map);
    highlightLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; baseLayerRef.current = null; highlightLayerRef.current = null; fittedRef.current = false; };
  }, []);

  // Draw all routes and waypoints
  useEffect(() => {
    const map = mapRef.current;
    const layer = baseLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const bounds: L.LatLngExpression[] = [];
    const hasSelection = selectedOperatorId !== null;

    operators.forEach((op, idx) => {
      const route = routes.get(op.operator_id);
      const name = op.profiles?.full_name || 'Operador';
      const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
      const isSelected = op.operator_id === selectedOperatorId;
      const dimmed = hasSelection && !isSelected;

      if (showRoutes && route && route.points.length >= 2) {
        const latlngs: L.LatLngExpression[] = route.points.map((p) => [p.lat, p.lng]);

        // Route polyline
        L.polyline(latlngs, {
          color,
          weight: dimmed ? 2 : 3,
          opacity: dimmed ? 0.25 : 0.7,
          dashArray: '6 4',
        }).addTo(layer);

        // All waypoints along the route
        route.points.forEach((p, i) => {
          bounds.push([p.lat, p.lng]);
          if (i === 0) {
            // Start marker
            L.circleMarker([p.lat, p.lng], {
              radius: dimmed ? 3 : 5,
              color,
              fillColor: color,
              fillOpacity: dimmed ? 0.3 : 1,
              weight: 1,
            })
              .bindPopup(`<span style="font-size:11px"><strong>${name}</strong> — ${p.label} (${p.time})</span>`)
              .addTo(layer);
          } else if (i < route.points.length - 1) {
            // Intermediate waypoints
            L.circleMarker([p.lat, p.lng], {
              radius: dimmed ? 2 : 4,
              color,
              fillColor: color,
              fillOpacity: dimmed ? 0.2 : 0.8,
              weight: 1,
            })
              .bindPopup(`<span style="font-size:11px"><strong>${name}</strong> — ${p.label} (${p.time})</span>`)
              .addTo(layer);
          }
        });
      }

      // Current position marker
      const pos: L.LatLngExpression = [op.latitude, op.longitude];
      bounds.push(pos);
      const marker = L.marker(pos, {
        icon: STATUS_ICONS[op.current_status] || STATUS_ICONS.online,
        opacity: dimmed ? 0.35 : 1,
      })
        .bindPopup(`<strong>${name}</strong><br/><span style="font-size:11px">${STATUS_LABELS[op.current_status]} · ${timeSince(op.updated_at)}${route ? ` · ${route.distanceKm.toFixed(1)}km` : ''}</span>`)
        .addTo(layer);

      // Show name label for non-dimmed operators
      if (!dimmed) {
        L.marker(pos, {
          icon: L.divIcon({
            className: '',
            html: `<div style="white-space:nowrap;font-size:10px;font-weight:600;color:${color};text-shadow:0 0 3px white,0 0 3px white,0 0 3px white;pointer-events:none;transform:translate(-50%,-100%)">${name.split(' ')[0]}</div>`,
            iconSize: [0, 0],
            iconAnchor: [0, 38],
          }),
        }).addTo(layer);
      }
    });

    if (showLocations) {
      for (const loc of locations) {
        if (loc.latitude == null || loc.longitude == null) continue;
        const pos: L.LatLngExpression = [loc.latitude, loc.longitude];
        bounds.push(pos);
        L.circleMarker(pos, { radius: 6, color: '#8b5cf6', fillColor: '#8b5cf6', fillOpacity: 0.6, weight: 2 })
          .bindPopup(`<strong>${loc.name}</strong>${loc.code ? `<br/><span style="font-size:11px;font-family:monospace">${loc.code}</span>` : ''}`)
          .addTo(layer);
      }
    }

    if (bounds.length > 0 && !fittedRef.current) {
      fittedRef.current = true;
      if (bounds.length === 1) map.setView(bounds[0], 14);
      else map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [40, 40] });
    }
  }, [operators, routes, locations, showLocations, showRoutes, selectedOperatorId]);

  // Highlight selected operator route
  useEffect(() => {
    const map = mapRef.current;
    const hLayer = highlightLayerRef.current;
    if (!map || !hLayer) return;

    hLayer.clearLayers();

    if (!selectedOperatorId) return;

    const opIdx = operators.findIndex((o) => o.operator_id === selectedOperatorId);
    if (opIdx < 0) return;

    const op = operators[opIdx];
    const route = routes.get(op.operator_id);
    const name = op.profiles?.full_name || 'Operador';
    const color = ROUTE_COLORS[opIdx % ROUTE_COLORS.length];

    if (showRoutes && route && route.points.length >= 2) {
      const latlngs: L.LatLngExpression[] = route.points.map((p) => [p.lat, p.lng]);

      // Glow effect behind
      L.polyline(latlngs, { color, weight: 10, opacity: 0.2 }).addTo(hLayer);
      // Main highlighted line
      L.polyline(latlngs, { color, weight: 5, opacity: 1, dashArray: '8 5' }).addTo(hLayer);

      // Highlighted waypoints with labels
      route.points.forEach((p, i) => {
        const isStart = i === 0;
        const isEnd = i === route.points.length - 1;
        const label = isStart ? 'A' : isEnd ? 'B' : String(i);
        const bgColor = isStart ? '#6366f1' : isEnd ? '#059669' : color;

        L.marker([p.lat, p.lng], {
          icon: L.divIcon({
            className: '',
            html: `<div style="width:24px;height:24px;border-radius:50%;background:${bgColor};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;color:white">${label}</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            popupAnchor: [0, -12],
          }),
        })
          .bindPopup(`<div style="font-size:12px"><strong>${name}</strong><br/>${p.label}<br/><span style="font-family:monospace;font-size:10px">${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</span><br/>${p.time}</div>`)
          .addTo(hLayer);
      });

      // Fit map to selected route
      map.fitBounds(latlngs as L.LatLngBoundsExpression, { padding: [60, 60], maxZoom: 15 });
    } else {
      // Live mode (no routes): just pan to current position
      map.setView([op.latitude, op.longitude], 15, { animate: true });
    }
  }, [selectedOperatorId, operators, routes, showRoutes]);

  return <div ref={containerRef} className="h-full w-full" />;
}

// ══════════════════════════════════════════════════════════════
// Main
// ══════════════════════════════════════════════════════════════

export default function MapaClient() {
  const supabase = useMemo(() => createClient(), []);
  const [operatorLocations, setOperatorLocations] = useState<OperatorLocation[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [metrics, setMetrics] = useState<Map<string, OperatorMetrics>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showLocations, setShowLocations] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [expandedOps, setExpandedOps] = useState<Set<string>>(new Set());
  const [selectedOperatorId, setSelectedOperatorId] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'live' | 'disconnected'>('connecting');
  const [viewMode, setViewMode] = useState<'live' | 'analysis'>('live');

  const today = new Date().toISOString().split('T')[0];
  const monthStart = today.slice(0, 7) + '-01';

  const loadData = useCallback(async () => {
    const [opLocRes, locRes, checklistsRes, activitiesRes, ncRes, inspectionsRes, deviationsRes, scoresRes] = await Promise.all([
      supabase.from('operator_locations').select('*, profiles!operator_id(full_name)').order('updated_at', { ascending: false }),
      supabase.from('locations').select('id, name, code, latitude, longitude').eq('active', true),
      supabase.from('checklists').select('id, operator_id, date, result, had_interference, profiles(full_name)').gte('date', monthStart),
      supabase.from('activities').select('id, operator_id, date, had_interference, profiles(full_name)').gte('date', monthStart),
      supabase.from('checklist_responses').select('id, status, checklist_id, machine_checklist_items(is_blocking), checklist_template_items(is_blocking), checklists!inner(operator_id, date)').eq('status', 'NC').gte('checklists.date', monthStart),
      supabase.from('behavioral_inspections').select('id, operator_id').gte('date', monthStart),
      supabase.from('behavioral_deviations').select('id, status, inspection_id, behavioral_inspections!inner(operator_id)').gte('behavioral_inspections.date', monthStart),
      supabase.from('operator_scores').select('operator_id, score, productivity_index, period').eq('period', today.slice(0, 7)),
    ]);

    setOperatorLocations((opLocRes.data as OperatorLocation[] | null) ?? []);
    setLocations((locRes.data as LocationItem[] | null) ?? []);

    const mMap = new Map<string, OperatorMetrics>();
    function ensureOp(id: string, name: string): OperatorMetrics {
      if (!mMap.has(id)) {
        mMap.set(id, { operatorId: id, name, checklistsToday: 0, checklistsMonth: 0, activitiesToday: 0, activitiesMonth: 0, ncCount: 0, ncBlockingCount: 0, interferencesCount: 0, releasedCount: 0, notReleasedCount: 0, inspectionsCount: 0, deviationsOpen: 0, deviationsTotal: 0, score: null, productivityIndex: null });
      }
      return mMap.get(id)!;
    }

    type ClRow = { id: string; operator_id: string; date: string; result: string | null; had_interference: boolean; profiles: { full_name: string } | null };
    for (const c of (checklistsRes.data as ClRow[] | null) ?? []) {
      const m = ensureOp(c.operator_id, c.profiles?.full_name || 'Operador');
      m.checklistsMonth++; if (c.date === today) m.checklistsToday++;
      if (c.result === 'released') m.releasedCount++;
      if (c.result === 'not_released') m.notReleasedCount++;
      if (c.had_interference) m.interferencesCount++;
    }

    type ActRow = { id: string; operator_id: string; date: string; had_interference: boolean; profiles: { full_name: string } | null };
    for (const a of (activitiesRes.data as ActRow[] | null) ?? []) {
      const m = ensureOp(a.operator_id, a.profiles?.full_name || 'Operador');
      m.activitiesMonth++; if (a.date === today) m.activitiesToday++;
      if (a.had_interference) m.interferencesCount++;
    }

    type NcRow = { id: string; status: string; checklist_id: string; machine_checklist_items: { is_blocking: boolean } | null; checklist_template_items: { is_blocking: boolean } | null; checklists: { operator_id: string; date: string } };
    for (const nc of (ncRes.data as NcRow[] | null) ?? []) {
      const opId = nc.checklists?.operator_id; if (!opId) continue;
      const m = ensureOp(opId, ''); m.ncCount++;
      const item = nc.machine_checklist_items || nc.checklist_template_items;
      if (item?.is_blocking) m.ncBlockingCount++;
    }

    type InspRow = { id: string; operator_id: string };
    for (const insp of (inspectionsRes.data as InspRow[] | null) ?? []) { ensureOp(insp.operator_id, '').inspectionsCount++; }

    type DevRow = { id: string; status: string; inspection_id: string; behavioral_inspections: { operator_id: string } };
    for (const dev of (deviationsRes.data as DevRow[] | null) ?? []) {
      const opId = dev.behavioral_inspections?.operator_id; if (!opId) continue;
      const m = ensureOp(opId, ''); m.deviationsTotal++;
      if (dev.status === 'open') m.deviationsOpen++;
    }

    type ScoreRow = { operator_id: string; score: number | null; productivity_index: number | null };
    for (const s of (scoresRes.data as ScoreRow[] | null) ?? []) {
      const m = ensureOp(s.operator_id, '');
      m.score = s.score !== null ? Number(s.score) : null;
      m.productivityIndex = s.productivity_index !== null ? Number(s.productivity_index) : null;
    }

    for (const ol of (opLocRes.data as OperatorLocation[] | null) ?? []) {
      const m = ensureOp(ol.operator_id, ol.profiles?.full_name || 'Operador');
      if (!m.name || m.name === '') m.name = ol.profiles?.full_name || 'Operador';
    }

    setMetrics(mMap);
    setLoading(false);
  }, [supabase, today, monthStart]);

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel('mapa-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'operator_locations' }, () => loadData())
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('live');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setRealtimeStatus('disconnected');
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [supabase, loadData]);

  // Generate mock routes
  const operatorRoutes = useMemo(() => {
    const map = new Map<string, OperatorRoute>();
    for (const op of operatorLocations) {
      map.set(op.operator_id, generateMockRoute(op));
    }
    return map;
  }, [operatorLocations]);

  const filtered = useMemo(
    () => filterStatus ? operatorLocations.filter((o) => o.current_status === filterStatus) : operatorLocations,
    [operatorLocations, filterStatus]
  );

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { online: 0, in_activity: 0, in_checklist: 0, idle: 0, offline: 0 };
    for (const o of operatorLocations) c[o.current_status] = (c[o.current_status] || 0) + 1;
    return c;
  }, [operatorLocations]);

  function toggleExpanded(id: string) {
    setExpandedOps((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  const isLive = viewMode === 'live';

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Mapa de Operadores</h1>
          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
            <RealtimeBadge status={realtimeStatus} />
            <span>·</span>
            <span>{isLive ? 'Posicao em tempo real dos operadores em campo.' : 'Rotas percorridas, metricas e proatividade do mes.'}</span>
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); loadData(); }}
          className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm hover:bg-accent"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* View mode tabs */}
      <div className="inline-flex rounded-lg border bg-card p-1 text-sm">
        <button
          onClick={() => { setViewMode('live'); setSelectedOperatorId(null); }}
          className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 font-medium transition-colors ${
            isLive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <MapPin className="h-4 w-4" />
          Ao vivo
        </button>
        <button
          onClick={() => { setViewMode('analysis'); setSelectedOperatorId(null); }}
          className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 font-medium transition-colors ${
            !isLive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Route className="h-4 w-4" />
          Rotas e Analise
        </button>
      </div>

      {/* Status filter */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <button key={key} onClick={() => setFilterStatus(filterStatus === key ? '' : key)}
            className={`rounded-lg border p-3 text-center transition-colors ${filterStatus === key ? 'ring-2 ring-primary border-primary' : 'hover:bg-muted'}`}>
            <p className={`text-xl font-bold ${STATUS_COLORS[key]}`}>{loading ? '...' : statusCounts[key] || 0}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 text-sm flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="h-4 w-4 rounded border" checked={showLocations} onChange={(e) => setShowLocations(e.target.checked)} />
          <MapPin className="h-4 w-4 text-violet-500" />
          Localidades
        </label>
        {filterStatus && (
          <button onClick={() => setFilterStatus('')} className="text-xs text-muted-foreground underline hover:text-foreground">Limpar filtro</button>
        )}
        {!isLive && (
          <div className="ml-auto flex gap-2">
            <button onClick={() => setExpandedOps(new Set(filtered.map((o) => o.operator_id)))} className="text-xs text-muted-foreground underline hover:text-foreground">Expandir todos</button>
            <button onClick={() => setExpandedOps(new Set())} className="text-xs text-muted-foreground underline hover:text-foreground">Recolher todos</button>
          </div>
        )}
      </div>

      {/* Global map + operator list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            {isLive ? <><MapPin className="h-4 w-4" />Acompanhamento ao vivo</> : <><Route className="h-4 w-4" />Visao Geral — Rotas dos Operadores</>}
          </CardTitle>
          <CardDescription>
            {isLive
              ? 'Marcadores indicam a posicao atual de cada operador. Clique para focar.'
              : 'Cada linha tracejada representa a rota percorrida pelo operador no turno.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-1 lg:grid-cols-3">
            {/* Map */}
            <div className="lg:col-span-2 rounded-bl-lg overflow-hidden" style={{ height: isLive ? 560 : 420 }}>
              {loading ? (
                <div className="flex items-center justify-center h-full bg-muted/30"><p className="text-muted-foreground">Carregando mapa...</p></div>
              ) : (
                <GlobalMap operators={filtered} routes={operatorRoutes} locations={locations} showLocations={showLocations} showRoutes={!isLive} selectedOperatorId={selectedOperatorId} />
              )}
            </div>

            {/* Operator list panel */}
            <div className="border-t lg:border-t-0 lg:border-l overflow-y-auto" style={{ maxHeight: isLive ? 560 : 420 }}>
              <div className="px-3 py-2 border-b bg-muted/30 sticky top-0 z-10 flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {filtered.length} Operador{filtered.length !== 1 ? 'es' : ''}
                  {!isLive && (
                    <> · {(() => { let t = 0; filtered.forEach(op => { const r = operatorRoutes.get(op.operator_id); if (r) t += r.distanceKm; }); return t.toFixed(1); })()}km total</>
                  )}
                </p>
                {selectedOperatorId && (
                  <button onClick={() => setSelectedOperatorId(null)} className="text-[10px] text-muted-foreground underline hover:text-foreground">Ver todos</button>
                )}
              </div>
              {!loading && filtered.length > 0 ? (
                <div className="divide-y">
                  {filtered.map((op, idx) => {
                    const route = operatorRoutes.get(op.operator_id);
                    const m = metrics.get(op.operator_id);
                    const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
                    const conformity = m && m.checklistsMonth > 0 ? Math.round((m.releasedCount / m.checklistsMonth) * 100) : null;

                    const isSelected = op.operator_id === selectedOperatorId;

                    return (
                      <button
                        key={op.operator_id}
                        onClick={() => setSelectedOperatorId(isSelected ? null : op.operator_id)}
                        className={`w-full text-left px-3 py-2.5 transition-colors ${isSelected ? 'bg-primary/10 ring-1 ring-inset ring-primary/30' : 'hover:bg-muted/30'}`}
                      >
                        <div className="flex items-center gap-2">
                          {/* Status / route color indicator */}
                          <div
                            className={`shrink-0 rounded-full border-2 border-white shadow-sm ${isSelected ? 'w-4 h-4' : 'w-3 h-3'}`}
                            style={{ background: isLive ? undefined : color }}
                          >
                            {isLive && (
                              <div className={`h-full w-full rounded-full ${STATUS_DOT[op.current_status]}`} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium truncate">{op.profiles?.full_name || 'Operador'}</p>
                              {!isLive && <span className={`h-2 w-2 rounded-full shrink-0 ${STATUS_DOT[op.current_status]}`} />}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                              <span className={STATUS_COLORS[op.current_status]}>{STATUS_LABELS[op.current_status]}</span>
                              <span>· {timeSince(op.updated_at)}</span>
                              {!isLive && route && (
                                <span className="font-medium text-indigo-600">{route.distanceKm.toFixed(1)}km</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Mini metrics row */}
                        {!isLive && m && (
                          <div className="flex items-center gap-2 mt-1.5 ml-5 text-[10px] flex-wrap">
                            <span className="inline-flex items-center gap-0.5 text-blue-600">
                              <ListChecks className="h-2.5 w-2.5" />{m.checklistsMonth}
                            </span>
                            <span className="inline-flex items-center gap-0.5 text-violet-600">
                              <Activity className="h-2.5 w-2.5" />{m.activitiesMonth}
                            </span>
                            {m.ncCount > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-red-600">
                                <XCircle className="h-2.5 w-2.5" />{m.ncCount} NC
                              </span>
                            )}
                            {conformity !== null && (
                              <span className={`font-medium ${conformity >= 80 ? 'text-emerald-600' : conformity >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {conformity}%
                              </span>
                            )}
                            {m.score !== null && (
                              <span className="inline-flex items-center gap-0.5 text-amber-600 font-medium">
                                <Star className="h-2.5 w-2.5" />{m.score.toFixed(0)}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Route coordinates */}
                        {!isLive && route && route.points.length >= 2 && (
                          <div className="mt-1 ml-5 text-[9px] text-muted-foreground font-mono">
                            <span className="text-indigo-500">A</span> {route.points[0].lat.toFixed(4)},{route.points[0].lng.toFixed(4)}
                            {' → '}
                            <span className="text-emerald-500">B</span> {route.points[route.points.length - 1].lat.toFixed(4)},{route.points[route.points.length - 1].lng.toFixed(4)}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : !loading ? (
                <div className="flex items-center justify-center h-32">
                  <p className="text-xs text-muted-foreground">Nenhum operador encontrado.</p>
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-operator cards (apenas em modo Analise) */}
      {!isLive && !loading && filtered.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Operadores ({filtered.length})</h2>

          {filtered.map((op) => {
            const m = metrics.get(op.operator_id);
            const route = operatorRoutes.get(op.operator_id);
            const isExpanded = expandedOps.has(op.operator_id);
            const badges = m ? getProactivityBadges(m, route) : [];
            const alerts = m ? getProactivityAlerts(m) : [];
            const conformityRate = m && m.checklistsMonth > 0 ? Math.round((m.releasedCount / m.checklistsMonth) * 100) : null;

            return (
              <Card key={op.operator_id} className={`overflow-hidden border ${STATUS_BG[op.current_status] || ''}`}>
                {/* Header */}
                <button onClick={() => toggleExpanded(op.operator_id)} className="w-full text-left">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
                        op.current_status === 'online' ? 'bg-emerald-500' : op.current_status === 'in_activity' ? 'bg-blue-500' : op.current_status === 'in_checklist' ? 'bg-yellow-500' : op.current_status === 'offline' ? 'bg-red-500' : 'bg-gray-400'
                      }`}>
                        {(op.profiles?.full_name || '?').charAt(0).toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold truncate">{op.profiles?.full_name || 'Operador'}</p>
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${STATUS_COLORS[op.current_status]}`}>
                            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[op.current_status]}`} />
                            {STATUS_LABELS[op.current_status]}
                          </span>
                          <span className="text-xs text-muted-foreground">· {timeSince(op.updated_at)}</span>
                          {route && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600">
                              <Route className="h-3 w-3" />
                              {route.distanceKm.toFixed(1)}km
                            </span>
                          )}
                        </div>

                        {m && (
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span className="inline-flex items-center gap-1"><ListChecks className="h-3 w-3" />{m.checklistsToday} hoje · {m.checklistsMonth} mes</span>
                            <span className="inline-flex items-center gap-1"><Activity className="h-3 w-3" />{m.activitiesToday} hoje · {m.activitiesMonth} mes</span>
                            {m.ncCount > 0 && <span className="inline-flex items-center gap-1 text-red-600"><XCircle className="h-3 w-3" />{m.ncCount} NC</span>}
                            {conformityRate !== null && <span className={`inline-flex items-center gap-1 font-medium ${conformityRate >= 80 ? 'text-emerald-600' : conformityRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}><TrendingUp className="h-3 w-3" />{conformityRate}%</span>}
                            {m.score !== null && <span className="inline-flex items-center gap-1 text-amber-600 font-medium"><Star className="h-3 w-3" />{m.score.toFixed(0)}</span>}
                          </div>
                        )}

                        {!isExpanded && badges.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {badges.slice(0, 3).map((b) => (
                              <span key={b.label} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${b.bg} ${b.color}`}>
                                <b.icon className="h-2.5 w-2.5" />{b.label}
                              </span>
                            ))}
                            {badges.length > 3 && <span className="text-[10px] text-muted-foreground">+{badges.length - 3}</span>}
                          </div>
                        )}
                      </div>

                      <div className="shrink-0">
                        {isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                      </div>
                    </div>
                  </CardContent>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t px-4 pb-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                      {/* Route map */}
                      <div className="md:col-span-1 space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                          <Route className="h-3.5 w-3.5" />
                          Rota Percorrida
                        </p>
                        <div className="h-56 rounded-lg border overflow-hidden">
                          {route ? (
                            <OperatorRouteMap route={route} status={op.current_status} />
                          ) : (
                            <div className="flex items-center justify-center h-full bg-muted/30"><p className="text-xs text-muted-foreground">Sem rota</p></div>
                          )}
                        </div>

                        {/* Route details */}
                        {route && (
                          <div className="rounded-md border p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-indigo-700 flex items-center gap-1"><Navigation className="h-3 w-3" />Distancia total</span>
                              <span className="text-sm font-bold text-indigo-700">{route.distanceKm.toFixed(2)} km</span>
                            </div>
                            <div className="divide-y text-xs">
                              {route.points.map((p, i) => (
                                <div key={i} className="flex items-center gap-2 py-1.5">
                                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${i === 0 ? 'bg-indigo-500' : i === route.points.length - 1 ? 'bg-emerald-500' : 'bg-gray-400'}`}>
                                    {i === 0 ? 'A' : i === route.points.length - 1 ? 'B' : String(i)}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium">{p.label}</p>
                                    <p className="text-muted-foreground font-mono text-[10px]">{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</p>
                                  </div>
                                  <span className="text-muted-foreground shrink-0">{p.time}</span>
                                </div>
                              ))}
                            </div>
                            {route.points.length >= 2 && (
                              <div className="pt-1 text-[10px] text-muted-foreground">
                                <Flag className="h-3 w-3 inline mr-1" />
                                De <span className="font-mono">{route.points[0].lat.toFixed(4)},{route.points[0].lng.toFixed(4)}</span> ate{' '}
                                <span className="font-mono">{route.points[route.points.length - 1].lat.toFixed(4)},{route.points[route.points.length - 1].lng.toFixed(4)}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Metrics + proactivity */}
                      <div className="md:col-span-2 space-y-4">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Metricas do Mes</p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {m && [
                              { label: 'Checklists', value: m.checklistsMonth, sub: `${m.checklistsToday} hoje`, color: 'text-blue-600' },
                              { label: 'Atividades', value: m.activitiesMonth, sub: `${m.activitiesToday} hoje`, color: 'text-violet-600' },
                              { label: 'Liberados', value: m.releasedCount, sub: conformityRate !== null ? `${conformityRate}% taxa` : '', color: 'text-emerald-600' },
                              { label: 'Nao Liberados', value: m.notReleasedCount, sub: '', color: 'text-red-600' },
                              { label: 'NC', value: m.ncCount, sub: m.ncBlockingCount > 0 ? `${m.ncBlockingCount} bloq.` : '', color: m.ncCount > 0 ? 'text-red-600' : 'text-emerald-600' },
                              { label: 'Interferencias', value: m.interferencesCount, sub: '', color: m.interferencesCount > 0 ? 'text-orange-600' : 'text-emerald-600' },
                              { label: 'Insp. Comport.', value: m.inspectionsCount, sub: m.deviationsTotal > 0 ? `${m.deviationsOpen} abertos` : '', color: 'text-violet-600' },
                              { label: 'Score', value: m.score !== null ? m.score.toFixed(0) : '—', sub: m.productivityIndex !== null ? `Prod: ${m.productivityIndex.toFixed(0)}` : '', color: m.score !== null && m.score >= 75 ? 'text-emerald-600' : m.score !== null ? 'text-red-600' : 'text-gray-500' },
                            ].map(({ label, value, sub, color }) => (
                              <div key={label} className="rounded-md border p-2.5 text-center">
                                <p className={`text-lg font-bold ${color}`}>{value}</p>
                                <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
                                {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
                              </div>
                            ))}
                          </div>
                        </div>

                        {badges.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Mencoes de Proatividade</p>
                            <div className="flex flex-wrap gap-2">
                              {badges.map((b) => (
                                <span key={b.label} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${b.bg} ${b.color}`}>
                                  <b.icon className="h-3.5 w-3.5" />{b.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {alerts.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Pontos de Atencao</p>
                            <div className="flex flex-wrap gap-2">
                              {alerts.map((a) => (
                                <span key={a.label} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${a.bg} ${a.color}`}>
                                  <AlertTriangle className="h-3.5 w-3.5" />{a.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {badges.length === 0 && alerts.length === 0 && (
                          <div className="rounded-md border border-dashed p-3 text-center">
                            <p className="text-xs text-muted-foreground">Sem dados suficientes para mencoes de proatividade neste mes.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {!loading && operatorLocations.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <WifiOff className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum operador com localizacao registrada.</p>
            <p className="text-xs text-muted-foreground mt-1">Os operadores precisam estar logados no app mobile com GPS ativo.</p>
          </CardContent>
        </Card>
      )}
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
