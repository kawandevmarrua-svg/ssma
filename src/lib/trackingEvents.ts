import * as Location from 'expo-location';
import { supabase } from './supabase';

export type TrackingEventType =
  | 'pre_op_start'
  | 'checklist_start'
  | 'checklist_end'
  | 'activity_start'
  | 'activity_end'
  | 'parada';

/**
 * Records a GPS snapshot for a key operator event.
 * Fire-and-forget: non-blocking, silently swallows errors so it never disrupts
 * the main flow.
 */
export async function recordTrackingEvent(
  userId: string,
  eventType: TrackingEventType,
  ids: { activityId?: string | null; checklistId?: string | null } = {},
): Promise<void> {
  try {
    const loc = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
    ]).catch(() => null);

    if (!loc) return;

    await supabase.from('location_history').insert({
      operator_id: userId,
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy: loc.coords.accuracy ?? null,
      speed: loc.coords.speed ?? null,
      heading: loc.coords.heading ?? null,
      event_type: eventType,
      activity_id: ids.activityId ?? null,
      checklist_id: ids.checklistId ?? null,
      recorded_at: new Date(loc.timestamp || Date.now()).toISOString(),
    });
  } catch {
    // Non-blocking
  }
}
