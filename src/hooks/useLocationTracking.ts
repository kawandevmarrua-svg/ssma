import { useEffect, useRef } from 'react';
import { Alert, AppState, AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';

const HEARTBEAT_INTERVAL_MS = 30_000;
const STATUS_REFRESH_MS = 60_000;
const MIN_DISTANCE_METERS = 25;

type Status = 'online' | 'in_checklist' | 'in_activity' | 'idle' | 'offline';

interface Options {
  operatorId: string | null;
}

interface DerivedStatus {
  status: Status;
  currentChecklistId: string | null;
  currentActivityId: string | null;
}

/**
 * Heartbeat de localizacao do operador → tabela operator_locations.
 * O status (online | in_checklist | in_activity) e os IDs sao derivados
 * automaticamente lendo checklists pendentes e atividades em aberto do
 * proprio operador, recalculados a cada 60s.
 */
export function useLocationTracking({ operatorId }: Options) {
  const watcherRef = useRef<Location.LocationSubscription | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSentRef = useRef<{ lat: number; lng: number; sentAt: number } | null>(null);
  const lastFixRef = useRef<Location.LocationObject | null>(null);
  const derivedRef = useRef<DerivedStatus>({ status: 'online', currentChecklistId: null, currentActivityId: null });
  const permissionAlertedRef = useRef(false);

  useEffect(() => {
    if (!operatorId) return;
    const opIdAtMount = operatorId;
    let cancelled = false;

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
      } catch (e) {
        console.log('[Location] Falha ao derivar status:', e);
      }
    }

    async function pushLocation(loc: Location.LocationObject, forceStatus?: Status) {
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
    }

    async function markOffline() {
      try {
        await supabase
          .from('operator_locations')
          .update({ current_status: 'offline' })
          .eq('operator_id', opIdAtMount);
      } catch { /* ignore */ }
    }

    function stopWatcher() {
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

    async function start() {
      try {
        const { status: perm } = await Location.requestForegroundPermissionsAsync();
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

        // Garante que nao havera watcher/intervals duplicados ao reiniciar.
        stopWatcher();

        await refreshDerivedStatus();
        if (cancelled) return;

        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        lastFixRef.current = initial;
        await pushLocation(initial, derivedRef.current.status);

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

        statusIntervalRef.current = setInterval(() => {
          void refreshDerivedStatus().catch(() => { /* swallow */ });
        }, STATUS_REFRESH_MS);
      } catch (e) {
        console.log('[Location] Erro ao iniciar tracking:', e);
      }
    }

    function handleAppStateChange(state: AppStateStatus) {
      if (state === 'active') {
        // O watcher do Expo morre quando o app e suspenso pelo iOS/Android.
        // Reiniciar do zero garante heartbeat continuo apos desbloquear a tela.
        void start();
      } else if (state === 'background') {
        // 'inactive' nao conta — em iOS toda interrupcao breve dispara isso
        stopWatcher();
        void markOffline();
      }
    }

    const sub = AppState.addEventListener('change', handleAppStateChange);
    void start();

    return () => {
      cancelled = true;
      sub.remove();
      stopWatcher();
      void markOffline();
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
