import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';

export const LOCATION_TASK_NAME = 'marrua-background-location';
export const OPERATOR_ID_KEY = 'marrua.tracking.operator_id';
export const DERIVED_STATUS_KEY = 'marrua.tracking.derived_status';

export type DerivedStatusPayload = {
  status: 'online' | 'in_checklist' | 'in_activity' | 'idle' | 'offline';
  currentChecklistId: string | null;
  currentActivityId: string | null;
};

interface LocationTaskData {
  locations?: Location.LocationObject[];
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.log('[LocationTask] erro recebido:', error.message);
    return;
  }
  if (!data) return;

  const { locations } = data as LocationTaskData;
  const loc = locations?.[locations.length - 1];
  if (!loc) return;

  try {
    const operatorId = await SecureStore.getItemAsync(OPERATOR_ID_KEY);
    if (!operatorId) return;

    const derivedRaw = await SecureStore.getItemAsync(DERIVED_STATUS_KEY);
    const derived: DerivedStatusPayload = derivedRaw
      ? JSON.parse(derivedRaw)
      : { status: 'online', currentChecklistId: null, currentActivityId: null };

    const payload = {
      operator_id: operatorId,
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy: loc.coords.accuracy ?? null,
      speed: loc.coords.speed ?? null,
      heading: loc.coords.heading ?? null,
      current_status: derived.status,
      current_checklist_id: derived.currentChecklistId,
      current_activity_id: derived.currentActivityId,
      recorded_at: new Date(loc.timestamp || Date.now()).toISOString(),
    };

    const { error: upsertError } = await supabase
      .from('operator_locations')
      .upsert(payload, { onConflict: 'operator_id' });

    if (upsertError) {
      console.log('[LocationTask] upsert falhou:', upsertError.message);
    }
  } catch (e) {
    console.log('[LocationTask] excecao:', e);
  }
});
