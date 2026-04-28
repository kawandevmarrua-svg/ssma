import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { Machine, MachineChecklistItem } from '../../src/types/database';
import { colors, elevation, spacing, radius, fontSize } from '../../src/theme/colors';
import { commonStyles } from '../../src/theme/commonStyles';
import { Badge } from '../../src/components/ui';
import { FinishChecklistModal } from '../../src/components/FinishChecklistModal';

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'heic', 'webp'];

type ItemResponse = {
  status: 'C' | 'NC' | 'NA' | null;
  value?: string;
  photoUri?: string;
};

interface ChecklistWithOperator {
  id: string;
  machine_name: string;
  tag: string | null;
  date: string;
  status: string;
  result: string | null;
  ended_at: string | null;
  created_at: string;
  operators: { name: string } | null;
}

export default function AdminChecklistsScreen() {
  const { user } = useAuth();
  const [checklists, setChecklists] = useState<ChecklistWithOperator[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myOperatorId, setMyOperatorId] = useState<string | null>(null);
  const [checklistToFinish, setChecklistToFinish] = useState<ChecklistWithOperator | null>(null);

  // Flow: list | scan | pick | items | photos | result
  const [view, setView] = useState<'list' | 'scan' | 'pick' | 'items' | 'photos' | 'result'>('list');

  // Machines
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [machineSearch, setMachineSearch] = useState('');

  // Header data
  const [shift, setShift] = useState('');

  // Items
  const [templateItems, setTemplateItems] = useState<MachineChecklistItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [responses, setResponses] = useState<Record<string, ItemResponse>>({});

  // Required photos: 4 do equipamento + 1 do ambiente
  const [equipmentPhotos, setEquipmentPhotos] = useState<(string | null)[]>([null, null, null, null]);
  const [environmentPhoto, setEnvironmentPhoto] = useState<string | null>(null);

  // Result
  const [inspectorName, setInspectorName] = useState('');
  const [saving, setSaving] = useState(false);

  // Camera
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  // --- Data loading ---
  const findMyOperator = useCallback(async () => {
    if (!user) return;
    const { data: selfOp, error: e1 } = await supabase
      .from('operators').select('id').eq('auth_user_id', user.id).single();
    console.log('[Checklist] findMyOperator selfOp:', selfOp, 'error:', e1?.message);
    if (selfOp) { setMyOperatorId(selfOp.id); return; }
    const { data: firstOp, error: e2 } = await supabase
      .from('operators').select('id').eq('created_by', user.id).eq('active', true)
      .order('created_at').limit(1).single();
    console.log('[Checklist] findMyOperator firstOp:', firstOp, 'error:', e2?.message);
    if (firstOp) setMyOperatorId(firstOp.id);
    else console.log('[Checklist] ATENCAO: Nenhum operador encontrado para user:', user.id);
  }, [user]);

  const loadChecklists = useCallback(async () => {
    if (!user) return;
    const { data: myOps } = await supabase
      .from('operators').select('id').eq('created_by', user.id);
    const opIds = (myOps ?? []).map((o) => o.id);
    const { data: selfOp } = await supabase.from('operators').select('id').eq('auth_user_id', user.id).single();
    if (selfOp && !opIds.includes(selfOp.id)) opIds.push(selfOp.id);
    console.log('[Checklist] loadChecklists opIds:', opIds, 'user:', user.id);
    if (opIds.length === 0) {
      console.log('[Checklist] Nenhum operador encontrado — lista vazia');
      setChecklists([]); setLoading(false); return;
    }
    const { data, error } = await supabase
      .from('checklists')
      .select('id, machine_name, tag, date, status, result, ended_at, created_at, operators(name)')
      .in('operator_id', opIds)
      .order('created_at', { ascending: false })
      .limit(50);
    console.log('[Checklist] loadChecklists resultado:', data?.length, 'itens, error:', error?.message);
    if (data) {
      const pending = data.filter((c: any) => c.status === 'pending').length;
      const completed = data.filter((c: any) => c.status !== 'pending').length;
      console.log('[Checklist] Pendentes:', pending, 'Concluidos:', completed);
    }
    setChecklists((data as ChecklistWithOperator[] | null) ?? []);
    setLoading(false);
  }, [user]);

  const loadMachines = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('machines').select('*').eq('active', true).order('name');
    setMachines((data as Machine[] | null) ?? []);
  }, [user]);

  useEffect(() => { loadChecklists(); findMyOperator(); loadMachines(); }, [loadChecklists, findMyOperator, loadMachines]);

  // Load checklist items when machine selected
  useEffect(() => {
    if (!selectedMachine) return;
    setItemsLoading(true);
    supabase.from('machine_checklist_items').select('*')
      .eq('machine_id', selectedMachine.id).eq('active', true).order('order_index')
      .then(({ data, error }) => {
        if (error) {
          console.log('[AdminChecklist] Erro ao carregar itens:', error.message);
          Alert.alert('Erro', 'Nao foi possivel carregar os itens do checklist.');
          setItemsLoading(false);
          return;
        }
        const items = (data as MachineChecklistItem[] | null) ?? [];
        setTemplateItems(items);
        const init: Record<string, ItemResponse> = {};
        items.forEach((item) => { init[item.id] = { status: null }; });
        setResponses(init);
        setItemsLoading(false);
      });
  }, [selectedMachine]);

  // --- Helpers ---
  function resetFlow() {
    setView('list');
    setSelectedMachine(null);
    setMachineSearch('');
    setShift('');
    setTemplateItems([]); setItemsLoading(false); setResponses({});
    setEquipmentPhotos([null, null, null, null]);
    setEnvironmentPhoto(null);
    setInspectorName(''); setScanned(false);
  }

  function setItemStatus(id: string, status: 'C' | 'NC' | 'NA') {
    setResponses((p) => ({ ...p, [id]: { ...p[id], status } }));
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
  function findMachineMatch(qrData: string): Machine | undefined {
    const raw = qrData.trim();
    const norm = raw.toLowerCase();

    const byQr = machines.find((m) => m.qr_code === raw);
    if (byQr) return byQr;
    const byQrLower = machines.find((m) => m.qr_code?.toLowerCase() === norm);
    if (byQrLower) return byQrLower;
    const byId = machines.find((m) => m.id === raw);
    if (byId) return byId;
    const byName = machines.find((m) => m.name.toLowerCase() === norm);
    if (byName) return byName;
    const byTag = machines.find((m) => m.tag && m.tag.toLowerCase() === norm);
    if (byTag) return byTag;
    return undefined;
  }

  async function handleBarcode({ data }: { data: string }) {
    if (scanned) return;
    setScanned(true);
    const match = findMachineMatch(data);
    if (match) {
      setSelectedMachine(match);
      setView('items');
    } else {
      Alert.alert('Maquina nao encontrada', `QR Code lido: "${data}"\n\nSelecione manualmente.`, [
        { text: 'OK', onPress: () => { setView('pick'); setScanned(false); } },
      ]);
    }
  }

  // --- Save checklist + create activity ---
  async function handleSave() {
    if (!user) return;
    if (!myOperatorId) {
      Alert.alert('Erro', 'Nenhum operador vinculado ao seu usuario. Cadastre um operador primeiro.');
      return;
    }
    if (!selectedMachine) return;
    if (!inspectorName.trim()) {
      Alert.alert('Atencao', 'Informe o nome do responsavel.');
      return;
    }
    if (!allRequiredPhotosTaken()) {
      Alert.alert('Atencao', 'Anexe as 4 fotos do equipamento e a foto do ambiente antes de salvar.');
      setView('photos');
      return;
    }
    setSaving(true);
    const result = calculateResult();

    const { data: checklist, error: clErr } = await supabase.from('checklists').insert({
      operator_id: myOperatorId,
      machine_id: selectedMachine.id,
      machine_name: selectedMachine.name,
      tag: selectedMachine.tag || null,
      shift: shift || null,
      max_load_capacity: selectedMachine.max_load_capacity || null,
      date: today,
      status: 'pending',
      result,
      inspector_name: inspectorName,
    }).select().single();

    if (clErr || !checklist) {
      Alert.alert('Erro', clErr?.message ?? 'Erro ao criar checklist.');
      setSaving(false);
      return;
    }

    // Upload das fotos obrigatorias
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

  async function onRefresh() {
    setRefreshing(true);
    await loadChecklists();
    await loadMachines();
    setRefreshing(false);
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
    const search = machineSearch.toLowerCase();
    const filtered = machines.filter((m) =>
      m.name.toLowerCase().includes(search)
      || (m.tag ?? '').toLowerCase().includes(search)
      || (m.qr_code ?? '').toLowerCase().includes(search)
    );

    function handlePickMachine(item: Machine) {
      setSelectedMachine(item);
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
          <Text style={st.pickSubtitle}>{machines.length} maquinas cadastradas</Text>
          <TextInput
            style={st.searchInput}
            placeholder="Buscar por nome, TAG ou QR..."
            placeholderTextColor={colors.textLight}
            value={machineSearch}
            onChangeText={setMachineSearch}
          />
        </View>
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
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
                {(item.tag || item.qr_code) && (
                  <Text style={st.machineMeta} numberOfLines={1}>
                    {item.tag ? `TAG: ${item.tag}` : ''}
                    {item.tag && item.qr_code ? '  ·  ' : ''}
                    {item.qr_code || ''}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 80, gap: spacing.sm }}
          ListEmptyComponent={
            <View style={st.centered}>
              <Ionicons name="search-outline" size={48} color={colors.textLight} />
              <Text style={st.emptyText}>
                {machines.length === 0
                  ? 'Nenhuma maquina cadastrada. Cadastre maquinas no painel web.'
                  : 'Nenhuma maquina encontrada com este filtro.'}
              </Text>
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
          <Text style={[st.emptyText, { marginTop: spacing.md }]}>Carregando perguntas...</Text>
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
          {selectedMachine?.tag && <Text style={st.headerInfo}>TAG: {selectedMachine.tag}</Text>}

          <View style={st.shiftRow}>
            {['Diurno', 'Noturno'].map((sv) => (
              <TouchableOpacity key={sv} style={[st.shiftBtn, shift === sv && st.shiftBtnActive]} onPress={() => setShift(sv)}>
                <Text style={[st.shiftBtnText, shift === sv && st.shiftBtnTextActive]}>{sv}</Text>
              </TouchableOpacity>
            ))}
          </View>

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
              <Text style={[st.emptyText, { fontSize: fontSize.sm }]}>Cadastre perguntas no painel web</Text>
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

  // PHOTOS
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
          style={st.photoSlotWide}
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
          style={[st.nextBtn, !allRequiredPhotosTaken() && st.btnDisabled]}
          onPress={() => {
            if (allRequiredPhotosTaken()) setView('result');
            else Alert.alert('Atencao', 'Anexe todas as 5 fotos antes de prosseguir.');
          }}
        >
          <Text style={st.nextBtnText}>Ver Resultado</Text>
          <Ionicons name="arrow-forward" size={20} color={colors.white} />
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // RESULT
  if (view === 'result') {
    const result = calculateResult();
    const isReleased = result === 'released';

    return (
      <KeyboardAvoidingView style={st.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={st.backRow} onPress={() => setView('photos')}>
            <Ionicons name="arrow-back" size={22} color={colors.primary} />
            <Text style={st.backText}>Voltar</Text>
          </TouchableOpacity>

          <View style={[st.resultCard, isReleased ? st.resultOk : st.resultFail]}>
            <Ionicons name={isReleased ? 'checkmark-circle' : 'close-circle'} size={48} color={isReleased ? colors.success : colors.danger} />
            <Text style={[st.resultTitle, { color: isReleased ? colors.success : colors.danger }]}>
              {isReleased ? 'EQUIPAMENTO LIBERADO' : 'NAO LIBERADO'}
            </Text>
          </View>

          {!isReleased && (
            <View style={st.ncBox}>
              <Text style={st.ncTitle}>Itens Nao Conformes:</Text>
              {templateItems.filter((i) => responses[i.id]?.status === 'NC').map((i) => (
                <Text key={i.id} style={st.ncItem}>{'•'} {i.description} {i.is_blocking ? '(IMPEDITIVO)' : ''}</Text>
              ))}
            </View>
          )}

          <View style={st.inputGroup}>
            <Text style={st.label}>Nome do Responsavel *</Text>
            <TextInput style={st.input} placeholder="Nome" placeholderTextColor={colors.textLight} value={inspectorName} onChangeText={setInspectorName} />
          </View>

          <TouchableOpacity
            style={[st.saveBtn, saving && st.btnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={st.saveBtnText}>{saving ? 'Salvando...' : 'Salvar e Iniciar Atividade'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // --- LIST VIEW ---
  if (loading) {
    return <View style={st.centered}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  const pendingChecklists = checklists.filter((c) => c.status === 'pending');
  const completedChecklists = checklists.filter((c) => c.status !== 'pending');

  return (
    <View style={commonStyles.container}>
      <ScrollView
        contentContainerStyle={commonStyles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Checklists em andamento */}
        {pendingChecklists.length > 0 && (
          <View style={st.sectionWrap}>
            <View style={st.sectionHeader}>
              <View style={st.sectionLeft}>
                <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                <Text style={st.sectionHeaderText}>EM ANDAMENTO</Text>
              </View>
              <Badge label={String(pendingChecklists.length)} variant="warning" size="sm" />
            </View>
            {pendingChecklists.map((item) => (
              <View key={item.id} style={[st.listCard, st.pendingCard]}>
                <View style={st.listCardHeader}>
                  <View style={st.headerLeft}>
                    <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                    <Text style={st.metaLabel}>
                      {new Date(item.date).toLocaleDateString('pt-BR')} · {item.operators?.name || 'Operador'}
                    </Text>
                  </View>
                  <Badge label="EM ANDAMENTO" variant="warning" size="sm" />
                </View>
                <Text style={st.listMachine}>{item.machine_name}</Text>
                {item.tag && <Text style={st.metaLabel}>TAG: {item.tag}</Text>}
                <TouchableOpacity style={st.finishBtn} onPress={() => setChecklistToFinish(item)}>
                  <Ionicons name="stop-circle-outline" size={18} color={colors.white} />
                  <Text style={st.finishBtnText}>Encerrar checklist</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Historico */}
        <View style={st.sectionWrap}>
          <View style={st.sectionHeader}>
            <View style={st.sectionLeft}>
              <Ionicons name="checkmark-done-outline" size={14} color={colors.textSecondary} />
              <Text style={st.sectionHeaderText}>HISTÓRICO</Text>
            </View>
            <Badge label={String(completedChecklists.length)} variant="success" size="sm" />
          </View>
          {completedChecklists.length === 0 && pendingChecklists.length === 0 && (
            <View style={commonStyles.empty}>
              <Ionicons name="clipboard-outline" size={40} color={colors.textLight} />
              <Text style={commonStyles.emptyText}>Nenhum checklist realizado</Text>
            </View>
          )}
          {completedChecklists.length === 0 && pendingChecklists.length > 0 && (
            <View style={st.emptyHistory}>
              <Ionicons name="document-text-outline" size={28} color={colors.textLight} />
              <Text style={st.emptyHistoryText}>Nenhum checklist concluído ainda</Text>
            </View>
          )}
          {completedChecklists.map((item) => {
            const isReleased = item.result === 'released';
            return (
              <View key={item.id} style={st.listCard}>
                <View style={st.listCardHeader}>
                  <View style={st.headerLeft}>
                    <Ionicons
                      name={isReleased ? 'checkmark-circle-outline' : 'close-circle-outline'}
                      size={14}
                      color={colors.textSecondary}
                    />
                    <Text style={st.metaLabel}>
                      {new Date(item.date).toLocaleDateString('pt-BR')} · {item.operators?.name || 'Operador'}
                    </Text>
                  </View>
                  <Badge
                    label={isReleased ? 'LIBERADO' : 'NÃO LIBERADO'}
                    variant={isReleased ? 'success' : 'danger'}
                    size="sm"
                  />
                </View>
                <Text style={st.listMachine}>{item.machine_name}</Text>
                {item.tag && <Text style={st.metaLabel}>TAG: {item.tag}</Text>}
              </View>
            );
          })}
        </View>
      </ScrollView>

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

  backRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.lg },
  backText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },

  // List view
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
  listMachine: { fontSize: 16, fontWeight: '700', color: colors.text, letterSpacing: -0.1 },
  metaLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  finishBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: spacing.md, paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm, backgroundColor: colors.primary, gap: spacing.xs,
    ...elevation.brand,
  },
  finishBtnText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.white, letterSpacing: 0.2 },

  // Scanner
  scanContainer: { flex: 1, backgroundColor: '#000' },
  scanOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', padding: spacing.lg },
  scanHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingTop: spacing.xl },
  scanTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.white },
  scanFrame: { width: 240, height: 240, borderWidth: 2, borderColor: colors.white, borderRadius: radius.lg, alignSelf: 'center', opacity: 0.7 },
  scanManual: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md, paddingBottom: spacing.xl },
  scanManualText: { color: colors.white, fontSize: fontSize.base, fontWeight: '600' },

  permText: { fontSize: fontSize.base, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md, marginBottom: spacing.lg },
  permBtn: { backgroundColor: colors.primary, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: radius.sm },
  permBtnText: { color: colors.white, fontWeight: '700', fontSize: fontSize.base },
  linkBtn: { marginTop: spacing.md },
  linkText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '600' },

  // Pick
  pickHeader: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  pickSubtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.md },
  searchInput: {
    backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, padding: spacing.md, fontSize: fontSize.base, color: colors.text, marginBottom: spacing.sm,
  },
  machineCard: {
    flexDirection: 'row', alignItems: 'center', padding: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, gap: spacing.md,
  },
  machineIconWrap: {
    width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.primary + '10',
    justifyContent: 'center', alignItems: 'center',
  },
  machineName: { fontSize: fontSize.base, fontWeight: '600', color: colors.text },
  machineMeta: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },

  stepTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  headerInfo: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.md },
  emptyText: { fontSize: fontSize.base, color: colors.textLight, textAlign: 'center', marginTop: spacing.xl },

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
  shiftRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
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
  photoFullBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  photoFullBtnText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.primary },
  thumb: { width: 60, height: 60, borderRadius: radius.sm, marginTop: spacing.sm },

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

  // Result
  resultCard: { alignItems: 'center', padding: spacing.lg, borderRadius: radius.lg, marginBottom: spacing.lg },
  resultOk: { backgroundColor: colors.success + '15', borderWidth: 1, borderColor: colors.success + '30' },
  resultFail: { backgroundColor: colors.dangerLight, borderWidth: 1, borderColor: colors.danger + '30' },
  resultTitle: { fontSize: fontSize.lg, fontWeight: '800', textAlign: 'center', marginTop: spacing.md },
  ncBox: {
    backgroundColor: colors.dangerLight, padding: spacing.md, borderRadius: radius.md,
    marginBottom: spacing.lg, borderLeftWidth: 3, borderLeftColor: colors.danger,
  },
  ncTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.danger, marginBottom: spacing.sm },
  ncItem: { fontSize: fontSize.sm, color: colors.text, marginBottom: 4 },
  saveBtn: {
    backgroundColor: colors.success, paddingVertical: spacing.md, borderRadius: radius.sm, alignItems: 'center', marginTop: spacing.sm,
  },
  saveBtnText: { fontSize: fontSize.base, fontWeight: '700', color: colors.white },

  // Sections
  sectionWrap: { marginBottom: spacing.lg },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing['2xs'],
  },
  emptyHistory: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyHistoryText: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: spacing.sm },

  // FABs
  fabRow: {
    position: 'absolute', bottom: spacing.lg, right: spacing.lg,
    flexDirection: 'row', gap: spacing.sm, alignItems: 'center',
  },
  fabSecondary: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.surface,
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
