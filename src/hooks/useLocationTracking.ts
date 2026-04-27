import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';

const HEARTBEAT_INTERVAL_MS = 30_000;
const MIN_DISTANCE_METERS = 25;

type Status = 'online' | 'in_checklist' | 'in_activity' | 'idle' | 'offline';

interface Options {
  operatorId: string | null;
  status?: Status;
  currentChecklistId?: string | null;
  currentActivityId?: string | null;
}

/**
 * Heartbeat de localizacao do operador → tabela operator_locations.
 * Pede permissao "When in use", atualiza a cada 30s ou a cada 25m de
 * deslocamento, e marca status='offline' ao sair do app.
 */
export function useLocationTracking({ operatorId, status, currentChecklistId, currentActivityId }: Options) {
  const watcherRef = useRef<Location.LocationSubscription | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSentRef = useRef<{ lat: number; lng: number; sentAt: number } | null>(null);
  const lastFixRef = useRef<Location.LocationObject | null>(null);
  const optsRef = useRef<Options>({ operatorId, status, currentChecklistId, currentActivityId });

  useEffect(() => {
    optsRef.current = { operatorId, status, currentChecklistId, currentActivityId };
  }, [operatorId, status, currentChecklistId, currentActivityId]);

  useEffect(() => {
    if (!operatorId) return;
    let cancelled = false;

    async function pushLocation(loc: Location.LocationObject, forceStatus?: Status) {
      const opts = optsRef.current;
      if (!opts.operatorId) return;

      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      const now = Date.now();
      const last = lastSentRef.current;

      if (last) {
        const elapsed = now - last.sentAt;
        const dist = haversineMeters(last.lat, last.lng, lat, lng);
        if (elapsed < 10_000 && dist < 5) return;
      }

      const payload = {
        operator_id: opts.operatorId,
        latitude: lat,
        longitude: lng,
        accuracy: loc.coords.accuracy ?? null,
        speed: loc.coords.speed ?? null,
        heading: loc.coords.heading ?? null,
        current_status: forceStatus ?? opts.status ?? 'online',
        current_checklist_id: opts.currentChecklistId ?? null,
        current_activity_id: opts.currentActivityId ?? null,
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
      const opts = optsRef.current;
      if (!opts.operatorId) return;
      try {
        await supabase
          .from('operator_locations')
          .update({ current_status: 'offline' })
          .eq('operator_id', opts.operatorId);
      } catch { /* ignore */ }
    }

    async function start() {
      try {
        const { status: perm } = await Location.requestForegroundPermissionsAsync();
        if (perm !== 'granted') {
          console.log('[Location] Permissao de localizacao negada');
          return;
        }
        if (cancelled) return;

        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        lastFixRef.current = initial;
        await pushLocation(initial, 'online');

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
        const fix = lastFixRef.current;
        if (fix) void pushLocation(fix, 'online').catch(() => { /* swallow */ });
      } else if (state === 'background' || state === 'inactive') {
        void markOffline();
      }
    }

    const sub = AppState.addEventListener('change', handleAppStateChange);
    void start();

    return () => {
      cancelled = true;
      sub.remove();
      watcherRef.current?.remove();
      watcherRef.current = null;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      void markOffline();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
