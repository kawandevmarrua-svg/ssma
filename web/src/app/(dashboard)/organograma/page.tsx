'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Loader2,
  Users,
  Mail,
  Phone,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Mouse,
  X,
  ListChecks,
  Activity,
  AlertTriangle,
  TrendingUp,
  Star,
  ShieldCheck,
  Award,
  XCircle,
} from 'lucide-react';

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  active: boolean;
  role: string;
  created_by: string | null;
}

interface OrgNode {
  user: UserProfile;
  children: OrgNode[];
}

interface LayoutNode {
  id: string;
  user: UserProfile;
  x: number;
  y: number;
  w: number;
  h: number;
  parentId: string | null;
  childCount: number;
}

// ══════════════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════════════

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gestor',
  supervisor: 'Supervisor',
  encarregado: 'Encarregado',
  operator: 'Operador',
};

const ROLE_HIERARCHY: Record<string, number> = {
  admin: 0,
  manager: 1,
  supervisor: 2,
  encarregado: 3,
  operator: 4,
};

const ROLE_HEX: Record<string, { fill: string; stroke: string; light: string }> = {
  admin: { fill: '#8b5cf6', stroke: '#7c3aed', light: '#ede9fe' },
  manager: { fill: '#3b82f6', stroke: '#2563eb', light: '#dbeafe' },
  supervisor: { fill: '#06b6d4', stroke: '#0891b2', light: '#cffafe' },
  encarregado: { fill: '#f59e0b', stroke: '#d97706', light: '#fef3c7' },
  operator: { fill: '#10b981', stroke: '#059669', light: '#d1fae5' },
};

const DEFAULT_HEX = { fill: '#9ca3af', stroke: '#6b7280', light: '#f3f4f6' };

const NODE_W = 160;
const NODE_H = 80;
const GAP_X = 40;
const GAP_Y = 100;

// ══════════════════════════════════════════════════════════════
// Build tree
// ══════════════════════════════════════════════════════════════

function buildOrgTree(users: UserProfile[]): OrgNode[] {
  const byId = new Map<string, OrgNode>();
  for (const u of users) byId.set(u.id, { user: u, children: [] });

  // Papel esperado do pai direto de cada cargo
  const PARENT_ROLE: Record<string, string> = {
    operator: 'encarregado',
    encarregado: 'supervisor',
    supervisor: 'manager',
    manager: 'admin',
  };

  // Agrupar usuarios por cargo para busca de pai
  const byRole = new Map<string, UserProfile[]>();
  for (const u of users) {
    if (!byRole.has(u.role)) byRole.set(u.role, []);
    byRole.get(u.role)!.push(u);
  }

  const roots: OrgNode[] = [];

  for (const u of users) {
    const node = byId.get(u.id)!;
    const expectedParentRole = PARENT_ROLE[u.role];

    // Admin ou cargo sem pai esperado → raiz
    if (!expectedParentRole) {
      roots.push(node);
      continue;
    }

    // 1. Se created_by tem o cargo esperado, usar ele
    if (u.created_by && byId.has(u.created_by)) {
      const creator = byId.get(u.created_by)!.user;
      if (creator.role === expectedParentRole) {
        byId.get(u.created_by)!.children.push(node);
        continue;
      }
    }

    // 2. Buscar qualquer usuario com o cargo de pai esperado
    const candidates = byRole.get(expectedParentRole) || [];
    if (candidates.length === 1) {
      byId.get(candidates[0].id)!.children.push(node);
      continue;
    }
    if (candidates.length > 1) {
      // Preferir o created_by se existir entre os candidatos
      const preferred = u.created_by ? candidates.find((c) => c.id === u.created_by) : null;
      const parent = preferred || candidates[0];
      byId.get(parent.id)!.children.push(node);
      continue;
    }

    // 3. Fallback: usar created_by independente do cargo
    if (u.created_by && byId.has(u.created_by)) {
      byId.get(u.created_by)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  function sortNodes(list: OrgNode[]) {
    list.sort((a, b) => {
      const ra = ROLE_HIERARCHY[a.user.role] ?? 99;
      const rb = ROLE_HIERARCHY[b.user.role] ?? 99;
      if (ra !== rb) return ra - rb;
      return (a.user.full_name || '').localeCompare(b.user.full_name || '');
    });
    list.forEach((n) => sortNodes(n.children));
  }

  sortNodes(roots);
  return roots;
}

// ══════════════════════════════════════════════════════════════
// Layout algorithm — compute x,y for each node
// ══════════════════════════════════════════════════════════════

function computeLayout(roots: OrgNode[]): LayoutNode[] {
  const nodes: LayoutNode[] = [];

  // Compute subtree width (leaf-based)
  function subtreeWidth(node: OrgNode): number {
    if (node.children.length === 0) return NODE_W;
    let total = 0;
    for (let i = 0; i < node.children.length; i++) {
      if (i > 0) total += GAP_X;
      total += subtreeWidth(node.children[i]);
    }
    return Math.max(NODE_W, total);
  }

  function layoutNode(node: OrgNode, left: number, top: number, parentId: string | null) {
    const sw = subtreeWidth(node);
    const cx = left + sw / 2;

    nodes.push({
      id: node.user.id,
      user: node.user,
      x: cx - NODE_W / 2,
      y: top,
      w: NODE_W,
      h: NODE_H,
      parentId,
      childCount: node.children.length,
    });

    // Layout children
    let childLeft = left;
    for (const child of node.children) {
      const cw = subtreeWidth(child);
      layoutNode(child, childLeft, top + NODE_H + GAP_Y, node.user.id);
      childLeft += cw + GAP_X;
    }
  }

  let rootLeft = 0;
  for (const root of roots) {
    const rw = subtreeWidth(root);
    layoutNode(root, rootLeft, 0, null);
    rootLeft += rw + GAP_X * 2;
  }

  return nodes;
}

// ══════════════════════════════════════════════════════════════
// SVG edge paths (curved bezier)
// ══════════════════════════════════════════════════════════════

function buildEdges(nodes: LayoutNode[]): { from: LayoutNode; to: LayoutNode }[] {
  const byId = new Map<string, LayoutNode>();
  for (const n of nodes) byId.set(n.id, n);

  const edges: { from: LayoutNode; to: LayoutNode }[] = [];
  for (const n of nodes) {
    if (n.parentId && byId.has(n.parentId)) {
      edges.push({ from: byId.get(n.parentId)!, to: n });
    }
  }
  return edges;
}

function edgePath(from: LayoutNode, to: LayoutNode): string {
  const x1 = from.x + from.w / 2;
  const y1 = from.y + from.h;
  const x2 = to.x + to.w / 2;
  const y2 = to.y;
  const cy = y1 + (y2 - y1) * 0.5;
  return `M${x1},${y1} C${x1},${cy} ${x2},${cy} ${x2},${y2}`;
}

// ══════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════

export default function OrganoGramaPage() {
  const supabase = useMemo(() => createClient(), []);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Analytics state
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analytics, setAnalytics] = useState<{
    checklistsMonth: number;
    checklistsToday: number;
    activitiesMonth: number;
    activitiesToday: number;
    releasedCount: number;
    notReleasedCount: number;
    ncCount: number;
    ncBlockingCount: number;
    interferencesCount: number;
    inspectionsCount: number;
    deviationsOpen: number;
    deviationsTotal: number;
    score: number | null;
    productivityIndex: number | null;
    weeklyChecklists: number[];
    weeklyActivities: number[];
    weekLabels: string[];
  } | null>(null);

  // Canvas state
  const canvasRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 60, y: 60 });
  const [zoom, setZoom] = useState(1);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const didDragRef = useRef(false);

  const loadUsers = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, active, role, created_by')
      .in('role', ['admin', 'manager', 'supervisor', 'encarregado', 'operator'])
      .order('created_at', { ascending: true });
    setUsers((data as UserProfile[] | null) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const loadAnalytics = useCallback(async (userId: string) => {
    setAnalyticsLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.slice(0, 7) + '-01';

    // Get all operator IDs to aggregate (the user + all their subordinates recursively)
    function getSubtreeIds(id: string): string[] {
      const ids = [id];
      for (const u of users) {
        if (u.created_by === id) ids.push(...getSubtreeIds(u.id));
      }
      return ids;
    }
    const targetIds = getSubtreeIds(userId);

    const [checklistsRes, activitiesRes, ncRes, inspRes, devRes, scoreRes] = await Promise.all([
      supabase.from('checklists').select('id, operator_id, date, result, had_interference').in('operator_id', targetIds).gte('date', monthStart),
      supabase.from('activities').select('id, operator_id, date, had_interference').in('operator_id', targetIds).gte('date', monthStart),
      supabase.from('checklist_responses').select('id, status, machine_checklist_items(is_blocking), checklist_template_items(is_blocking), checklists!inner(operator_id, date)').eq('status', 'NC').in('checklists.operator_id', targetIds).gte('checklists.date', monthStart),
      supabase.from('behavioral_inspections').select('id, operator_id').in('operator_id', targetIds).gte('date', monthStart),
      supabase.from('behavioral_deviations').select('id, status, behavioral_inspections!inner(operator_id)').in('behavioral_inspections.operator_id', targetIds).gte('behavioral_inspections.date', monthStart),
      supabase.from('operator_scores').select('score, productivity_index').eq('operator_id', userId).eq('period', today.slice(0, 7)).maybeSingle(),
    ]);

    type ClRow = { id: string; operator_id: string; date: string; result: string | null; had_interference: boolean };
    type ActRow = { id: string; operator_id: string; date: string; had_interference: boolean };
    type NcRow = { id: string; status: string; machine_checklist_items: { is_blocking: boolean } | null; checklist_template_items: { is_blocking: boolean } | null; checklists: { operator_id: string; date: string } };
    type DevRow = { id: string; status: string };

    const cls = (checklistsRes.data as ClRow[] | null) ?? [];
    const acts = (activitiesRes.data as ActRow[] | null) ?? [];
    const ncs = (ncRes.data as NcRow[] | null) ?? [];
    const devs = (devRes.data as DevRow[] | null) ?? [];

    // Weekly breakdown (last 4 weeks)
    const weekLabels: string[] = [];
    const weeklyChecklists: number[] = [];
    const weeklyActivities: number[] = [];
    for (let w = 3; w >= 0; w--) {
      const wStart = new Date();
      wStart.setDate(wStart.getDate() - (w * 7 + wStart.getDay()));
      wStart.setHours(0, 0, 0, 0);
      const wEnd = new Date(wStart);
      wEnd.setDate(wEnd.getDate() + 6);
      const ws = wStart.toISOString().split('T')[0];
      const we = wEnd.toISOString().split('T')[0];
      weekLabels.push(`${wStart.getDate()}/${wStart.getMonth() + 1}`);
      weeklyChecklists.push(cls.filter((c) => c.date >= ws && c.date <= we).length);
      weeklyActivities.push(acts.filter((a) => a.date >= ws && a.date <= we).length);
    }

    setAnalytics({
      checklistsMonth: cls.length,
      checklistsToday: cls.filter((c) => c.date === today).length,
      activitiesMonth: acts.length,
      activitiesToday: acts.filter((a) => a.date === today).length,
      releasedCount: cls.filter((c) => c.result === 'released').length,
      notReleasedCount: cls.filter((c) => c.result === 'not_released').length,
      ncCount: ncs.length,
      ncBlockingCount: ncs.filter((n) => n.machine_checklist_items?.is_blocking || n.checklist_template_items?.is_blocking).length,
      interferencesCount: cls.filter((c) => c.had_interference).length + acts.filter((a) => a.had_interference).length,
      inspectionsCount: (inspRes.data ?? []).length,
      deviationsOpen: devs.filter((d) => d.status === 'open').length,
      deviationsTotal: devs.length,
      score: scoreRes.data?.score !== undefined ? Number(scoreRes.data.score) : null,
      productivityIndex: scoreRes.data?.productivity_index !== undefined ? Number(scoreRes.data.productivity_index) : null,
      weeklyChecklists,
      weeklyActivities,
      weekLabels,
    });
    setAnalyticsLoading(false);
  }, [supabase, users]);

  // Load analytics when selection changes
  useEffect(() => {
    if (selectedId) loadAnalytics(selectedId);
    else setAnalytics(null);
  }, [selectedId, loadAnalytics]);

  const tree = useMemo(() => buildOrgTree(users), [users]);
  const layoutNodes = useMemo(() => computeLayout(tree), [tree]);
  const edges = useMemo(() => buildEdges(layoutNodes), [layoutNodes]);

  // Canvas bounding box
  const canvasBounds = useMemo(() => {
    if (layoutNodes.length === 0) return { minX: 0, minY: 0, maxX: 800, maxY: 600 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of layoutNodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.w);
      maxY = Math.max(maxY, n.y + n.h);
    }
    return { minX: minX - 80, minY: minY - 40, maxX: maxX + 80, maxY: maxY + 40 };
  }, [layoutNodes]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        (u.full_name || '').toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (ROLE_LABELS[u.role] || '').toLowerCase().includes(q)
    );
  }, [users, search]);

  const selectedUser = useMemo(() => selectedId ? users.find((u) => u.id === selectedId) || null : null, [selectedId, users]);

  const roleCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const u of users) c[u.role] = (c[u.role] || 0) + 1;
    return c;
  }, [users]);

  // ─── Pan & Zoom handlers ───

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    const newZoom = Math.min(3, Math.max(0.2, zoom + delta));
    const ratio = newZoom / zoom;

    setPan((prev) => ({
      x: mouseX - (mouseX - prev.x) * ratio,
      y: mouseY - (mouseY - prev.y) * ratio,
    }));
    setZoom(newZoom);
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    isPanningRef.current = true;
    didDragRef.current = false;
    panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!isPanningRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDragRef.current = true;
    setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
  }

  function handlePointerUp() {
    isPanningRef.current = false;
  }

  function handleFitView() {
    const container = canvasRef.current;
    if (!container || layoutNodes.length === 0) return;
    const rect = container.getBoundingClientRect();
    const cw = canvasBounds.maxX - canvasBounds.minX;
    const ch = canvasBounds.maxY - canvasBounds.minY;
    const scaleX = rect.width / cw;
    const scaleY = rect.height / ch;
    const newZoom = Math.min(scaleX, scaleY, 1.5) * 0.9;
    setPan({
      x: (rect.width - cw * newZoom) / 2 - canvasBounds.minX * newZoom,
      y: (rect.height - ch * newZoom) / 2 - canvasBounds.minY * newZoom,
    });
    setZoom(newZoom);
  }

  function handleNodeClick(id: string) {
    if (didDragRef.current) return; // ignore clicks after drag
    setSelectedId((prev) => (prev === id ? null : id));
  }

  function focusNode(id: string) {
    const node = layoutNodes.find((n) => n.id === id);
    const container = canvasRef.current;
    if (!node || !container) return;
    const rect = container.getBoundingClientRect();
    const targetZoom = Math.max(zoom, 0.8);
    setPan({
      x: rect.width / 2 - (node.x + node.w / 2) * targetZoom,
      y: rect.height / 2 - (node.y + node.h / 2) * targetZoom,
    });
    setZoom(targetZoom);
    setSelectedId(id);
  }

  // Auto fit on first load
  const didFitRef = useRef(false);
  useEffect(() => {
    if (!loading && layoutNodes.length > 0 && !didFitRef.current) {
      didFitRef.current = true;
      // small timeout so container has rendered
      setTimeout(handleFitView, 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, layoutNodes]);

  // ─── Helpers ───

  function getInitials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  }

  function getShortName(name: string): string {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length <= 1) return name;
    return `${parts[0]} ${parts[parts.length - 1]}`;
  }

  // Nodes related to selected (parent chain + direct children)
  const relatedIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const s = new Set<string>([selectedId]);
    // children
    for (const u of users) {
      if (u.created_by === selectedId) s.add(u.id);
    }
    // parent chain
    let current = users.find((u) => u.id === selectedId);
    while (current?.created_by) {
      s.add(current.created_by);
      current = users.find((u) => u.id === current!.created_by);
    }
    return s;
  }, [selectedId, users]);

  // Selected subordinates & supervisor
  const selectedSubordinates = useMemo(() => selectedId ? users.filter((u) => u.created_by === selectedId) : [], [selectedId, users]);
  const selectedSupervisor = useMemo(() => {
    if (!selectedUser?.created_by) return null;
    return users.find((u) => u.id === selectedUser.created_by) || null;
  }, [selectedUser, users]);

  // ─── Render ───

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)]">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 px-1 pb-3 flex-wrap shrink-0">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">Organograma</h1>
          <p className="text-xs text-muted-foreground">
            Arraste para mover · Scroll para zoom · Clique nos membros para detalhes
          </p>
        </div>

        {/* Role chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {(['admin', 'manager', 'supervisor', 'encarregado', 'operator'] as const).map((role) => {
            const c = ROLE_HEX[role];
            return (
              <div key={role} className="flex items-center gap-1.5 rounded-full border px-2.5 py-1" style={{ borderColor: c.stroke + '40', background: c.light }}>
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: c.fill }} />
                <span className="text-[11px] font-medium" style={{ color: c.stroke }}>{ROLE_LABELS[role]}</span>
                <span className="text-[10px] font-bold" style={{ color: c.fill }}>{loading ? '-' : roleCounts[role] || 0}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Canvas + analytics side */}
      <div className={`flex-1 min-h-0 grid gap-3 ${selectedUser ? 'grid-cols-[1fr_416px]' : 'grid-cols-1'}`}>

        {/* ─── Infinite Canvas ─── */}
        <div
          ref={canvasRef}
          className="rounded-xl border bg-white relative overflow-hidden select-none"
          style={{
            cursor: isPanningRef.current ? 'grabbing' : 'grab',
            backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)',
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : layoutNodes.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Users className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Nenhum usuario encontrado.</p>
            </div>
          ) : (
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
                position: 'absolute',
                top: 0,
                left: 0,
              }}
            >
              {/* SVG edges */}
              <svg
                className="absolute top-0 left-0 pointer-events-none"
                style={{
                  width: canvasBounds.maxX - canvasBounds.minX + 200,
                  height: canvasBounds.maxY - canvasBounds.minY + 200,
                  overflow: 'visible',
                }}
              >
                {edges.map(({ from, to }) => {
                  const isRelated = selectedId ? relatedIds.has(from.id) && relatedIds.has(to.id) : true;
                  const fromColor = ROLE_HEX[from.user.role] || DEFAULT_HEX;
                  const toColor = ROLE_HEX[to.user.role] || DEFAULT_HEX;
                  return (
                    <g key={`${from.id}-${to.id}`}>
                      <defs>
                        <linearGradient id={`grad-${from.id}-${to.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={fromColor.fill} />
                          <stop offset="100%" stopColor={toColor.fill} />
                        </linearGradient>
                      </defs>
                      <path
                        d={edgePath(from, to)}
                        fill="none"
                        stroke={isRelated ? `url(#grad-${from.id}-${to.id})` : '#d1d5db'}
                        strokeWidth={isRelated ? 2.5 : 1.5}
                        opacity={isRelated ? 1 : 0.3}
                        strokeLinecap="round"
                      />
                      {/* Small dot at connection point */}
                      <circle
                        cx={to.x + to.w / 2}
                        cy={to.y}
                        r={3}
                        fill={isRelated ? toColor.fill : '#d1d5db'}
                        opacity={isRelated ? 1 : 0.3}
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Nodes */}
              {layoutNodes.map((node) => {
                const c = ROLE_HEX[node.user.role] || DEFAULT_HEX;
                const name = node.user.full_name || 'Sem nome';
                const isSelected = node.id === selectedId;
                const isRelated = selectedId ? relatedIds.has(node.id) : true;
                const dimmed = selectedId !== null && !isRelated;

                return (
                  <div
                    key={node.id}
                    className="absolute transition-shadow duration-200"
                    style={{
                      left: node.x,
                      top: node.y,
                      width: node.w,
                      height: node.h,
                      opacity: dimmed ? 0.3 : 1,
                    }}
                  >
                    <button
                      onClick={() => handleNodeClick(node.id)}
                      className="w-full h-full rounded-2xl border-2 flex items-center gap-3 px-3 transition-all hover:shadow-lg"
                      style={{
                        borderColor: isSelected ? c.fill : c.stroke + '50',
                        background: isSelected ? c.light : 'white',
                        boxShadow: isSelected
                          ? `0 0 0 3px ${c.fill}30, 0 4px 20px ${c.fill}20`
                          : '0 1px 4px rgba(0,0,0,0.06)',
                      }}
                    >
                      {/* Avatar */}
                      <div
                        className="shrink-0 flex items-center justify-center rounded-full text-white font-bold relative"
                        style={{
                          width: 40,
                          height: 40,
                          background: c.fill,
                          fontSize: 14,
                          boxShadow: `0 2px 8px ${c.fill}40`,
                        }}
                      >
                        {getInitials(name)}
                        {/* Active dot */}
                        <div
                          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2"
                          style={{
                            borderColor: isSelected ? c.light : 'white',
                            background: node.user.active ? '#34d399' : '#9ca3af',
                          }}
                        />
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-[11px] font-semibold truncate text-gray-800 leading-tight">
                          {getShortName(name)}
                        </p>
                        <p className="text-[9px] font-medium mt-0.5" style={{ color: c.stroke }}>
                          {ROLE_LABELS[node.user.role] || node.user.role}
                        </p>
                        {node.childCount > 0 && (
                          <p className="text-[8px] text-gray-400 leading-tight">{node.childCount} subordinado{node.childCount > 1 ? 's' : ''}</p>
                        )}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Zoom controls (floating) */}
          <div className="absolute bottom-4 left-4 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-lg border shadow-sm p-1 z-10">
            <button onClick={() => setZoom((z) => Math.max(0.2, z - 0.15))} className="rounded-md p-1.5 hover:bg-gray-100 transition-colors" title="Diminuir">
              <ZoomOut className="h-4 w-4 text-gray-500" />
            </button>
            <span className="text-[10px] text-gray-500 w-9 text-center font-medium">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(3, z + 0.15))} className="rounded-md p-1.5 hover:bg-gray-100 transition-colors" title="Aumentar">
              <ZoomIn className="h-4 w-4 text-gray-500" />
            </button>
            <div className="w-px h-5 bg-gray-200 mx-0.5" />
            <button onClick={handleFitView} className="rounded-md p-1.5 hover:bg-gray-100 transition-colors" title="Enquadrar tudo">
              <Maximize2 className="h-4 w-4 text-gray-500" />
            </button>
          </div>

          {/* Search (floating) */}
          <div className="absolute top-4 left-4 z-10 w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar membro..."
                className="w-full rounded-lg border bg-white/90 backdrop-blur-sm pl-9 pr-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {searchResults.length > 0 && (
              <div className="mt-1 rounded-lg border bg-white shadow-lg max-h-52 overflow-y-auto">
                {searchResults.map((u) => {
                  const c = ROLE_HEX[u.role] || DEFAULT_HEX;
                  return (
                    <button
                      key={u.id}
                      onClick={() => { focusNode(u.id); setSearch(''); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: c.fill }}>
                        {(u.full_name || '?')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{u.full_name || 'Sem nome'}</p>
                        <p className="text-[10px] text-gray-400">{ROLE_LABELS[u.role]} · {u.email}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Help hint */}
          <div className="absolute bottom-4 right-4 flex items-center gap-1.5 text-[10px] text-gray-400 bg-white/70 backdrop-blur-sm rounded-md px-2 py-1 border z-10">
            <Mouse className="h-3 w-3" />
            Arraste para mover · Scroll para zoom
          </div>
        </div>

        {/* ─── Analytics Card (outside canvas) ─── */}
        {selectedUser && (() => {
          const c = ROLE_HEX[selectedUser.role] || DEFAULT_HEX;
          const name = selectedUser.full_name || 'Sem nome';
          const conformityRate = analytics && analytics.checklistsMonth > 0
            ? Math.round((analytics.releasedCount / analytics.checklistsMonth) * 100)
            : null;
          const maxWeekly = analytics
            ? Math.max(...analytics.weeklyChecklists, ...analytics.weeklyActivities, 1)
            : 1;

          return (
            <div className="rounded-xl border bg-white overflow-y-auto flex flex-col">
              {/* Header */}
              <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b px-4 py-2.5 flex items-center gap-2.5">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ background: c.fill, boxShadow: `0 2px 6px ${c.fill}30` }}
                >
                  {getInitials(name)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-semibold text-gray-800 truncate">{name}</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-medium" style={{ color: c.stroke }}>{ROLE_LABELS[selectedUser.role]}</span>
                    <span className={`inline-flex items-center rounded-full px-1.5 py-px text-[9px] font-medium ${selectedUser.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {selectedUser.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>
                <button onClick={() => setSelectedId(null)} className="rounded-md p-1.5 hover:bg-gray-100 transition-colors">
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              </div>

              {analyticsLoading || !analytics ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="p-3 space-y-3">
                  {/* Contact */}
                  <div className="flex items-center gap-2 text-[10px] text-gray-500 flex-wrap">
                    {selectedUser.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{selectedUser.email}</span>}
                    {selectedUser.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{selectedUser.phone}</span>}
                  </div>

                  {/* Score gauge + conformity */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Score circular gauge */}
                    <div className="rounded-lg border p-2 flex flex-col items-center">
                      <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Score</p>
                      <div className="relative" style={{ width: 60, height: 60 }}>
                        <svg viewBox="0 0 60 60" className="w-full h-full">
                          <circle cx="30" cy="30" r="25" fill="none" stroke="#f3f4f6" strokeWidth="5" />
                          <circle
                            cx="30" cy="30" r="25" fill="none"
                            stroke={analytics.score !== null ? (analytics.score >= 75 ? '#10b981' : analytics.score >= 50 ? '#f59e0b' : '#ef4444') : '#d1d5db'}
                            strokeWidth="5" strokeLinecap="round"
                            strokeDasharray={`${((analytics.score ?? 0) / 100) * 157} 157`}
                            transform="rotate(-90 30 30)"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-sm font-bold text-gray-800">{analytics.score !== null ? analytics.score.toFixed(0) : '--'}</span>
                          <span className="text-[7px] text-gray-400">/ 100</span>
                        </div>
                      </div>
                      {analytics.productivityIndex !== null && (
                        <p className="text-[9px] text-gray-400 mt-0.5">Prod: {analytics.productivityIndex.toFixed(0)}</p>
                      )}
                    </div>

                    {/* Conformity gauge */}
                    <div className="rounded-lg border p-2 flex flex-col items-center">
                      <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Conformidade</p>
                      <div className="relative" style={{ width: 60, height: 60 }}>
                        <svg viewBox="0 0 60 60" className="w-full h-full">
                          <circle cx="30" cy="30" r="25" fill="none" stroke="#f3f4f6" strokeWidth="5" />
                          <circle
                            cx="30" cy="30" r="25" fill="none"
                            stroke={conformityRate !== null ? (conformityRate >= 80 ? '#10b981' : conformityRate >= 50 ? '#f59e0b' : '#ef4444') : '#d1d5db'}
                            strokeWidth="5" strokeLinecap="round"
                            strokeDasharray={`${((conformityRate ?? 0) / 100) * 157} 157`}
                            transform="rotate(-90 30 30)"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-sm font-bold text-gray-800">{conformityRate !== null ? `${conformityRate}%` : '--'}</span>
                          <span className="text-[7px] text-gray-400">liberados</span>
                        </div>
                      </div>
                      <p className="text-[9px] text-gray-400 mt-0.5">{analytics.releasedCount}/{analytics.checklistsMonth}</p>
                    </div>
                  </div>

                  {/* KPI cards */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { label: 'Checklists', value: analytics.checklistsMonth, sub: `${analytics.checklistsToday} hoje`, icon: ListChecks, color: '#3b82f6' },
                      { label: 'Atividades', value: analytics.activitiesMonth, sub: `${analytics.activitiesToday} hoje`, icon: Activity, color: '#8b5cf6' },
                      { label: 'NC', value: analytics.ncCount, sub: analytics.ncBlockingCount > 0 ? `${analytics.ncBlockingCount} bloq.` : '', icon: XCircle, color: analytics.ncCount > 0 ? '#ef4444' : '#10b981' },
                      { label: 'Interf.', value: analytics.interferencesCount, sub: '', icon: AlertTriangle, color: analytics.interferencesCount > 0 ? '#f59e0b' : '#10b981' },
                    ].map(({ label, value, sub, icon: Icon, color }) => (
                      <div key={label} className="rounded-lg border p-1.5 text-center">
                        <Icon className="h-3 w-3 mx-auto mb-0.5" style={{ color }} />
                        <p className="text-sm font-bold leading-none" style={{ color }}>{value}</p>
                        <p className="text-[8px] text-gray-400 leading-tight mt-0.5">{label}</p>
                        {sub && <p className="text-[7px] text-gray-400">{sub}</p>}
                      </div>
                    ))}
                  </div>

                  {/* Weekly bar chart */}
                  <div className="rounded-lg border p-2.5">
                    <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Ultimas 4 semanas</p>
                    <div className="flex items-end gap-1.5 h-20">
                      {analytics.weekLabels.map((label, i) => (
                        <div key={label} className="flex-1 flex flex-col items-center gap-0.5">
                          <div className="flex items-end gap-px w-full" style={{ height: 64 }}>
                            {/* Checklists bar */}
                            <div
                              className="flex-1 rounded-t transition-all"
                              style={{
                                height: `${Math.max((analytics.weeklyChecklists[i] / maxWeekly) * 100, 4)}%`,
                                background: '#3b82f6',
                                opacity: 0.8,
                              }}
                              title={`${analytics.weeklyChecklists[i]} checklists`}
                            />
                            {/* Activities bar */}
                            <div
                              className="flex-1 rounded-t transition-all"
                              style={{
                                height: `${Math.max((analytics.weeklyActivities[i] / maxWeekly) * 100, 4)}%`,
                                background: '#8b5cf6',
                                opacity: 0.8,
                              }}
                              title={`${analytics.weeklyActivities[i]} atividades`}
                            />
                          </div>
                          <span className="text-[8px] text-gray-400">{label}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-center gap-3 mt-1.5">
                      <span className="flex items-center gap-1 text-[8px] text-gray-400"><span className="inline-block w-1.5 h-1.5 rounded-sm" style={{ background: '#3b82f6' }} />Checklists</span>
                      <span className="flex items-center gap-1 text-[8px] text-gray-400"><span className="inline-block w-1.5 h-1.5 rounded-sm" style={{ background: '#8b5cf6' }} />Atividades</span>
                    </div>
                  </div>

                  {/* Status breakdown (horizontal stacked bar) */}
                  {analytics.checklistsMonth > 0 && (
                    <div className="rounded-lg border p-2.5">
                      <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Resultado dos Checklists</p>
                      <div className="flex h-4 rounded-full overflow-hidden">
                        {analytics.releasedCount > 0 && (
                          <div
                            className="flex items-center justify-center text-[8px] font-bold text-white"
                            style={{ width: `${(analytics.releasedCount / analytics.checklistsMonth) * 100}%`, background: '#10b981' }}
                            title={`${analytics.releasedCount} liberados`}
                          >
                            {analytics.releasedCount}
                          </div>
                        )}
                        {analytics.notReleasedCount > 0 && (
                          <div
                            className="flex items-center justify-center text-[8px] font-bold text-white"
                            style={{ width: `${(analytics.notReleasedCount / analytics.checklistsMonth) * 100}%`, background: '#ef4444' }}
                            title={`${analytics.notReleasedCount} nao liberados`}
                          >
                            {analytics.notReleasedCount}
                          </div>
                        )}
                        {(analytics.checklistsMonth - analytics.releasedCount - analytics.notReleasedCount) > 0 && (
                          <div
                            className="flex items-center justify-center text-[8px] font-bold text-white"
                            style={{
                              width: `${((analytics.checklistsMonth - analytics.releasedCount - analytics.notReleasedCount) / analytics.checklistsMonth) * 100}%`,
                              background: '#9ca3af',
                            }}
                            title={`${analytics.checklistsMonth - analytics.releasedCount - analytics.notReleasedCount} em andamento`}
                          >
                            {analytics.checklistsMonth - analytics.releasedCount - analytics.notReleasedCount}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="flex items-center gap-1 text-[8px] text-gray-400"><span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: '#10b981' }} />Liberados</span>
                        <span className="flex items-center gap-1 text-[8px] text-gray-400"><span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: '#ef4444' }} />Nao lib.</span>
                        <span className="flex items-center gap-1 text-[8px] text-gray-400"><span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: '#9ca3af' }} />Outros</span>
                      </div>
                    </div>
                  )}

                  {/* Badges / highlights */}
                  {(() => {
                    const badges: { label: string; color: string; bg: string; icon: typeof Star }[] = [];
                    if (analytics.checklistsMonth >= 5 && analytics.ncCount === 0) badges.push({ label: 'Zero NC no mes', color: '#059669', bg: '#d1fae5', icon: ShieldCheck });
                    if (analytics.score !== null && analytics.score >= 90) badges.push({ label: 'Score excelente', color: '#d97706', bg: '#fef3c7', icon: Star });
                    if (analytics.checklistsMonth >= 20) badges.push({ label: 'Alto volume', color: '#2563eb', bg: '#dbeafe', icon: Award });
                    if (conformityRate !== null && conformityRate === 100) badges.push({ label: '100% conformidade', color: '#059669', bg: '#d1fae5', icon: TrendingUp });
                    if (analytics.ncCount > 5) badges.push({ label: `${analytics.ncCount} NCs — atencao`, color: '#dc2626', bg: '#fee2e2', icon: AlertTriangle });

                    if (badges.length === 0) return null;
                    return (
                      <div className="rounded-lg border p-2.5">
                        <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Destaques</p>
                        <div className="flex flex-wrap gap-1.5">
                          {badges.map((b) => (
                            <span key={b.label} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium" style={{ background: b.bg, color: b.color }}>
                              <b.icon className="h-3 w-3" />{b.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Extra metrics row */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="rounded-lg border p-1.5 text-center">
                      <p className="text-sm font-bold text-violet-600">{analytics.inspectionsCount}</p>
                      <p className="text-[8px] text-gray-400">Insp. Comport.</p>
                    </div>
                    <div className="rounded-lg border p-1.5 text-center">
                      <p className="text-sm font-bold text-orange-600">{analytics.deviationsOpen}</p>
                      <p className="text-[8px] text-gray-400">Desvios abertos</p>
                    </div>
                    <div className="rounded-lg border p-1.5 text-center">
                      <p className="text-sm font-bold" style={{ color: analytics.notReleasedCount > 3 ? '#ef4444' : '#10b981' }}>{analytics.notReleasedCount}</p>
                      <p className="text-[8px] text-gray-400">Nao liberados</p>
                    </div>
                  </div>

                  {/* Supervisor */}
                  {selectedSupervisor && (() => {
                    const sc = ROLE_HEX[selectedSupervisor.role] || DEFAULT_HEX;
                    return (
                      <div>
                        <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Supervisor</p>
                        <button
                          onClick={() => focusNode(selectedSupervisor.id)}
                          className="w-full flex items-center gap-2 rounded-lg border p-2 hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: sc.fill }}>
                            {getInitials(selectedSupervisor.full_name || '?')}
                          </div>
                          <div>
                            <p className="text-[11px] font-medium text-gray-700">{selectedSupervisor.full_name || 'Sem nome'}</p>
                            <p className="text-[9px]" style={{ color: sc.stroke }}>{ROLE_LABELS[selectedSupervisor.role]}</p>
                          </div>
                        </button>
                      </div>
                    );
                  })()}

                  {/* Subordinates */}
                  {selectedSubordinates.length > 0 && (
                    <div>
                      <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                        Subordinados ({selectedSubordinates.length})
                      </p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {selectedSubordinates.map((s) => {
                          const sc = ROLE_HEX[s.role] || DEFAULT_HEX;
                          return (
                            <button
                              key={s.id}
                              onClick={() => focusNode(s.id)}
                              className="w-full flex items-center gap-2 rounded-lg border p-1.5 hover:bg-gray-50 transition-colors text-left"
                            >
                              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white" style={{ background: sc.fill }}>
                                {getInitials(s.full_name || '?')}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-medium text-gray-700 truncate">{s.full_name || 'Sem nome'}</p>
                              </div>
                              <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${s.active ? 'bg-emerald-400' : 'bg-gray-400'}`} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
