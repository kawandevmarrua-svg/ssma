import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from './supabase';

const QUEUE_KEY = 'marrua.offline.queue.v1';
const MAX_ATTEMPTS = 8;

export type JobKind =
  | 'updateChecklist'
  | 'updateActivity'
  | 'insertActivity'
  | 'tableUpsert';

export interface JobBase<K extends JobKind, P> {
  kind: K;
  payload: P;
}

export type Job =
  | JobBase<'updateChecklist', { id: string; patch: Record<string, unknown> }>
  | JobBase<'updateActivity', { id: string; patch: Record<string, unknown> }>
  | JobBase<'insertActivity', Record<string, unknown>>
  | JobBase<'tableUpsert', { table: string; row: Record<string, unknown>; onConflict?: string }>;

export interface StoredJob {
  id: string;
  createdAt: number;
  attempts: number;
  lastError: string | null;
  job: Job;
}

let inFlight = false;
const subscribers = new Set<(size: number) => void>();

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function readQueue(): Promise<StoredJob[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(jobs: StoredJob[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(jobs));
  subscribers.forEach((cb) => cb(jobs.length));
}

export function subscribeQueueSize(cb: (size: number) => void): () => void {
  subscribers.add(cb);
  void readQueue().then((q) => cb(q.length));
  return () => { subscribers.delete(cb); };
}

export async function getQueueSize(): Promise<number> {
  const q = await readQueue();
  return q.length;
}

async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return Boolean(state.isConnected && state.isInternetReachable !== false);
  } catch {
    return true; // se a checagem falhar, tenta executar mesmo assim
  }
}

async function executeJob(job: Job): Promise<{ ok: boolean; error?: string }> {
  try {
    switch (job.kind) {
      case 'updateChecklist': {
        const { error } = await supabase
          .from('checklists')
          .update(job.payload.patch as never)
          .eq('id', job.payload.id);
        return error ? { ok: false, error: error.message } : { ok: true };
      }
      case 'updateActivity': {
        const { error } = await supabase
          .from('activities')
          .update(job.payload.patch as never)
          .eq('id', job.payload.id);
        return error ? { ok: false, error: error.message } : { ok: true };
      }
      case 'insertActivity': {
        const { error } = await supabase.from('activities').insert(job.payload as never);
        return error ? { ok: false, error: error.message } : { ok: true };
      }
      case 'tableUpsert': {
        const opts = job.payload.onConflict ? { onConflict: job.payload.onConflict } : undefined;
        const { error } = await supabase
          .from(job.payload.table as never)
          .upsert(job.payload.row as never, opts);
        return error ? { ok: false, error: error.message } : { ok: true };
      }
    }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'erro desconhecido' };
  }
}

/**
 * Tenta executar imediatamente. Se nao houver rede ou a chamada falhar,
 * enfileira para retry posterior.
 */
export async function enqueueOrExecute(job: Job): Promise<{ executed: boolean; queued: boolean }> {
  if (await isOnline()) {
    const r = await executeJob(job);
    if (r.ok) return { executed: true, queued: false };
    console.log('[OfflineQueue] execucao online falhou, enfileirando:', r.error);
  }
  await enqueue(job);
  return { executed: false, queued: true };
}

export async function enqueue(job: Job): Promise<void> {
  const q = await readQueue();
  q.push({
    id: genId(),
    createdAt: Date.now(),
    attempts: 0,
    lastError: null,
    job,
  });
  await writeQueue(q);
}

export async function flush(): Promise<{ processed: number; remaining: number }> {
  if (inFlight) return { processed: 0, remaining: (await readQueue()).length };
  inFlight = true;
  let processed = 0;
  try {
    if (!(await isOnline())) {
      const q = await readQueue();
      return { processed: 0, remaining: q.length };
    }

    let queue = await readQueue();
    const next: StoredJob[] = [];

    for (const stored of queue) {
      const r = await executeJob(stored.job);
      if (r.ok) {
        processed += 1;
        continue;
      }
      const attempts = stored.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        // descarta para nao travar a fila eternamente; loga em console.
        console.log('[OfflineQueue] descartando job apos max tentativas:', stored.job.kind, r.error);
        continue;
      }
      next.push({ ...stored, attempts, lastError: r.error ?? null });
    }

    await writeQueue(next);
    return { processed, remaining: next.length };
  } finally {
    inFlight = false;
  }
}

let started = false;
let appStateSub: { remove: () => void } | null = null;
let networkPoll: ReturnType<typeof setInterval> | null = null;
let lastOnline = false;

/**
 * Registra listeners para drenar a fila quando:
 * - o app volta para foreground
 * - a conexao volta a ficar disponivel (poll a cada 15s)
 *
 * Idempotente: pode ser chamado mais de uma vez.
 */
export function startOfflineQueueAutoFlush(): () => void {
  if (started) return () => {};
  started = true;

  function handleAppState(state: AppStateStatus) {
    if (state === 'active') void flush().catch(() => {});
  }
  appStateSub = AppState.addEventListener('change', handleAppState);

  networkPoll = setInterval(async () => {
    const online = await isOnline();
    if (online && !lastOnline) {
      void flush().catch(() => {});
    }
    lastOnline = online;
  }, 15_000);

  // tentativa inicial
  void flush().catch(() => {});

  return () => {
    started = false;
    appStateSub?.remove();
    appStateSub = null;
    if (networkPoll) {
      clearInterval(networkPoll);
      networkPoll = null;
    }
  };
}
