import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { decode } from 'base64-arraybuffer';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { Machine, MachineChecklistItem } from '../../src/types/database';
import { colors, elevation, spacing, radius, fontSize } from '../../src/theme/colors';
import { commonStyles } from '../../src/theme/commonStyles';
import { Badge } from '../../src/components/ui';
import { FinishChecklistModal } from '../../src/components/FinishChecklistModal';
import { usePendingFinishes } from '../../src/hooks/usePendingFinishes';

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'heic', 'webp'];

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
}

export default function ChecklistScreen() {
  const { user, operatorData } = useAuth();
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

  // Items
  const [templateItems, setTemplateItems] = useState<MachineChecklistItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [responses, setResponses] = useState<Record<string, ItemResponse>>({});

  // Required photos: 4 do equipamento + 1 do ambiente
  const [equipmentPhotos, setEquipmentPhotos] = useState<(string | null)[]>([null, null, null, null]);
  const [environmentPhoto, setEnvironmentPhoto] = useState<string | null>(null);

  // Result
  const [saving, setSaving] = useState(false);

  // Camera
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  // --- Data loading ---
  const loadChecklists = useCallback(async () => {
    if (!operatorData) { setListLoading(false); return; }
    const { data } = await supabase
      .from('checklists')
      .select('id, machine_name, tag, date, status, result, ended_at, created_at')
      .eq('operator_id', operatorData.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setChecklists((data as ChecklistRow[] | null) ?? []);
    setListLoading(false);
  }, [operatorData]);

  const loadMachines = useCallback(async () => {
    if (!user) {
      console.log('[Checklist] loadMachines: sem usuario autenticado, aguardando...');
      return;
    }
    const { data, error } = await supabase.from('machines').select('*').eq('active', true).order('name');
    console.log('[Checklist] loadMachines:', data?.length ?? 0, 'maquinas carregadas', error?.message ?? 'OK');
    if (data && data.length > 0) {
      console.log('[Checklist] Exemplo:', data[0].name, '| qr_code:', data[0].qr_code);
    }
    setMachines(data ?? []);
  }, [user]);

  useEffect(() => { loadChecklists(); loadMachines(); }, [loadChecklists, loadMachines]);

  // Load checklist items when machine selected
  useEffect(() => {
    if (!selectedMachine) return;
    setItemsLoading(true);
    supabase.from('machine_checklist_items').select('*')
      .eq('machine_id', selectedMachine.id).eq('active', true).order('order_index')
      .then(({ data, error }) => {
        if (error) {
          console.log('[Checklist] Erro ao carregar itens:', error.message);
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
  }, [selectedMachine]);

  // --- Helpers ---
  function resetFlow() {
    setView('list');
    setSelectedMachine(null);
    setMachineSearch('');
    setTag(''); setShift('');
    setTemplateItems([]); setItemsLoading(false); setResponses({});
    setEquipmentPhotos([null, null, null, null]);
    setEnvironmentPhoto(null);
    setScanned(false);
  }

  async function takeRequiredPhoto(slot: 'equipment_1' | 'equipment_2' | 'equipment_3' | 'equipment_4' | 'environment') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permissao', 'Permita o acesso a camera.'); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5, allowsEditing: true });
    if (result.canceled || !result.assets[0]) return;
    const uri = result.assets[0].uri;
    if (slot === 'environment') {
      setEnvironmentPhoto(uri);
    } else {
      const idx = parseInt(slot.split('_')[1], 10) - 1;
      setEquipmentPhotos((prev) => {
        const copy = [...prev];
        copy[idx] = uri;
        return copy;
      });
    }
  }

  function allRequiredPhotosTaken() {
    return equipmentPhotos.every((p) => !!p) && !!environmentPhoto;
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

  async function pickItemPhoto(id: string, isPhotoType = false) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permissao', 'Permita o acesso a camera.'); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5, allowsEditing: true });
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

  function calculateResult(): 'released' | 'not_released' {
    return templateItems.filter((i) => i.is_blocking).some((i) => responses[i.id]?.status === 'NC')
      ? 'not_released' : 'released';
  }

  function isItemAnswered(item: MachineChecklistItem): boolean {
    const r = responses[item.id];
    if (!r) return false;
    if (item.response_type === 'text' || item.response_type === 'numeric') {
      return !!r.value && r.value.trim().length > 0;
    }
    if (item.response_type === 'photo') {
      return !!r.photoUri;
    }
    return r.status !== null;
  }

  function allItemsAnswered() {
    return templateItems.every(isItemAnswered);
  }

  async function uploadPhoto(uri: string, checklistId: string, itemId: string) {
    try {
      const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        Alert.alert('Falha no upload da foto', `Tipo de imagem nao suportado: .${ext}`);
        return null;
      }
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const path = `${user?.id}/${checklistId}/${itemId}.${ext}`;
      const { error } = await supabase.storage.from('checklist-photos')
        .upload(path, decode(base64), { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`, upsert: true });
      if (error) {
        console.log('[Upload] Erro checklist foto:', error.message);
        Alert.alert('Falha no upload da foto', `${itemId}: ${error.message}`);
        return null;
      }
      return path;
    } catch (e: any) {
      console.log('[Upload] Excecao:', e);
      Alert.alert('Falha no upload da foto', e?.message ?? 'Erro inesperado ao enviar a imagem.');
      return null;
    }
  }

  function getGroupedItems() {
    const groups: Record<string, MachineChecklistItem[]> = {};
    templateItems.forEach((i) => {
      const s = i.section || 'Geral';
      if (!groups[s]) groups[s] = [];
      groups[s].push(i);
    });
    return groups;
  }

  // --- QR handler ---
  function normalize(str: string): string {
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  function findMachineMatch(qrData: string): Machine | undefined {
    const raw = qrData.trim();
    const norm = normalize(raw);

    // 1) Exact match on qr_code (e.g. "MAQ-A1B2C3D4")
    const byQr = machines.find((m) => m.qr_code === raw);
    if (byQr) return byQr;

    // 2) Case-insensitive match on qr_code
    const byQrLower = machines.find((m) => m.qr_code?.toLowerCase() === raw.toLowerCase());
    if (byQrLower) return byQrLower;

    // 3) Exact match on id (UUID)
    const byId = machines.find((m) => m.id === raw);
    if (byId) return byId;

    // 4) Try parsing as JSON
    try {
      const parsed = JSON.parse(raw);
      if (parsed.qr_code) {
        const m = machines.find((m) => m.qr_code === parsed.qr_code);
        if (m) return m;
      }
      if (parsed.id) {
        const m = machines.find((m) => m.id === parsed.id);
        if (m) return m;
      }
      if (parsed.name) {
        const m = machines.find((m) => normalize(m.name) === normalize(parsed.name));
        if (m) return m;
      }
    } catch { /* not JSON */ }

    // 5) Exact match on name (case/accent insensitive)
    const byName = machines.find((m) => normalize(m.name) === norm);
    if (byName) return byName;

    // 6) Match on tag
    const byTag = machines.find((m) => m.tag && normalize(m.tag) === norm);
    if (byTag) return byTag;

    // 7) Partial name match
    const byPartial = machines.find((m) =>
      normalize(m.name).includes(norm) || norm.includes(normalize(m.name))
    );
    if (byPartial) return byPartial;

    // 8) QR data contains qr_code somewhere (e.g. URL with code in it)
    const byQrContains = machines.find((m) => m.qr_code && norm.includes(m.qr_code.toLowerCase()));
    if (byQrContains) return byQrContains;

    return undefined;
  }

  async function handleBarcode({ data }: { data: string }) {
    if (scanned) return;
    setScanned(true);

    const raw = data.trim();

    // 1) Try local match first (instant)
    const localMatch = findMachineMatch(raw);
    if (localMatch) {
      setSelectedMachine(localMatch);
      setTag(localMatch.tag || localMatch.qr_code || '');
      setView('items');
      return;
    }

    // 2) Local match failed — query Supabase directly by qr_code
    try {
      const { data: byQr } = await supabase
        .from('machines')
        .select('*')
        .eq('qr_code', raw)
        .eq('active', true)
        .maybeSingle();

      if (byQr) {
        const machine = byQr as Machine;
        setSelectedMachine(machine);
        setTag(machine.tag || machine.qr_code || '');
        setMachines((prev) => prev.some((m) => m.id === machine.id) ? prev : [...prev, machine]);
        setView('items');
        return;
      }

      // 3) Try by name (case-insensitive)
      const { data: byName } = await supabase
        .from('machines')
        .select('*')
        .ilike('name', raw)
        .eq('active', true)
        .limit(1)
        .maybeSingle();

      if (byName) {
        const machine = byName as Machine;
        setSelectedMachine(machine);
        setTag(machine.tag || machine.qr_code || '');
        setMachines((prev) => prev.some((m) => m.id === machine.id) ? prev : [...prev, machine]);
        setView('items');
        return;
      }
    } catch {
      // Query failed — continue to manual selection
    }

    // 4) Nothing found — show diagnostic info
    setTag(raw);
    const msg = machines.length === 0
      ? `Codigo: "${raw}"\n\nNenhuma maquina foi carregada. Verifique se existem maquinas cadastradas no painel web.`
      : `Codigo: "${raw}"\n\n${machines.length} maquinas carregadas, mas nenhuma com este codigo.\n\nSelecione manualmente.`;
    Alert.alert('Maquina nao encontrada', msg, [
      { text: 'Selecionar', onPress: () => { setView('pick'); setScanned(false); } },
    ]);
  }

  // --- Save ---
  async function handleSave() {
    if (saving) return;
    if (!operatorData || !selectedMachine || !user) return;
    if (!allRequiredPhotosTaken()) {
      Alert.alert('Atencao', 'Anexe as 4 fotos do equipamento e a foto do ambiente antes de salvar.');
      return;
    }
    setSaving(true);
    const result = calculateResult();

    const { data: preOp } = await supabase
      .from('pre_operation_checks').select('id')
      .eq('operator_id', operatorData.id).eq('date', today).single();

    const { data: checklist, error: clErr } = await supabase.from('checklists').insert({
      operator_id: operatorData.id,
      machine_id: selectedMachine.id,
      pre_operation_id: preOp?.id ?? null,
      machine_name: selectedMachine.name,
      tag: tag || selectedMachine.tag || null,
      shift: shift || null,
      max_load_capacity: selectedMachine.max_load_capacity || null,
      date: today, status: 'pending', result,
      inspector_name: operatorData.name || null,
    }).select().single();

    if (clErr || !checklist) {
      Alert.alert('Erro', clErr?.message ?? 'Erro ao criar checklist.');
      setSaving(false);
      return;
    }

    // Upload das fotos obrigatorias do equipamento + ambiente
    const equipmentPaths: (string | null)[] = await Promise.all(
      equipmentPhotos.map((uri, idx) =>
        uri ? uploadPhoto(uri, checklist.id, `equipment_${idx + 1}`) : Promise.resolve(null),
      ),
    );
    const environmentPath = environmentPhoto
      ? await uploadPhoto(environmentPhoto, checklist.id, 'environment')
      : null;

    await supabase.from('checklists').update({
      equipment_photo_1_url: equipmentPaths[0],
      equipment_photo_2_url: equipmentPaths[1],
      equipment_photo_3_url: equipmentPaths[2],
      equipment_photo_4_url: equipmentPaths[3],
      environment_photo_url: environmentPath,
    }).eq('id', checklist.id);

    // Upload photos & save responses
    const entries = Object.entries(responses);
    const photoUrls: Record<string, string | null> = {};
    for (const [itemId, resp] of entries) {
      if (resp.photoUri) photoUrls[itemId] = await uploadPhoto(resp.photoUri, checklist.id, itemId);
    }
    await supabase.from('checklist_responses').insert(
      entries.map(([itemId, resp]) => ({
        checklist_id: checklist.id,
        machine_item_id: itemId,
        status: resp.status ?? 'C',
        response_value: resp.value ?? null,
        photo_url: photoUrls[itemId] ?? null,
      }))
    );

    setSaving(false);

    const msg = result === 'released'
      ? 'EQUIPAMENTO LIBERADO AO TRABALHO'
      : 'NAO LIBERADO. SOLICITAR MANUTENCAO';

    Alert.alert(msg, 'Checklist salvo!', [
      { text: 'OK', onPress: () => { resetFlow(); loadChecklists(); } },
    ]);
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
        <View style={st.pickHeader}>
          <TouchableOpacity style={st.backRow} onPress={resetFlow}>
            <Ionicons name="arrow-back" size={22} color={colors.primary} />
            <Text style={st.backText}>Voltar</Text>
          </TouchableOpacity>
          <Text style={st.stepTitle}>Selecione a Maquina</Text>
          <Text style={st.pickSubtitle}>{machines.length} maquinas disponiveis</Text>
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
                <Ionicons name="construct" size={24} color={colors.primary} />
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

    const groups = getGroupedItems();
    const answered = templateItems.filter(isItemAnswered).length;
    const total = templateItems.length;
    const progress = total > 0 ? answered / total : 0;

    return (
      <KeyboardAvoidingView style={st.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={st.backRow} onPress={() => setView('pick')}>
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
          <Text style={st.backText}>Voltar</Text>
        </TouchableOpacity>

        <Text style={st.stepTitle}>Checklist — {selectedMachine?.name}</Text>
        {selectedMachine?.tag && (
          <Text style={st.headerInfo}>TAG: {selectedMachine.tag}</Text>
        )}

        {/* Turno */}
        <View style={st.shiftRow}>
          {['Diurno', 'Noturno'].map((sv) => (
            <TouchableOpacity key={sv} style={[st.shiftBtn, shift === sv && st.shiftBtnActive]} onPress={() => setShift(sv)}>
              <Text style={[st.shiftBtnText, shift === sv && st.shiftBtnTextActive]}>{sv}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Progress bar */}
        <View style={st.progressWrap}>
          <View style={st.progressBar}>
            <View style={[st.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={st.progressLabel}>{answered}/{total} itens</Text>
        </View>

        {Object.entries(groups).map(([section, items]) => (
          <View key={section}>
            <Text style={st.sectionTitle}>{section}</Text>
            {items.map((item) => {
              const resp = responses[item.id];
              return (
                <View key={item.id} style={[st.itemCard, item.is_blocking && st.itemBlocking]}>
                  <View style={st.itemHeader}>
                    <Text style={st.itemDesc}>{item.description}</Text>
                    {item.is_blocking && (
                      <View style={st.blockBadge}>
                        <Ionicons name="alert" size={12} color={colors.danger} />
                        <Text style={st.blockText}>Impeditivo</Text>
                      </View>
                    )}
                  </View>

                  {(item.response_type === 'yes_no' || item.response_type === 'yes_no_na') && (
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
                      <TouchableOpacity style={st.photoBtn} onPress={() => pickItemPhoto(item.id)}>
                        <Ionicons
                          name={resp?.photoUri ? 'image' : 'camera-outline'}
                          size={20}
                          color={resp?.photoUri ? colors.success : colors.textSecondary}
                        />
                      </TouchableOpacity>
                    </View>
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

                  {resp?.photoUri && <Image source={{ uri: resp.photoUri }} style={st.thumb} />}
                </View>
              );
            })}
          </View>
        ))}

        {templateItems.length === 0 && (
          <View style={st.centered}>
            <Ionicons name="document-outline" size={48} color={colors.textLight} />
            <Text style={st.emptyText}>Nenhuma pergunta cadastrada para esta maquina</Text>
            <Text style={[st.emptyText, { fontSize: fontSize.sm }]}>Adicione perguntas no painel web</Text>
          </View>
        )}

        {templateItems.length > 0 && (
          <TouchableOpacity
            style={[st.nextBtn, !allItemsAnswered() && st.btnDisabled]}
            onPress={() => {
              if (allItemsAnswered()) setView('photos');
              else Alert.alert('Atencao', 'Responda todos os itens antes de prosseguir.');
            }}
          >
            <Text style={st.nextBtnText}>Proximo: Fotos</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.white} />
          </TouchableOpacity>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // PHOTOS — 4 fotos do equipamento + 1 do ambiente
  if (view === 'photos') {
    const equipmentLabels = [
      'Foto 1 do equipamento',
      'Foto 2 do equipamento',
      'Foto 3 do equipamento',
      'Foto 4 do equipamento',
    ];
    const taken = equipmentPhotos.filter((p) => !!p).length + (environmentPhoto ? 1 : 0);

    return (
      <ScrollView style={st.page} contentContainerStyle={st.scroll}>
        <TouchableOpacity style={st.backRow} onPress={() => setView('items')}>
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
          <Text style={st.backText}>Voltar</Text>
        </TouchableOpacity>

        <Text style={st.stepTitle}>Fotos obrigatorias</Text>
        <Text style={st.headerInfo}>
          Anexe 4 fotos do equipamento e 1 foto do ambiente onde voce vai trabalhar.
        </Text>

        <View style={st.progressWrap}>
          <View style={st.progressBar}>
            <View style={[st.progressFill, { width: `${(taken / 5) * 100}%` }]} />
          </View>
          <Text style={st.progressLabel}>{taken}/5 fotos</Text>
        </View>

        <Text style={st.sectionTitle}>Equipamento</Text>
        <View style={st.photoGrid}>
          {equipmentPhotos.map((uri, idx) => (
            <TouchableOpacity
              key={idx}
              style={st.photoSlot}
              onPress={() => takeRequiredPhoto(`equipment_${idx + 1}` as 'equipment_1')}
              activeOpacity={0.7}
            >
              {uri ? (
                <>
                  <Image source={{ uri }} style={st.photoSlotImage} />
                  <View style={st.photoSlotBadge}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  </View>
                </>
              ) : (
                <>
                  <Ionicons name="camera" size={28} color={colors.textLight} />
                  <Text style={st.photoSlotLabel}>{equipmentLabels[idx]}</Text>
                </>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <Text style={st.sectionTitle}>Ambiente de trabalho</Text>
        <TouchableOpacity
          style={[st.photoSlotWide]}
          onPress={() => takeRequiredPhoto('environment')}
          activeOpacity={0.7}
        >
          {environmentPhoto ? (
            <>
              <Image source={{ uri: environmentPhoto }} style={st.photoSlotWideImage} />
              <View style={st.photoSlotBadge}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              </View>
            </>
          ) : (
            <>
              <Ionicons name="image" size={32} color={colors.textLight} />
              <Text style={st.photoSlotLabel}>Foto do ambiente</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[st.nextBtn, (!allRequiredPhotosTaken() || saving) && st.btnDisabled]}
          onPress={() => {
            if (allRequiredPhotosTaken()) handleSave();
            else Alert.alert('Atencao', 'Anexe todas as 5 fotos antes de prosseguir.');
          }}
          disabled={saving}
        >
          <Text style={st.nextBtnText}>{saving ? 'Salvando...' : 'Finalizar Checklist'}</Text>
          <Ionicons name={saving ? 'hourglass' : 'checkmark-circle'} size={20} color={colors.white} />
        </TouchableOpacity>
      </ScrollView>
    );
  }


  // --- LIST VIEW ---
  if (listLoading) {
    return <View style={st.centered}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <View style={commonStyles.container}>
      <FlatList
        data={checklists}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          // Encerramento offline na fila: trata como ja finalizado (otimista),
          // assim o operador nao tenta finalizar de novo e duplicar o job.
          const isQueuedFinish = pendingFinishes.checklistIds.has(item.id);
          const isReleased = item.result === 'released';
          const isPending = item.status === 'pending' && !isQueuedFinish;
          const variant = isQueuedFinish
            ? 'warning'
            : isPending ? 'warning' : isReleased ? 'success' : 'danger';
          const label = isQueuedFinish
            ? 'SINCRONIZANDO'
            : isPending ? 'EM ANDAMENTO' : isReleased ? 'LIBERADO' : 'NÃO LIBERADO';
          const icon = isQueuedFinish
            ? 'cloud-upload-outline'
            : isPending ? 'time-outline' : isReleased ? 'checkmark-circle-outline' : 'close-circle-outline';
          return (
            <View style={[st.listCard, isPending && st.pendingCard]}>
              <View style={st.listCardHeader}>
                <View style={st.headerLeft}>
                  <Ionicons name={icon} size={14} color={colors.textSecondary} />
                  <Text style={st.metaLabel}>{new Date(item.date).toLocaleDateString('pt-BR')}</Text>
                </View>
                <Badge label={label} variant={variant} size="sm" />
              </View>
              <Text style={st.listMachineName}>{item.machine_name}</Text>
              {item.tag && <Text style={st.metaLabel}>TAG: {item.tag}</Text>}
              {isPending && (
                <TouchableOpacity style={st.finishBtn} onPress={() => setChecklistToFinish(item)}>
                  <Ionicons name="stop-circle-outline" size={18} color={colors.white} />
                  <Text style={st.finishBtnText}>Finalizar checklist</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        contentContainerStyle={commonStyles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadChecklists(); await loadMachines(); setRefreshing(false); }} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={commonStyles.empty}>
            <Ionicons name="clipboard-outline" size={40} color={colors.textLight} />
            <Text style={commonStyles.emptyText}>Nenhum checklist realizado</Text>
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
  backRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.lg },
  backText: { fontSize: fontSize.base, color: colors.primary, fontWeight: '600' },

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
  pickSubtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.md },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBg,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, marginBottom: spacing.sm,
  },
  searchIcon: { paddingLeft: spacing.md },
  searchInputNew: {
    flex: 1, padding: spacing.md, fontSize: fontSize.base, color: colors.text,
  },
  searchClear: { paddingRight: spacing.md },
  pickList: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl * 2 },

  machineCard: {
    flexDirection: 'row', alignItems: 'center', padding: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border, gap: spacing.md,
  },
  machineIconWrap: {
    width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.primary + '10',
    justifyContent: 'center', alignItems: 'center',
  },
  machineName: { fontSize: fontSize.base, fontWeight: '600', color: colors.text },
  machineMetaRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 4 },
  machineMetaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.background, paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: radius.full,
  },
  machineMetaText: { fontSize: fontSize.xs, color: colors.textSecondary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  machineArrow: { padding: spacing.xs },

  stepTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  emptyText: { fontSize: fontSize.base, color: colors.textLight, textAlign: 'center', marginTop: spacing.xl },

  headerInfo: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm },
  inputGroup: { marginBottom: spacing.md },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, padding: spacing.md, fontSize: fontSize.base, color: colors.text,
  },
  textInput: {
    backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, padding: spacing.md, fontSize: fontSize.base, color: colors.text,
    minHeight: 44,
  },
  photoFullBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  photoFullBtnText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.primary },
  shiftRow: { flexDirection: 'row', gap: spacing.sm },
  shiftBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  shiftBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  shiftBtnText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary },
  shiftBtnTextActive: { color: colors.white },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: radius.sm, gap: spacing.xs, marginTop: spacing.md,
  },
  nextBtnText: { fontSize: fontSize.base, fontWeight: '700', color: colors.white },
  btnDisabled: { opacity: 0.5 },

  // Items
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  progressBar: { flex: 1, height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  progressLabel: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '600' },
  sectionTitle: {
    fontSize: fontSize.base, fontWeight: '700', color: colors.primary,
    marginTop: spacing.md, marginBottom: spacing.sm, paddingBottom: spacing.xs,
    borderBottomWidth: 1, borderBottomColor: colors.primary + '30',
  },
  itemCard: {
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.sm, shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  itemBlocking: { borderLeftWidth: 3, borderLeftColor: colors.danger },
  itemHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  itemDesc: { flex: 1, fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  blockBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.dangerLight,
    paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full, gap: 2, marginLeft: spacing.xs,
  },
  blockText: { fontSize: 10, fontWeight: '700', color: colors.danger },
  statusRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  statusBtn: {
    flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  statusC: { backgroundColor: colors.success, borderColor: colors.success },
  statusNC: { backgroundColor: colors.danger, borderColor: colors.danger },
  statusNA: { backgroundColor: colors.textLight, borderColor: colors.textLight },
  statusBtnText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary },
  statusBtnTextActive: { color: colors.white },
  photoBtn: { padding: spacing.xs },

  // Required photos grid
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  photoSlot: {
    width: '48%', aspectRatio: 1, borderRadius: radius.md, borderWidth: 2,
    borderColor: colors.border, borderStyle: 'dashed',
    backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden', position: 'relative',
  },
  photoSlotImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  photoSlotWide: {
    width: '100%', height: 180, borderRadius: radius.md, borderWidth: 2,
    borderColor: colors.border, borderStyle: 'dashed',
    backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden', position: 'relative', marginBottom: spacing.md,
  },
  photoSlotWideImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  photoSlotLabel: {
    fontSize: fontSize.xs, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center',
  },
  photoSlotBadge: {
    position: 'absolute', top: spacing.xs, right: spacing.xs,
    backgroundColor: colors.white, borderRadius: 12,
  },

  thumb: { width: 60, height: 60, borderRadius: radius.sm, marginTop: spacing.sm },


  // List
  listRow: { flexDirection: 'row', alignItems: 'center' },
  // List card
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...elevation.sm,
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
  listMachineName: { fontSize: 16, fontWeight: '700', color: colors.text, letterSpacing: -0.1 },
  metaLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  finishBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary, paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm, gap: spacing.xs, marginTop: spacing.md,
    ...elevation.brand,
  },
  finishBtnText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.white, letterSpacing: 0.2 },

  // FABs
  fabRow: {
    position: 'absolute', bottom: spacing.lg, right: spacing.lg,
    flexDirection: 'row', gap: spacing.sm, alignItems: 'center',
  },
  fabSecondary: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
    ...elevation.sm,
  },
  fab: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    ...elevation.brand,
  },
});
