import { supabase } from './supabase';

/**
 * Marca o operador como offline em operator_locations.
 *
 * IMPORTANTE: chame ANTES de supabase.auth.signOut(), porque depois
 * do signOut a sessao some e o RLS bloqueia o update — operador
 * fica eternamente como "online" no dashboard.
 */
export async function markOperatorOffline(operatorId: string): Promise<void> {
  try {
    await supabase
      .from('operator_locations')
      .update({ current_status: 'offline' })
      .eq('operator_id', operatorId);
  } catch (e) {
    console.log('[Presence] falha ao marcar offline:', e);
  }
}
