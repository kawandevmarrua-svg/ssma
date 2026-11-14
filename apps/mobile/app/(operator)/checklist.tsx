import { memo, useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  SectionList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import * as Crypto from 'expo-crypto';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { todayLocal } from '../../src/lib/dates';
import { recordTrackingEvent } from '../../src/lib/trackingEvents';
import { Machine, MachineChecklistItem } from '../../src/types/database';
import { colors, elevation, spacing, radius, fontSize } from '../../src/theme/colors';
import { commonStyles } from '../../src/theme/commonStyles';
import { Badge } from '../../src/components/ui';
import { AppHeader } from '../../src/components/AppHeader';
import { FinishChecklistModal } from '../../src/components/FinishChecklistModal';
import { usePendingFinishes } from '../../src/hooks/usePendingFinishes';

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'heic', 'webp'];
const UPLOAD_CONCURRENCY = 3;
const SAFE_KEY_RE = /^[a-zA-Z0-9_-]+$/;

// Roda promises com limite de concorrencia para nao saturar rede em 3G
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      out[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return out;
}

function isDev() {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

type ItemResponse = {
  status: 'C' | 'NC' | 'NA' | null;
  value?: string;
  photoUri?: string;
};

interface ChecklistRow {
  id: string;
  machine_name: string;
  tag: string | null;
  date: string;
  status: string;
  result: string | null;
  ended_at: string | null;
  created_at: string;
  equipment_photo_1_url: string | null;
  environment_photo_url: string | null;
  photo_signed_url?: string | null;
  encarregado_confirmed: boolean;
  encarregado_confirmed_notes: string | null;
}

type RequiredSlot = 'equipment_1' | 'equipment_2' | 'equipment_3' | 'equipment_4';

type PhotoSlotCardProps = {
  uri: string | null;
  number?: number;
  label: string;
  slot: RequiredSlot;
  wide?: boolean;
  onTake: (slot: RequiredSlot) => void;
  onConfirmClear: (slot: RequiredSlot) => void;
  onPreview: (uri: string) => void;
};

const PhotoSlotCard = memo(function PhotoSlotCard({
  uri,
  number,
  label,
  slot,
  wide,
  onTake,
  onConfirmClear,
  onPreview,
}: PhotoSlotCardProps) {
  const containerStyle = wide ? st.photoSlotWide : st.photoSlot;
  const imageStyle = wide ? st.photoSlotWideImage : st.photoSlotImage;
  if (uri) {
    return (
      <View style={[containerStyle, st.photoSlotFilled]}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={() => onPreview(uri)}
          onLongPress={() => onConfirmClear(slot)}
        >
          <ExpoImage
            source={{ uri }}
            style={imageStyle}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        </Pressable>

        <View style={st.photoSlotOverlay}>
          <View style={st.photoSlotTopRow}>
            {number != null && (
              <View style={st.photoNumberFilled}>
                <Text style={st.photoNumberFilledText}>{number}</Text>
              </View>
            )}
            <TouchableOpacity
              style={st.photoRemoveBtn}
              onPress={() => onConfirmClear(slot)}
              hitSlop={8}
            >
              <Ionicons name="trash-outline" size={16} color={colors.white} />
            </TouchableOpacity>
          </View>
          <View style={st.photoSlotBottomRow}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={st.photoSlotFilledLabel} numberOfLines={1}>{label}</Text>
          </View>
        </View>
      </View>
    );
  }
  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={() => onTake(slot)}
      activeOpacity={0.7}
    >
      {number != null && (
        <View style={st.photoNumberEmpty}>
          <Text style={st.photoNumberEmptyText}>{number}</Text>
        </View>
      )}
      <Ionicons name="camera" size={wide ? 36 : 28} color={colors.primary} />
      <Text style={st.photoSlotLabel}>{label}</Text>
      <Text style={st.photoSlotHint}>Toque para tirar</Text>
    </TouchableOpacity>
  );
});

export default function ChecklistScreen() {
  const { user, profile } = useAuth();
  // Mantem a tela acesa enquanto o operador esta preenchendo um checklist em campo.
  useKeepAwake();
  const pendingFinishes = usePendingFinishes();

  // List
  const [checklists, setChecklists] = useState<ChecklistRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checklistToFinish, setChecklistToFinish] = useState<ChecklistRow | null>(null);

  // Flow: list | scan | pick | items | photos | result
  const [view, setView] = useState<'list' | 'scan' | 'pick' | 'items' | 'photos'>('list');

  // Machines (from web admin)
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [machineSearch, setMachineSearch] = useState('');

  // Dados da inspecao
  const [tag, setTag] = useState('');
  const [shift, setShift] = useState('');

  // Encarregados disponiveis para escolha do responsavel
  type EncarregadoOption = { id: string; full_name: string | null; email: string };
  const [encarregados, setEncarregados] = useState<EncarregadoOption[]>([]);
  const [encarregadosError, setEncarregadosError] = useState(false);
  const [selectedEncarregadoId, setSelectedEncarregadoId] = useState<string | null>(null);

  // Items
  const [templateItems, setTemplateItems] = useState<MachineChecklistItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [responses, setResponses] = useState<Record<string, ItemResponse>>({});

  // Required photos: 4 do equipamento
  const [equipmentPhotos, setEquipmentPhotos] = useState<(string | null)[]>([null, null, null, null]);
  // Preview em tela cheia das fotos tiradas
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  // Result
  const [saving, setSaving] = useState(false);

  // Camera
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const today = todayLocal();

  // --- Data loading ---
  const loadChecklists = useCallback(async () => {
    if (!user) { setListLoading(false); return; }
    const { data } = await supabase
      .from('checklists')
      .select('id, machine_name, tag, date, status, result, ended_at, created_at, equipment_photo_1_url, environment_photo_url, encarregado_confirmed, encarregado_confirmed_notes')
      .eq('operator_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    const rows = (data as ChecklistRow[] | null) ?? [];

    // Resolve signed URLs em batch para a foto do card (bucket privado)
    const paths = Array.from(new Set(
      rows
        .map((r) => r.equipment_photo_1_url ?? r.environment_photo_url)
        .filter((p): p is string => !!p)
    ));
    const pathToUrl: Record<string, string> = {};
    if (paths.length > 0) {
      const { data: signed } = await supabase.storage
        .from('checklist-photos')
        .createSignedUrls(paths, 3600);
      for (const s of signed ?? []) {
        if (s.path && s.signedUrl) pathToUrl[s.path] = s.signedUrl;
      }
    }
    const enriched = rows.map((r) => {
      const p = r.equipment_photo_1_url ?? r.environment_photo_url;
      return { ...r, photo_signed_url: p ? pathToUrl[p] ?? null : null };
    });
    setChecklists(enriched);
    setListLoading(false);
  }, [user]);

  const loadMachines = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.from('machines').select('*').eq('active', true).order('name');
    if (error) {
      if (isDev()) console.log('[Checklist] loadMachines erro:', error.message);
    }
    setMachines(data ?? []);
  }, [user]);

  const loadEncarregados = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'encarregado')
      .eq('active', true)
      .order('full_name', { ascending: true });
    if (error) {
      if (isDev()) console.log('[Checklist] loadEncarregados erro:', error.message);
      setEncarregadosError(true);
      return;
    }
    setEncarregadosError(false);
    setEncarregados((data ?? []) as EncarregadoOption[]);
  }, [user]);

  useEffect(() => { loadChecklists(); loadMachines(); loadEncarregados(); }, [loadChecklists, loadMachines, loadEncarregados]);

  // Load checklist items when machine selected
  useEffect(() => {
    if (!selectedMachine) return;
    let cancelled = false;
    setItemsLoading(true);
    supabase.from('machine_checklist_items').select('*')
      .eq('machine_id', selectedMachine.id).eq('active', true).order('order_index')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          if (isDev()) console.log('[Checklist] Erro ao carregar itens:', error.message);
          Alert.alert('Erro', 'Nao foi possivel carregar os itens do checklist. Tente novamente.');
          setItemsLoading(false);
          return;
        }
        setTemplateItems(data ?? []);
        const init: Record<string, ItemResponse> = {};
        (data ?? []).forEach((item: MachineChecklistItem) => { init[item.id] = { status: null }; });
        setResponses(init);
        setItemsLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedMachine]);

  // --- Helpers ---
  function resetFlow() {
    setView('list');
    setSelectedMachine(null);
    setMachineSearch('');
    setTag(''); setShift('');
    setSelectedEncarregadoId(null);
    setTemplateItems([]); setItemsLoading(false); setResponses({});
    setEquipmentPhotos([null, null, null, null]);
    setScanned(false);
  }

  const takeRequiredPhoto = useCallback(async (slot: RequiredSlot) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permissao', 'Permita o acesso a camera.'); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5, allowsEditing: false });
    if (result.canceled || !result.assets[0]) return;
    const uri = result.assets[0].uri;
    const idx = parseInt(slot.split('_')[1], 10) - 1;
    setEquipmentPhotos((prev) => {
      const copy = [...prev];
      copy[idx] = uri;
      return copy;
    });
  }, []);

  const clearRequiredPhoto = useCallback((slot: RequiredSlot) => {
    const idx = parseInt(slot.split('_')[1], 10) - 1;
    setEquipmentPhotos((prev) => {
      const copy = [...prev];
      copy[idx] = null;
      return copy;
    });
  }, []);

  const confirmClearPhoto = useCallback((slot: RequiredSlot) => {
    Alert.alert(
      'Remover foto',
      'Deseja remover esta foto e tirar outra?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Remover', style: 'destructive', onPress: () => clearRequiredPhoto(slot) },
      ],
    );
  }, [clearRequiredPhoto]);

  function allRequiredPhotosTaken() {
    return equipmentPhotos.every((p) => !!p);
  }

  function setItemStatus(id: string, status: 'C' | 'NC' | 'NA') {
    setResponses((p) => ({ ...p, [id]: { ...p[id], status } }));
    if (status === 'NC') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    } else {
      void Haptics.selectionAsync().catch(() => {});
    }
  }

  function setItemValue(id: string, value: string) {
    setResponses((p) => ({
      ...p,
      [id]: { ...p[id], value, status: value.trim() ? 'C' : null },
    }));
  }

  function setItemNcDescription(id: string, value: string) {
    setResponses((p) => ({
      ...p,
      [id]: { ...p[id], value },
    }));
  }

  async function pickItemPhoto(id: string, isPhotoType = false) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permissao', 'Permita o acesso a camera.'); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5, allowsEditing: false });
    if (!result.canceled && result.assets[0]) {
      setResponses((p) => ({
        ...p,
        [id]: {
          ...p[id],
          photoUri: result.assets[0].uri,
          status: isPhotoType ? 'C' : (p[id]?.status ?? null),
        },
      }));
    }
  }

  const calculateResult = useCallback((): 'released' | 'not_released' => {
    return templateItems.filter((i) => i.is_blocking).some((i) => responses[i.id]?.status === 'NC')
      ? 'not_released' : 'released';
  }, [templateItems, responses]);

  const isItemAnswered = useCallback((item: MachineChecklistItem): boolean => {
    const r = responses[item.id];
    if (!r) return false;
    if (item.response_type === 'text' || item.response_type === 'numeric') {
      return !!r.value && r.value.trim().length > 0;
    }
    if (item.response_type === 'photo') {
      return !!r.photoUri;
    }
    if (r.status === null) return false;
    if (r.status === 'NC' && !r.photoUri) return false;
    return true;
  }, [responses]);

  const allItemsAnswered = useCallback(
    () => templateItems.every(isItemAnswered),
    [templateItems, isItemAnswered],
  );

  async function uploadPhoto(
    uri: string,
    checklistId: string,
    itemId: string,
    label?: string,
  ): Promise<string> {
    if (!user?.id) throw new Error('Sessao expirada. Faca login novamente.');
    if (!SAFE_KEY_RE.test(checklistId) || !SAFE_KEY_RE.test(itemId)) {
      throw new Error('Identificador invalido para upload.');
    }
    const ext = (uri.split('.').pop() ?? 'jpg').toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new Error(`Tipo de imagem nao suportado: .${ext}`);
    }
    // ArrayBuffer evita inflar a memoria em ~33% que o base64 causaria
    const res = await fetch(uri);
    if (!res.ok) throw new Error('Nao foi possivel ler a foto local.');
    const buffer = await res.arrayBuffer();
    const path = `${user.id}/${checklistId}/${itemId}.${ext}`;
    const { error } = await supabase.storage
      .from('checklist-photos')
      .upload(path, buffer, {
        contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        upsert: true,
      });
    if (error) {
      if (isDev()) console.log('[Upload] Erro checklist foto:', error.message);
      throw new Error(label ? `Falha ao enviar "${label}".` : 'Falha ao enviar a foto.');
    }
    return path;
  }

  const groupedItems = useMemo(() => {
    const groups: Record<string, MachineChecklistItem[]> = {};
    templateItems.forEach((i) => {
      const s = i.section || 'Itens de segurança e funcionamento';
      if (!groups[s]) groups[s] = [];
      groups[s].push(i);
    });
    return groups;
  }, [templateItems]);

  const sections = useMemo(() => {
    const pending: ChecklistRow[] = [];
    const history: ChecklistRow[] = [];
    for (const item of checklists) {
      const isQueuedFinish = pendingFinishes.checklistIds.has(item.id);
      const isPending = item.status === 'pending' && !isQueuedFinish;
      if (isPending) pending.push(item);
      else history.push(item);
    }
    const out: { key: string; title: string; data: ChecklistRow[] }[] = [];
    if (pending.length > 0) out.push({ key: 'pending', title: 'Em andamento', data: pending });
    if (history.length > 0) out.push({ key: 'history', title: 'Histórico', data: history });
    return out;
  }, [checklists, pendingFinishes.checklistIds]);

  // --- QR handler ---
  function normalize(str: string): string {
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  // Retorna match exato (selecao automatica) ou candidatos para o operador escolher.
  // Match exato so acontece quando o QR/codigo identifica unicamente uma maquina.
  function findMachineMatch(qrData: string): { exact?: Machine; candidates: Machine[] } {
    const raw = qrData.trim();
    const norm = normalize(raw);

    // Tentativas de match exato (sem ambiguidade)
    const byQr = machines.find((m) => m.qr_code === raw);
    if (byQr) return { exact: byQr, candidates: [] };

    const byQrLower = machines.find((m) => m.qr_code?.toLowerCase() === raw.toLowerCase());
    if (byQrLower) return { exact: byQrLower, candidates: [] };

    const byId = machines.find((m) => m.id === raw);
    if (byId) return { exact: byId, candidates: [] };

    try {
      const parsed = JSON.parse(raw);
      if (parsed?.qr_code) {
        const m = machines.find((mm) => mm.qr_code === parsed.qr_code);
        if (m) return { exact: m, candidates: [] };
      }
      if (parsed?.id) {
        const m = machines.find((mm) => mm.id === parsed.id);
        if (m) return { exact: m, candidates: [] };
      }
      if (parsed?.name) {
        const m = machines.find((mm) => normalize(mm.name) === normalize(parsed.name));
        if (m) return { exact: m, candidates: [] };
      }
    } catch { /* not JSON */ }

    const byName = machines.find((m) => normalize(m.name) === norm);
    if (byName) return { exact: byName, candidates: [] };

    const byTag = machines.find((m) => m.tag && normalize(m.tag) === norm);
    if (byTag) return { exact: byTag, candidates: [] };

    // Matches difusos: nunca auto-seleciona, retorna candidatos
    const candidates = machines.filter((m) =>
      normalize(m.name).includes(norm) ||
      norm.includes(normalize(m.name)) ||
      (m.qr_code && norm.includes(m.qr_code.toLowerCase())),
    );
    return { candidates };
  }

  function selectMachine(machine: Machine) {
    setSelectedMachine(machine);
    setTag(machine.tag || machine.qr_code || '');
    setMachines((prev) => prev.some((m) => m.id === machine.id) ? prev : [...prev, machine]);
    setView('items');
  }

  async function handleBarcode({ data }: { data: string }) {
    if (scanned) return;
    setScanned(true);

    const raw = data.trim();

    // 1) Match local
    const local = findMachineMatch(raw);
    if (local.exact) {
      selectMachine(local.exact);
      return;
    }

    // 2) Match exato no Supabase por qr_code
    try {
      const { data: byQr } = await supabase
        .from('machines')
        .select('*')
        .eq('qr_code', raw)
        .eq('active', true)
        .maybeSingle();

      if (byQr) {
        selectMachine(byQr as Machine);
        return;
      }

      // 3) Match exato por nome (case-insensitive)
      const { data: byName } = await supabase
        .from('machines')
        .select('*')
        .ilike('name', raw)
        .eq('active', true)
        .limit(1)
        .maybeSingle();

      if (byName) {
        selectMachine(byName as Machine);
        return;
      }
    } catch {
      // ignora — cai pro fluxo manual
    }

    // 4) Sem match exato. Se houver candidatos parciais, deixa o operador escolher.
    setTag(raw);
    if (local.candidates.length > 0) {
      Alert.alert(
        'Confirme a maquina',
        `Codigo lido: "${raw}"\n\nNao encontramos correspondencia exata. Selecione manualmente.`,
        [
          { text: 'Cancelar', style: 'cancel', onPress: () => setScanned(false) },
          { text: 'Selecionar', onPress: () => { setView('pick'); setScanned(false); } },
        ],
      );
      return;
    }

    const msg = machines.length === 0
      ? `Codigo: "${raw}"\n\nNenhuma maquina foi carregada. Verifique se existem maquinas cadastradas no painel web.`
      : `Codigo: "${raw}"\n\n${machines.length} maquinas carregadas, mas nenhuma com este codigo.\n\nSelecione manualmente.`;
    Alert.alert('Maquina nao encontrada', msg, [
      { text: 'Selecionar', onPress: () => { setView('pick'); setScanned(false); } },
    ]);
  }

  // Cria safety_alerts de NC para encarregado e supervisores
  async function createNcAlerts(
    checklistId: string,
    machineName: string,
    ncEntries: [string, ItemResponse][],
    result: 'released' | 'not_released',
  ) {
    if (!user || !selectedEncarregadoId) return;
    try {
      const ncDescriptions = ncEntries.map(([itemId]) => {
        return templateItems.find((i) => i.id === itemId)?.description ?? 'Item';
      });
      const title = `NC: ${machineName}`;
      const ncList = ncDescriptions.map((d, i) => `${i + 1}. ${d}`).join('\n');
      const message = `${ncEntries.length} não conformidade(s):\n${ncList}`;
      const severity = result === 'not_released' ? 'high' : 'medium';

      // Alerta para o encarregado responsavel
      await supabase.from('safety_alerts').insert({
        title,
        message,
        severity,
        operator_id: selectedEncarregadoId,
        created_by: user.id,
      });

      // Broadcast para supervisores (operator_id = null):
      // a RLS permite que supervisor/encarregado leia alertas sem destinatario
      await supabase.from('safety_alerts').insert({
        title,
        message,
        severity,
        operator_id: null,
        created_by: user.id,
      });
    } catch (e) {
      if (isDev()) console.log('[Checklist] createNcAlerts erro:', e);
    }
  }

  // --- Save ---
  async function handleSave() {
    if (saving) return;
    if (!user || !selectedMachine || !profile) return;
    if (!selectedEncarregadoId) {
      Alert.alert('Atencao', 'Selecione o encarregado responsavel antes de salvar.');
      return;
    }
    if (!allItemsAnswered()) {
      Alert.alert('Atencao', 'Responda todos os itens antes de salvar.');
      return;
    }
    if (!allRequiredPhotosTaken()) {
      Alert.alert('Atencao', 'Anexe as 4 fotos do equipamento antes de salvar.');
      return;
    }

    setSaving(true);
    const result = calculateResult();
    // ID gerado no cliente: permite subir as fotos ANTES de criar a linha,
    // garantindo que nenhum checklist orfao seja persistido em caso de falha.
    const checklistId = Crypto.randomUUID();
    const uploadedPaths: string[] = [];

    try {
      // 1) Subir fotos obrigatorias com concorrencia limitada
      const equipmentLabels = ['Frente', 'Traseira', 'Lateral esquerda', 'Lateral direita'];
      const eqUploads = equipmentPhotos.map((uri, idx) => ({ uri, idx }));
      const equipmentPaths = await runWithConcurrency(eqUploads, UPLOAD_CONCURRENCY, async ({ uri, idx }) => {
        if (!uri) return null;
        const path = await uploadPhoto(uri, checklistId, `equipment_${idx + 1}`, equipmentLabels[idx]);
        uploadedPaths.push(path);
        return path;
      });

      // 2) Subir fotos por item (mesmo limite de concorrencia)
      const entries = Object.entries(responses);
      const itemPhotoTargets = entries
        .map(([itemId, resp]) => ({ itemId, uri: resp.photoUri }))
        .filter((t): t is { itemId: string; uri: string } => !!t.uri);
      const itemPaths = await runWithConcurrency(itemPhotoTargets, UPLOAD_CONCURRENCY, async ({ itemId, uri }) => {
        const item = templateItems.find((i) => i.id === itemId);
        const path = await uploadPhoto(uri, checklistId, itemId, item?.description);
        uploadedPaths.push(path);
        return { itemId, path };
      });
      const photoUrls: Record<string, string> = {};
      for (const { itemId, path } of itemPaths) photoUrls[itemId] = path;

      // 3) Buscar pre_operation_check do dia (opcional)
      const { data: preOp } = await supabase
        .from('pre_operation_checks').select('id')
        .eq('operator_id', user.id).eq('date', today).maybeSingle();

      const selectedEncarregado = encarregados.find((e) => e.id === selectedEncarregadoId);

      // 4) Insert do checklist com ID pre-gerado e ja com as URLs das fotos
      const { error: clErr } = await supabase.from('checklists').insert({
        id: checklistId,
        operator_id: user.id,
        machine_id: selectedMachine.id,
        pre_operation_id: preOp?.id ?? null,
        machine_name: selectedMachine.name,
        tag: tag || selectedMachine.tag || null,
        shift: shift || null,
        max_load_capacity: selectedMachine.max_load_capacity || null,
        date: today,
        status: 'pending',
        result,
        encarregado_id: selectedEncarregadoId,
        inspector_name: selectedEncarregado?.full_name || selectedEncarregado?.email || null,
        equipment_photo_1_url: equipmentPaths[0],
        equipment_photo_2_url: equipmentPaths[1],
        equipment_photo_3_url: equipmentPaths[2],
        equipment_photo_4_url: equipmentPaths[3],
        environment_photo_url: null,
      });
      if (clErr) {
        if (isDev()) console.log('[Checklist] Insert erro:', clErr.message);
        throw new Error('Nao foi possivel salvar o checklist. Tente novamente.');
      }

      // 5) Insert das respostas — falha aqui aciona rollback do checklist
      const { error: respErr } = await supabase.from('checklist_responses').insert(
        entries.map(([itemId, resp]) => ({
          checklist_id: checklistId,
          machine_item_id: itemId,
          status: resp.status ?? 'C',
          response_value: resp.value ?? null,
          photo_url: photoUrls[itemId] ?? null,
        })),
      );
      if (respErr) {
        if (isDev()) console.log('[Checklist] Insert responses erro:', respErr.message);
        await supabase.from('checklists').delete().eq('id', checklistId);
        throw new Error('Nao foi possivel salvar as respostas. Tente novamente.');
      }

      void recordTrackingEvent(user.id, 'checklist_start', { checklistId });

      // Notifica encarregado + supervisores quando ha NCs
      const ncEntries = entries.filter(([_, resp]) => resp.status === 'NC');
      if (ncEntries.length > 0) {
        void createNcAlerts(checklistId, selectedMachine.name, ncEntries, result);
      }

      const msg = result === 'released'
        ? 'EQUIPAMENTO LIBERADO AO TRABALHO'
        : 'NAO LIBERADO. SOLICITAR MANUTENCAO';

      Alert.alert(msg, 'Checklist salvo!', [
        { text: 'OK', onPress: () => { resetFlow(); loadChecklists(); } },
      ]);
    } catch (e: any) {
      // Limpa storage para nao deixar lixo orfao no bucket
      if (uploadedPaths.length > 0) {
        try {
          await supabase.storage.from('checklist-photos').remove(uploadedPaths);
        } catch (cleanupErr) {
          if (isDev()) console.log('[Checklist] Cleanup erro:', cleanupErr);
        }
      }
      Alert.alert('Erro ao salvar', e?.message ?? 'Falha inesperada ao salvar o checklist.');
    } finally {
      setSaving(false);
    }
  }

  // --- VIEWS ---

  // SCAN
  if (view === 'scan') {
    if (!permission?.granted) {
      return (
        <View style={st.centered}>
          <Ionicons name="camera-outline" size={48} color={colors.textLight} />
          <Text style={st.permText}>Permita o acesso a camera para escanear QR Code</Text>
          <TouchableOpacity style={st.permBtn} onPress={requestPermission}>
            <Text style={st.permBtnText}>Permitir Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.linkBtn} onPress={() => setView('pick')}>
            <Text style={st.linkText}>Escolher manualmente</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={st.scanContainer}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'code128'] }}
          onBarcodeScanned={scanned ? undefined : handleBarcode}
        />
        <View style={st.scanOverlay}>
          <View style={st.scanHeader}>
            <TouchableOpacity onPress={resetFlow}>
              <Ionicons name="arrow-back" size={24} color={colors.white} />
            </TouchableOpacity>
            <Text style={st.scanTitle}>Escanear QR Code da Maquina</Text>
          </View>
          <View style={st.scanFrame} />
          <TouchableOpacity style={st.scanManual} onPress={() => setView('pick')}>
            <Ionicons name="list" size={20} color={colors.white} />
            <Text style={st.scanManualText}>Escolher manualmente</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // PICK
  if (view === 'pick') {
    const filtered = machines.filter((m) => {
      const q = machineSearch.toLowerCase();
      return m.name.toLowerCase().includes(q) ||
        (m.tag && m.tag.toLowerCase().includes(q)) ||
        (m.qr_code && m.qr_code.toLowerCase().includes(q));
    });

    function handlePickMachine(item: Machine) {
      setSelectedMachine(item);
      setTag(item.tag || item.qr_code || '');
      setView('items');
    }

    return (
      <View style={st.page}>
        <AppHeader onBack={resetFlow} />
        <View style={st.pickHeader}>
          <Text style={st.pickFieldLabel}>Selecionar máquina</Text>
          <View style={st.searchRow}>
            <Ionicons name="search" size={20} color={colors.textLight} style={st.searchIcon} />
            <TextInput
              style={st.searchInputNew}
              placeholder="Buscar por nome, tag ou codigo..."
              placeholderTextColor={colors.textLight}
              value={machineSearch}
              onChangeText={setMachineSearch}
            />
            {machineSearch.length > 0 && (
              <TouchableOpacity onPress={() => setMachineSearch('')} style={st.searchClear}>
                <Ionicons name="close-circle" size={20} color={colors.textLight} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={st.pickList}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={st.machineCard}
              onPress={() => handlePickMachine(item)}
              activeOpacity={0.7}
            >
              <View style={st.machineIconWrap}>
                <Ionicons name="camera-outline" size={22} color={colors.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.machineName} numberOfLines={2}>{item.name}</Text>
                <View style={st.machineMetaRow}>
                  {item.qr_code && (
                    <View style={st.machineMetaBadge}>
                      <Ionicons name="qr-code" size={10} color={colors.primary} />
                      <Text style={st.machineMetaText}>{item.qr_code}</Text>
                    </View>
                  )}
                  {item.tag && (
                    <View style={st.machineMetaBadge}>
                      <Ionicons name="pricetag" size={10} color={colors.textSecondary} />
                      <Text style={st.machineMetaText}>{item.tag}</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={st.machineArrow}>
                <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={st.centered}>
              <Ionicons name="search-outline" size={48} color={colors.textLight} />
              <Text style={st.emptyText}>Nenhuma maquina encontrada</Text>
            </View>
          }
        />
      </View>
    );
  }

  // ITEMS
  if (view === 'items') {
    if (itemsLoading) {
      return (
        <View style={st.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[st.emptyText, { marginTop: spacing.md }]}>Carregando itens do checklist...</Text>
        </View>
      );
    }

    const groups = groupedItems;
    const answered = templateItems.filter(isItemAnswered).length;
    const total = templateItems.length;
    const progress = total > 0 ? answered / total : 0;

    return (
      <KeyboardAvoidingView style={st.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppHeader onBack={() => setView('pick')} />
      <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled">
        <View style={[st.encarregadoChoice, st.encarregadoChoiceSel]}>
          <View style={[st.encarregadoAvatar, st.encarregadoAvatarSel]}>
            <Ionicons name="image-outline" size={22} color={colors.primary} />
          </View>
          <View style={st.encarregadoInfo}>
            <Text style={st.encarregadoName} numberOfLines={1}>
              {selectedMachine?.name}
            </Text>
            <Text style={st.encarregadoRole}>
              {selectedMachine?.tag || selectedMachine?.qr_code || 'Sem TAG'}
            </Text>
          </View>
        </View>

        {/* Responsavel (Encarregado) */}
        <Text style={st.sectionLabel}>Encarregado responsável</Text>
        {encarregados.length === 0 ? (
          <View style={st.emptyEncarregado}>
            <Ionicons
              name={encarregadosError ? 'alert-circle-outline' : 'person-outline'}
              size={20}
              color={encarregadosError ? colors.danger : colors.textLight}
            />
            <Text style={st.emptyEncarregadoText}>
              {encarregadosError
                ? 'Falha ao carregar encarregados. Verifique sua conexao.'
                : 'Nenhum encarregado ativo cadastrado. Solicite o cadastro ao admin.'}
            </Text>
            {encarregadosError && (
              <TouchableOpacity
                style={st.permBtn}
                onPress={() => loadEncarregados()}
              >
                <Text style={st.permBtnText}>Tentar novamente</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          encarregados.map((e) => {
            const isSel = e.id === selectedEncarregadoId;
            const display = e.full_name || e.email;
            return (
              <TouchableOpacity
                key={e.id}
                style={[st.encarregadoChoice, isSel && st.encarregadoChoiceSel]}
                onPress={() => setSelectedEncarregadoId(e.id)}
                activeOpacity={0.8}
              >
                <View style={[st.encarregadoAvatar, isSel && st.encarregadoAvatarSel]}>
                  <Ionicons
                    name="image-outline"
                    size={22}
                    color={isSel ? colors.primary : colors.textSecondary}
                  />
                </View>
                <View style={st.encarregadoInfo}>
                  <Text style={st.encarregadoName} numberOfLines={1}>{display}</Text>
                  <Text style={st.encarregadoRole}>Encarregado</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* Turno — segmented control */}
        <Text style={st.sectionLabel}>Turno</Text>
        <View style={st.segmented}>
          {['Diurno', 'Noturno'].map((sv) => (
            <TouchableOpacity
              key={sv}
              style={[st.segmentedItem, shift === sv && st.segmentedItemActive]}
              onPress={() => setShift(sv)}
              activeOpacity={0.7}
            >
              <Text style={[st.segmentedText, shift === sv && st.segmentedTextActive]}>{sv}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Progress */}
        <View style={st.progressWrap}>
          <View style={st.progressTextRow}>
            <Text style={st.progressLabel}>Progresso</Text>
            <Text style={st.progressCount}>{answered} de {total}</Text>
          </View>
          <View style={st.progressBar}>
            <View style={[st.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>

        {Object.entries(groups).map(([section, items]) => {
          const sectionAnswered = items.filter(isItemAnswered).length;
          return (
          <View key={section}>
            <View style={st.groupHeader}>
              <Text style={st.groupTitle}>{section}</Text>
              <View style={[
                st.groupCount,
                sectionAnswered === items.length && st.groupCountDone,
              ]}>
                <Text style={[
                  st.groupCountText,
                  sectionAnswered === items.length && st.groupCountTextDone,
                ]}>
                  {sectionAnswered}/{items.length}
                </Text>
              </View>
            </View>
            {items.map((item, idx) => {
              const resp = responses[item.id];
              const answered = isItemAnswered(item);
              return (
                <View
                  key={item.id}
                  style={[
                    st.itemCard,
                    item.is_blocking && st.itemBlocking,
                    answered && resp?.status !== 'NC' && st.itemAnswered,
                    resp?.status === 'NC' && st.itemNc,
                  ]}
                >
                  <View style={st.itemHeader}>
                    <View style={st.itemNumber}>
                      <Text style={st.itemNumberText}>{idx + 1}</Text>
                    </View>
                    <Text style={st.itemDesc}>{item.description}</Text>
                    {answered && resp?.status !== 'NC' && (
                      <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                    )}
                    {resp?.status === 'NC' && (
                      <Ionicons name="alert-circle" size={18} color={colors.danger} />
                    )}
                  </View>
                  {item.is_blocking && (
                    <View style={st.blockingRow}>
                      <Ionicons name="alert" size={11} color={colors.danger} />
                      <Text style={st.blockText}>Item impeditivo</Text>
                    </View>
                  )}

                  {(item.response_type === 'yes_no' || item.response_type === 'yes_no_na') && (
                    <>
                      <View style={st.statusRow}>
                        <TouchableOpacity
                          style={[st.statusBtn, resp?.status === 'C' && st.statusC]}
                          onPress={() => setItemStatus(item.id, 'C')}
                        >
                          <Text style={[st.statusBtnText, resp?.status === 'C' && st.statusBtnTextActive]}>Sim</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[st.statusBtn, resp?.status === 'NC' && st.statusNC]}
                          onPress={() => setItemStatus(item.id, 'NC')}
                        >
                          <Text style={[st.statusBtnText, resp?.status === 'NC' && st.statusBtnTextActive]}>Nao</Text>
                        </TouchableOpacity>
                        {item.response_type === 'yes_no_na' && (
                          <TouchableOpacity
                            style={[st.statusBtn, resp?.status === 'NA' && st.statusNA]}
                            onPress={() => setItemStatus(item.id, 'NA')}
                          >
                            <Text style={[st.statusBtnText, resp?.status === 'NA' && st.statusBtnTextActive]}>N.A.</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {resp?.status === 'NC' && (
                        <View style={st.ncPanel}>
                          <Text style={st.ncPanelTitle}>Evidencia da nao conformidade</Text>
                          <TextInput
                            style={st.textInput}
                            placeholder="Descreva o que aconteceu (opcional)"
                            placeholderTextColor={colors.textLight}
                            value={resp?.value ?? ''}
                            onChangeText={(t) => setItemNcDescription(item.id, t)}
                            multiline
                          />
                          <TouchableOpacity
                            style={[st.photoFullBtn, { marginTop: spacing.sm }]}
                            onPress={() => pickItemPhoto(item.id)}
                          >
                            <Ionicons
                              name={resp?.photoUri ? 'checkmark-circle' : 'camera'}
                              size={20}
                              color={resp?.photoUri ? colors.success : colors.primary}
                            />
                            <Text style={[st.photoFullBtnText, resp?.photoUri && { color: colors.success }]}>
                              {resp?.photoUri ? 'Foto capturada — toque para refazer' : 'Tirar foto * (obrigatoria)'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </>
                  )}

                  {item.response_type === 'text' && (
                    <TextInput
                      style={st.textInput}
                      placeholder="Digite a resposta..."
                      placeholderTextColor={colors.textLight}
                      value={resp?.value ?? ''}
                      onChangeText={(t) => setItemValue(item.id, t)}
                      multiline
                    />
                  )}

                  {item.response_type === 'numeric' && (
                    <TextInput
                      style={st.textInput}
                      placeholder="Digite o numero..."
                      placeholderTextColor={colors.textLight}
                      value={resp?.value ?? ''}
                      onChangeText={(t) => setItemValue(item.id, t.replace(/[^0-9.,-]/g, ''))}
                      keyboardType="numeric"
                    />
                  )}

                  {item.response_type === 'photo' && (
                    <TouchableOpacity style={st.photoFullBtn} onPress={() => pickItemPhoto(item.id, true)}>
                      <Ionicons
                        name={resp?.photoUri ? 'checkmark-circle' : 'camera'}
                        size={20}
                        color={resp?.photoUri ? colors.success : colors.primary}
                      />
                      <Text style={[st.photoFullBtnText, resp?.photoUri && { color: colors.success }]}>
                        {resp?.photoUri ? 'Foto capturada — toque para refazer' : 'Tirar foto'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {resp?.photoUri && (
                    <ExpoImage
                      source={{ uri: resp.photoUri }}
                      style={st.thumb}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  )}
                </View>
              );
            })}
          </View>
          );
        })}

        {templateItems.length === 0 && (
          <View style={st.centered}>
            <Ionicons name="document-outline" size={48} color={colors.textLight} />
            <Text style={st.emptyText}>Nenhuma pergunta cadastrada para esta maquina</Text>
            <Text style={[st.emptyText, { fontSize: fontSize.sm }]}>Adicione perguntas no painel web</Text>
          </View>
        )}

        {templateItems.length > 0 && (
          <TouchableOpacity
            style={[st.nextBtn, (!allItemsAnswered() || !selectedEncarregadoId) && st.btnDisabled]}
            onPress={() => {
              if (!selectedEncarregadoId) {
                Alert.alert('Atencao', 'Selecione o encarregado responsavel antes de prosseguir.');
                return;
              }
              if (allItemsAnswered()) {
                setView('photos');
                return;
              }
              const hasNcWithoutPhoto = templateItems.some((i) => {
                const r = responses[i.id];
                return r?.status === 'NC' && !r?.photoUri;
              });
              if (hasNcWithoutPhoto) {
                Alert.alert('Atencao', 'Anexe uma foto em cada item marcado como "Nao" antes de prosseguir.');
              } else {
                Alert.alert('Atencao', 'Responda todos os itens antes de prosseguir.');
              }
            }}
          >
            <Text style={st.nextBtnText}>Continuar</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.white} />
          </TouchableOpacity>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // PHOTOS — 4 fotos do equipamento
  if (view === 'photos') {
    const equipmentLabels = [
      'Frente',
      'Traseira',
      'Lateral esquerda',
      'Lateral direita',
    ];
    const taken = equipmentPhotos.filter((p) => !!p).length;
    const totalSlots = 4;
    const progressPct = Math.round((taken / totalSlots) * 100);

    return (
      <>
        <View style={st.page}>
        <AppHeader onBack={() => setView('items')} />
        <ScrollView contentContainerStyle={st.scroll}>
          <View style={st.photosHeader}>
            <Text style={st.stepTitle}>Registro do equipamento</Text>
          </View>

          <View style={st.progressCard}>
            <View style={st.progressTopRow}>
              <Text style={st.progressTitle}>Progresso</Text>
              <Text style={st.progressValue}>{taken}/{totalSlots}</Text>
            </View>
            <View style={st.progressBar}>
              <View style={[st.progressFill, { width: `${progressPct}%` }]} />
            </View>
            <Text style={st.progressHint}>
              {taken === totalSlots
                ? 'Tudo certo, pode finalizar.'
                : `Faltam ${totalSlots - taken} foto${totalSlots - taken > 1 ? 's' : ''}.`}
            </Text>
          </View>

          <Text style={st.sectionTitle}>Equipamento</Text>
          <View style={st.photoGrid}>
            {equipmentPhotos.map((uri, idx) => (
              <PhotoSlotCard
                key={idx}
                uri={uri}
                number={idx + 1}
                label={equipmentLabels[idx]}
                slot={`equipment_${idx + 1}` as RequiredSlot}
                onTake={takeRequiredPhoto}
                onConfirmClear={confirmClearPhoto}
                onPreview={setPreviewUri}
              />
            ))}
          </View>

          <TouchableOpacity
            style={[st.nextBtn, (!allRequiredPhotosTaken() || saving) && st.btnDisabled]}
            onPress={() => {
              if (saving) return;
              if (!allRequiredPhotosTaken()) {
                const missingEq = equipmentPhotos.findIndex((p) => !p);
                Alert.alert(
                  'Foto faltando',
                  `Tire a foto "${equipmentLabels[missingEq]}" do equipamento antes de finalizar.`,
                );
                return;
              }
              handleSave();
            }}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Ionicons name="checkmark-circle" size={20} color={colors.white} />
            )}
            <Text style={st.nextBtnText}>{saving ? 'Salvando checklist...' : 'Finalizar Checklist'}</Text>
          </TouchableOpacity>
        </ScrollView>
        </View>

        <Modal
          visible={!!previewUri}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewUri(null)}
        >
          <Pressable style={st.previewBackdrop} onPress={() => setPreviewUri(null)}>
            {previewUri && (
              <ExpoImage
                source={{ uri: previewUri }}
                style={st.previewImage}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            )}
            <View style={st.previewCloseBtn}>
              <Ionicons name="close" size={24} color={colors.white} />
            </View>
          </Pressable>
        </Modal>
      </>
    );
  }


  // --- LIST VIEW ---
  if (listLoading) {
    return <View style={st.centered}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <View style={commonStyles.container}>
      <AppHeader subtitle="Checklists do equipamento" />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={st.sectionHeader}>
            <Text style={st.sectionHeaderLabel}>{section.title.toUpperCase()}</Text>
            <View style={st.sectionHeaderLine} />
            <Text style={st.sectionHeaderCount}>{String(section.data.length).padStart(2, '0')}</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const isQueuedFinish = pendingFinishes.checklistIds.has(item.id);
          const isReleased = item.result === 'released';
          const isPending = item.status === 'pending' && !isQueuedFinish;

          const statusColor = isQueuedFinish
            ? colors.warning
            : isPending ? colors.warning
            : isReleased ? colors.success
            : colors.danger;

          const statusLabel = isQueuedFinish
            ? 'Sincronizando'
            : isPending ? 'Em andamento'
            : isReleased ? 'Liberado'
            : 'Não liberado';

          const startedAt = new Date(item.created_at);
          const endedAt = item.ended_at ? new Date(item.ended_at) : null;
          const dateStr = startedAt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
          const timeStr = startedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

          let durationStr: string | null = null;
          if (endedAt) {
            const ms = endedAt.getTime() - startedAt.getTime();
            const min = Math.max(1, Math.round(ms / 60000));
            if (min < 60) durationStr = `${min} min`;
            else durationStr = `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
          }

          const imageUri = item.photo_signed_url ?? null;

          return (
            <View style={st.listCardNew}>
              <View style={st.cardRow}>
                {imageUri ? (
                  <ExpoImage
                    source={{ uri: imageUri }}
                    style={st.cardImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <View style={[st.cardImage, st.cardImagePlaceholder]}>
                    <Ionicons name="construct-outline" size={28} color={colors.textLight} />
                  </View>
                )}

                <View style={st.cardInfo}>
                  <Text style={st.machineName} numberOfLines={2}>{item.machine_name}</Text>

                  <View style={st.metaRow}>
                    <View style={st.metaItem}>
                      <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
                      <Text style={st.metaText}>{dateStr}</Text>
                    </View>
                    <Text style={st.metaSep}>|</Text>
                    <View style={st.metaItem}>
                      <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
                      <Text style={st.metaText}>{durationStr ?? timeStr}</Text>
                    </View>
                    {item.tag ? (
                      <>
                        <Text style={st.metaSep}>|</Text>
                        <View style={st.metaItem}>
                          <Ionicons name="pricetag-outline" size={12} color={colors.textSecondary} />
                          <Text style={st.metaText} numberOfLines={1}>{item.tag}</Text>
                        </View>
                      </>
                    ) : null}
                  </View>

                  <View style={st.statusFooter}>
                    <View style={st.statusGroup}>
                      <View style={[st.statusDot, { backgroundColor: statusColor }]} />
                      <Text style={st.statusLabel}>{statusLabel}</Text>
                    </View>

                    {isPending && (
                      <TouchableOpacity style={st.finishBtnNew} onPress={() => setChecklistToFinish(item)}>
                        <Ionicons name="stop-circle-outline" size={14} color={colors.white} />
                        <Text style={st.finishBtnText}>Finalizar checklist</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>

              {item.encarregado_confirmed && item.encarregado_confirmed_notes ? (
                <View style={st.encarregadoNotesBanner}>
                  <Ionicons name="shield-checkmark" size={14} color="#059669" />
                  <View style={{ flex: 1 }}>
                    <Text style={st.encarregadoNotesLabel}>Resposta do encarregado</Text>
                    <Text style={st.encarregadoNotesText}>{item.encarregado_confirmed_notes}</Text>
                  </View>
                </View>
              ) : item.result === 'not_released' && !item.encarregado_confirmed ? (
                <View style={st.encarregadoPendingBanner}>
                  <Ionicons name="time-outline" size={14} color="#D97706" />
                  <Text style={st.encarregadoPendingText}>Aguardando resposta do encarregado</Text>
                </View>
              ) : null}
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={st.cardSeparator} />}
        contentContainerStyle={st.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadChecklists(); await loadMachines(); setRefreshing(false); }} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={st.emptyWrap}>
            <View style={st.emptyIcon}>
              <Ionicons name="clipboard-outline" size={28} color={colors.textSecondary} />
            </View>
            <Text style={st.emptyTitle}>Nenhum checklist realizado</Text>
            <Text style={st.emptyMessage}>Toque no botão de QR Code para iniciar um novo checklist.</Text>
          </View>
        }
      />

      <FinishChecklistModal
        checklist={checklistToFinish}
        userId={user?.id}
        onClose={() => setChecklistToFinish(null)}
        onFinished={() => { setChecklistToFinish(null); loadChecklists(); }}
      />

      {/* FAB: QR scan + manual pick */}
      <View style={st.fabRow}>
        <TouchableOpacity style={st.fabSecondary} onPress={() => { resetFlow(); setView('pick'); }}>
          <Ionicons name="list" size={22} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={st.fab} onPress={() => { resetFlow(); setView('scan'); }}>
          <Ionicons name="qr-code" size={26} color={colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: spacing.lg },
  page: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },

  // Back
  topBar: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
    marginLeft: -spacing.sm,
    marginBottom: spacing.md,
    borderRadius: radius.full,
  },
  backText: { fontSize: fontSize.sm, color: colors.text, fontWeight: '600' },

  // Eyebrow / labels
  eyebrow: {
    fontSize: fontSize['2xs'],
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  sectionLabel: {
    fontSize: fontSize['2xs'],
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    marginBottom: spacing.sm,
  },
  tagChipText: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: '600' },

  // Card da máquina selecionada (mesmo padrão do encarregado)
  machineSelectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    ...elevation.sm,
  },
  machineSelectedAvatar: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  machineSelectedInfo: { flex: 1 },
  machineSelectedName: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
  },
  machineSelectedTag: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  machineSelectedSwap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Scanner
  scanContainer: { flex: 1, backgroundColor: '#000' },
  scanOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', padding: spacing.lg },
  scanHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingTop: spacing.xl },
  scanTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.white },
  scanFrame: { width: 240, height: 240, borderWidth: 2, borderColor: colors.white, borderRadius: radius.lg, alignSelf: 'center', opacity: 0.7 },
  scanManual: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md, paddingBottom: spacing.xl },
  scanManualText: { color: colors.white, fontSize: fontSize.base, fontWeight: '600' },

  // Permission
  permText: { fontSize: fontSize.base, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md, marginBottom: spacing.lg },
  permBtn: { backgroundColor: colors.primary, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: radius.sm },
  permBtnText: { color: colors.white, fontWeight: '700', fontSize: fontSize.base },
  linkBtn: { marginTop: spacing.md },
  linkText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '600' },

  // Pick
  pickHeader: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  pickSubtitle: {
    fontSize: fontSize['2xs'], color: colors.textSecondary, marginBottom: spacing.md,
    fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase',
  },
  pickFieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full, marginBottom: spacing.md,
  },
  searchIcon: { paddingLeft: spacing.md },
  searchInputNew: {
    flex: 1, paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.sm + 4,
    fontSize: fontSize.sm, color: colors.text,
  },
  searchClear: { paddingRight: spacing.md },
  pickList: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl * 2 },

  machineCard: {
    flexDirection: 'row', alignItems: 'center', padding: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border, gap: spacing.md,
  },
  machineIconWrap: {
    width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.surfaceMuted,
    justifyContent: 'center', alignItems: 'center',
  },
  machineMetaRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 3 },
  machineMetaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 0, paddingVertical: 0,
  },
  machineMetaText: { fontSize: fontSize.xs, color: colors.textSecondary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  machineArrow: { padding: spacing.xs },

  stepTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, letterSpacing: -0.4, marginBottom: spacing.sm },
  emptyText: { fontSize: fontSize.base, color: colors.textLight, textAlign: 'center', marginTop: spacing.xl },

  headerInfo: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm },
  inputGroup: { marginBottom: spacing.md },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, fontSize: fontSize.base, color: colors.text,
  },
  textInput: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    fontSize: fontSize.sm, color: colors.text,
    minHeight: 44,
  },
  photoFullBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm + 2, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  photoFullBtnText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },

  // Turno: botões outlined claros
  segmented: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  segmentedItem: {
    flex: 1,
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  segmentedItemActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  segmentedText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary },
  segmentedTextActive: { color: colors.white },

  encarregadoChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    ...elevation.sm,
  },
  encarregadoChoiceSel: { borderColor: colors.primary, borderWidth: 2 },
  encarregadoAvatar: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  encarregadoAvatarSel: { backgroundColor: colors.primarySurface },
  encarregadoInfo: {
    flex: 1,
  },
  encarregadoName: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
  },
  encarregadoRole: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  encarregadoEmail: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  emptyEncarregado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  emptyEncarregadoText: { flex: 1, fontSize: fontSize.sm, color: colors.textSecondary },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.text, paddingVertical: spacing.md + 2,
    borderRadius: radius.full, gap: spacing.sm, marginTop: spacing.lg,
  },
  nextBtnText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.white, letterSpacing: 0.2 },
  btnDisabled: { opacity: 0.35 },

  // Progress
  progressWrap: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  progressBar: { height: 4, backgroundColor: colors.surfaceMuted, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.text, borderRadius: 2 },
  progressLabel: {
    fontSize: fontSize['2xs'], fontWeight: '700', color: colors.textSecondary,
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  progressCount: { fontSize: fontSize.sm, color: colors.text, fontWeight: '600' },

  // Group header (Geral / seções)
  sectionTitle: {
    fontSize: fontSize['2xs'], fontWeight: '700', color: colors.textSecondary,
    letterSpacing: 1.2, textTransform: 'uppercase',
    marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  groupTitle: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
  },
  groupCount: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
  },
  groupCountDone: { backgroundColor: colors.successLight },
  groupCountText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  groupCountTextDone: { color: colors.successDark },

  // Item card
  itemCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemBlocking: { borderLeftWidth: 3, borderLeftColor: colors.danger },
  itemAnswered: { borderColor: colors.successLight, backgroundColor: colors.successSurface },
  itemNc: { borderColor: colors.dangerLight, backgroundColor: colors.dangerSurface },
  itemHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md, gap: spacing.sm },
  itemNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemNumberText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  itemDesc: { flex: 1, fontSize: fontSize.sm, fontWeight: '600', color: colors.text, lineHeight: 20, paddingTop: 2 },
  blockingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.sm,
    marginLeft: 32,
  },
  blockText: { fontSize: fontSize['2xs'], fontWeight: '700', color: colors.danger, letterSpacing: 0.4, textTransform: 'uppercase' },

  // Sim / Não / N.A. — outlined com cor de ação no estado ativo
  statusRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statusBtn: {
    flex: 1, paddingVertical: spacing.sm + 4, borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  statusC: { backgroundColor: colors.success, borderColor: colors.success },
  statusNC: { backgroundColor: colors.danger, borderColor: colors.danger },
  statusNA: { backgroundColor: colors.textSecondary, borderColor: colors.textSecondary },
  statusBtnText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary },
  statusBtnTextActive: { color: colors.white },
  photoBtn: { padding: spacing.xs },
  ncPanel: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSurface,
  },
  ncPanelTitle: {
    fontSize: fontSize['2xs'],
    fontWeight: '700',
    color: colors.dangerDark,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },

  // Required photos grid
  photosHeader: {
    marginBottom: spacing.md,
  },
  photosHeaderIcon: {
    display: 'none',
  },
  photosHeaderHint: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  progressCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  progressTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressTitle: {
    fontSize: fontSize['2xs'],
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  progressValue: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: colors.text,
  },
  progressHint: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  tipText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: 0,
  },
  photoSlot: {
    width: '48%',
    aspectRatio: 1.15,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    padding: spacing.sm,
  },
  photoSlotFilled: {
    borderColor: colors.text,
    backgroundColor: colors.text,
  },
  photoSlotImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  photoSlotWide: {
    width: '100%',
    height: 180,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    marginBottom: spacing.md,
    padding: spacing.sm,
  },
  photoSlotWideImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  photoSlotLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  photoSlotHint: {
    fontSize: fontSize.xs,
    color: colors.textLight,
    marginTop: 2,
    textAlign: 'center',
  },
  photoSlotOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: spacing.xs,
  },
  photoSlotTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  photoSlotBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  photoSlotFilledLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.white,
    flexShrink: 1,
  },
  photoNumberEmpty: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoNumberEmptyText: {
    fontSize: fontSize.xs,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  photoNumberFilled: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoNumberFilledText: {
    fontSize: fontSize.xs,
    fontWeight: '800',
    color: colors.white,
  },
  photoRemoveBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewCloseBtn: {
    position: 'absolute',
    top: 48,
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  thumb: { width: 60, height: 60, borderRadius: radius.sm, marginTop: spacing.sm },


  // List
  listHeaderTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
    paddingVertical: spacing.xs,
  },
  listRow: { flexDirection: 'row', alignItems: 'center' },
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  pendingCard: { borderLeftWidth: 3, borderLeftColor: colors.warning },
  listCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  listMachineName: { fontSize: fontSize.base, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
  metaLabel: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },

  finishBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.text, paddingVertical: spacing.sm + 4,
    borderRadius: radius.full, gap: spacing.xs, marginTop: spacing.md,
  },
  finishBtnText: { fontSize: fontSize.xs, fontWeight: '700', color: colors.white, letterSpacing: 0.2 },
  encarregadoNotesBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 10,
    marginHorizontal: 12,
    marginBottom: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  encarregadoNotesLabel: {
    fontSize: fontSize['2xs'],
    fontWeight: '700',
    color: '#059669',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  encarregadoNotesText: {
    fontSize: fontSize.sm,
    color: '#065F46',
    lineHeight: 18,
  },
  encarregadoPendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    marginHorizontal: 12,
    marginBottom: 10,
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  encarregadoPendingText: {
    fontSize: fontSize.xs,
    color: '#92400E',
    fontWeight: '600',
  },

  // ============ NEW LIST (refatorado) ============
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing['3xl'] * 2,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionHeaderLabel: {
    fontSize: fontSize.xs,
    letterSpacing: 1.6,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  sectionHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  sectionHeaderCount: {
    fontSize: fontSize.xs,
    letterSpacing: 1,
    fontWeight: '700',
    color: colors.textLight,
  },

  // Card
  listCardNew: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: 2,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardImage: {
    width: 92,
    height: 92,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  cardImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardInfo: {
    flex: 1,
    gap: 6,
  },
  cardSeparator: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  statusFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: 2,
  },
  statusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.1,
  },
  dateText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
  machineName: {
    fontSize: fontSize.base,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
    lineHeight: 19,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    color: colors.textSecondary,
    letterSpacing: 0.1,
  },
  metaSep: {
    fontSize: fontSize.xs,
    color: colors.textLight,
    fontWeight: '400',
  },
  finishBtnNew: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    backgroundColor: colors.text,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.full,
  },

  // Empty
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.base,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  emptyMessage: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },

  // FABs
  fabRow: {
    position: 'absolute', bottom: spacing.lg, right: spacing.lg,
    flexDirection: 'row', gap: spacing.sm, alignItems: 'center',
  },
  fabSecondary: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
    ...elevation.md,
  },
  fab: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    ...elevation.brand,
  },
});
