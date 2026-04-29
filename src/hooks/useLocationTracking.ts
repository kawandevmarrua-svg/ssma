import { useEffect, useRef } from 'react';
import { Alert, AppState, AppStateStatus, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../lib/supabase';
import {
  LOCATION_TASK_NAME,
  OPERATOR_ID_KEY,
  DERIVED_STATUS_KEY,
  DerivedStatusPayload,
} from '../lib/locationTask';
import { markOperatorOffline } from '../lib/operatorPresence';

const HEARTBEAT_INTERVAL_MS = 30_000;
const STATUS_REFRESH_MS = 60_000;
const MIN_DISTANCE_METERS = 25;

interface Options {
  operatorId: string | null;
}

/**
 * Heartbeat de localizacao em foreground + background.
 *
 * - Em foreground o hook escreve direto em operator_locations.
 * - Em background quem escreve eh a task definida em locationTask.ts,
 *   que le operatorId/derivedStatus do SecureStore para nao depender
 *   do estado React.
 */
export function useLocationTracking({ operatorId }: Options) {
  const watcherRef = useRef<Location.LocationSubscription | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSentRef = useRef<{ lat: number; lng: number; sentAt: number } | null>(null);
  const lastFixRef = useRef<Location.LocationObject | null>(null);
  const derivedRef = useRef<DerivedStatusPayload>({
    status: 'online',
    currentChecklistId: null,
    currentActivityId: null,
  });
  const permissionAlertedRef = useRef(false);
  const backgroundStartedRef = useRef(false);

  useEffect(() => {
    if (!operatorId) return;
    const opIdAtMount = operatorId;
    let cancelled = false;

    async function persistContextForBackgroundTask() {
      try {
        await SecureStore.setItemAsync(OPERATOR_ID_KEY, opIdAtMount);
        await SecureStore.setItemAsync(
          DERIVED_STATUS_KEY,
          JSON.stringify(derivedRef.current),
        );
      } catch (e) {
        console.log('[Location] falha ao persistir contexto da task:', e);
      }
    }

    async function refreshDerivedStatus() {
      try {
        const [{ data: activity }, { data: checklist }] = await Promise.all([
          supabase
            .from('activities')
            .select('id')
            .eq('operator_id', opIdAtMount)
            .is('end_time', null)
            .order('start_time', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('checklists')
            .select('id')
            .eq('operator_id', opIdAtMount)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (activity) {
          derivedRef.current = {
            status: 'in_activity',
            currentActivityId: activity.id,
            currentChecklistId: checklist?.id ?? null,
          };
        } else if (checklist) {
          derivedRef.current = {
            status: 'in_checklist',
            currentActivityId: null,
            currentChecklistId: checklist.id,
          };
        } else {
          derivedRef.current = { status: 'online', currentActivityId: null, currentChecklistId: null };
        }

        await persistContextForBackgroundTask();
      } catch (e) {
        console.log('[Location] Falha ao derivar status:', e);
      }
    }

    async function pushLocation(loc: Location.LocationObject, forceStatus?: DerivedStatusPayload['status']) {
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      const now = Date.now();
      const last = lastSentRef.current;

      if (!forceStatus && last) {
        const elapsed = now - last.sentAt;
        const dist = haversineMeters(last.lat, last.lng, lat, lng);
        if (elapsed < 10_000 && dist < 5) return;
      }

      const { status, currentChecklistId, currentActivityId } = derivedRef.current;

      const payload = {
        operator_id: opIdAtMount,
        latitude: lat,
        longitude: lng,
        accuracy: loc.coords.accuracy ?? null,
        speed: loc.coords.speed ?? null,
        heading: loc.coords.heading ?? null,
        current_status: forceStatus ?? status,
        current_checklist_id: currentChecklistId,
        current_activity_id: currentActivityId,
        recorded_at: new Date(loc.timestamp || now).toISOString(),
      };

      const { error } = await supabase
        .from('operator_locations')
        .upsert(payload, { onConflict: 'operator_id' });

      if (error) {
        console.log('[Location] Erro upsert:', error.message);
        return;
      }
      lastSentRef.current = { lat, lng, sentAt: now };

      // Breadcrumb para historico de deslocamento (somente com atividade ativa)
      if (currentActivityId) {
        supabase.from('location_history').insert({
          operator_id: opIdAtMount,
          activity_id: currentActivityId,
          latitude: lat,
          longitude: lng,
          accuracy: loc.coords.accuracy ?? null,
          speed: loc.coords.speed ?? null,
          heading: loc.coords.heading ?? null,
          recorded_at: payload.recorded_at,
        }).then(({ error: histErr }) => {
          if (histErr) console.log('[Location] breadcrumb falhou:', histErr.message);
        });
      }
    }

    async function startBackgroundUpdates(promptIfNeeded = true): Promise<boolean> {
      try {
        if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)) {
          backgroundStartedRef.current = true;
          return true;
        }

        // Em foreground active recurrente, evita disparar prompt de novo:
        // apenas verifica o status atual. O prompt so vem na primeira vez.
        const { status: bgPerm } = promptIfNeeded
          ? await Location.requestBackgroundPermissionsAsync()
          : await Location.getBackgroundPermissionsAsync();

        if (bgPerm !== 'granted') {
          // Sem permissao "always" o app fica restrito ao foreground.
          // Nao alertamos novamente para nao incomodar a cada retomada.
          return false;
        }

        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: MIN_DISTANCE_METERS,
          timeInterval: HEARTBEAT_INTERVAL_MS,
          showsBackgroundLocationIndicator: true,
          pausesUpdatesAutomatically: false,
          activityType: Location.ActivityType.OtherNavigation,
          foregroundService: Platform.OS === 'android' ? {
            notificationTitle: 'Marrua em campo',
            notificationBody: 'Compartilhando localizacao com sua gestao durante o expediente.',
            notificationColor: '#F97316',
            killServiceOnDestroy: false,
          } : undefined,
        });
        backgroundStartedRef.current = true;
        return true;
      } catch (e) {
        console.log('[Location] falha ao iniciar background updates:', e);
        return false;
      }
    }

    async function stopBackgroundUpdates() {
      try {
        const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (running) {
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        }
      } catch { /* ignore */ }
      backgroundStartedRef.current = false;
    }

    function stopForegroundWatcher() {
      watcherRef.current?.remove();
      watcherRef.current = null;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
      }
    }

    /**
     * @param isInitial - true so na primeira execucao (mount). Em retomadas
     *   de foreground (active) passamos false: nao prompta permissoes nem
     *   refaz getCurrentPositionAsync (a task de background ja esta dando fixes).
     */
    async function start(isInitial: boolean) {
      try {
        const { status: perm } = isInitial
          ? await Location.requestForegroundPermissionsAsync()
          : await Location.getForegroundPermissionsAsync();

        if (perm !== 'granted') {
          if (!permissionAlertedRef.current) {
            permissionAlertedRef.current = true;
            Alert.alert(
              'Localizacao desativada',
              'Sem acesso a localizacao a gestao nao consegue acompanhar voce em campo. Habilite o GPS nas configuracoes do app.',
            );
          }
          return;
        }
        if (cancelled) return;

        stopForegroundWatcher();

        await refreshDerivedStatus();
        if (cancelled) return;

        // O status precisa ser refrescado periodicamente em foreground para
        // que a task de background tenha o contexto certo no SecureStore,
        // independente de quem esta escrevendo a localizacao.
        statusIntervalRef.current = setInterval(() => {
          void refreshDerivedStatus().catch(() => { /* swallow */ });
        }, STATUS_REFRESH_MS);

        // Tenta usar a task de background. Em foreground recurrente,
        // checa apenas o status atual (sem prompt) — assim detectamos quando
        // o usuario habilitou "Always" pelas configuracoes do iOS depois.
        const bgRunning = await startBackgroundUpdates(isInitial);
        if (cancelled) return;

        // Fix inicial so faz sentido se nao temos nenhum ainda OU se o
        // background nao esta rodando. Em retomadas com bg ativo, evita
        // ligar o GPS sem necessidade (custa bateria).
        const needsImmediateFix = !lastFixRef.current || !bgRunning;
        if (needsImmediateFix) {
          const initial = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (cancelled) return;
          lastFixRef.current = initial;
          await pushLocation(initial, derivedRef.current.status);
        }

        if (bgRunning) {
          // Background ativo: nao precisamos de watcher/interval em foreground.
          return;
        }

        // Fallback: sem permissao de background → mantem watcher de foreground.
        watcherRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: MIN_DISTANCE_METERS,
            timeInterval: HEARTBEAT_INTERVAL_MS,
          },
          (loc) => {
            lastFixRef.current = loc;
            void pushLocation(loc).catch(() => { /* swallow */ });
          },
        );

        intervalRef.current = setInterval(() => {
          const fix = lastFixRef.current;
          if (!fix) return;
          void pushLocation(fix).catch(() => { /* swallow */ });
        }, HEARTBEAT_INTERVAL_MS);
      } catch (e) {
        console.log('[Location] Erro ao iniciar tracking:', e);
      }
    }

    function handleAppStateChange(state: AppStateStatus) {
      if (state === 'active') {
        // Foreground recurrente: re-checa permissao (sem prompt) para detectar
        // upgrade "While Using → Always" feito nas configuracoes do iOS.
        void start(false);
      } else if (state === 'background') {
        // Apenas para o watcher em foreground; a task de background segue ativa.
        stopForegroundWatcher();
      }
    }

    const sub = AppState.addEventListener('change', handleAppStateChange);
    void start(true);

    return () => {
      cancelled = true;
      sub.remove();
      stopForegroundWatcher();
      // Ordem importa: para a task ANTES de marcar offline, senao a task
      // pode disparar uma ultima escrita depois e voltar o status para online.
      // Limpa contexto persistido (tambem antes do markOffline) para que a
      // task, se acordar nesse intervalo, retorne sem escrever.
      void (async () => {
        await Promise.all([
          SecureStore.deleteItemAsync(OPERATOR_ID_KEY).catch(() => undefined),
          SecureStore.deleteItemAsync(DERIVED_STATUS_KEY).catch(() => undefined),
        ]);
        await stopBackgroundUpdates();
        await markOperatorOffline(opIdAtMount);
      })();
    };
  }, [operatorId]);
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
