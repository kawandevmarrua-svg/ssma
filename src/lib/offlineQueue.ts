import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from './supabase';
import { uploadQueuedPhoto } from './imageUtils';

const QUEUE_PREFIX = 'marrua.offline.queue.v1';
const DEAD_LETTER_PREFIX = 'marrua.offline.deadletter.v1';
const ANON_USER_KEY = '__anon__';
const MAX_ATTEMPTS = 8;

export type JobKind =
  | 'updateChecklist'
  | 'updateActivity'
  | 'updateActivityWithPhoto'
  | 'insertActivity'
  | 'tableUpsert';

export interface JobBase<K extends JobKind, P> {
  kind: K;
  payload: P;
}

export interface QueuedPhoto {
  localPath: string;
  bucket: string;
  storagePath: string;
  field: string;
  uploadedPath?: string; // preenchido apos upload bem-sucedido (idempotencia)
}

export type Job =
  | JobBase<'updateChecklist', { id: string; patch: Record<string, unknown> }>
  | JobBase<'updateActivity', { id: string; patch: Record<string, unknown> }>
  | JobBase<'updateActivityWithPhoto', {
      id: string;
      patch: Record<string, unknown>;
      photo: QueuedPhoto | null;
    }>
  | JobBase<'insertActivity', Record<string, unknown>>
  | JobBase<'tableUpsert', { table: string; row: Record<string, unknown>; onConflict?: string }>;

export interface StoredJob {
  id: string;
  createdAt: number;
  attempts: number;
  lastError: string | null;
  job: Job;
}

export interface PendingFinishState {
  checklistIds: Set<string>;
  activityIds: Set<string>;
}

// ---------- estado global ligado ao usuario logado ----------

let currentUserId: string | null = null;
// Distingue "ainda nao bindou" de "bindou para null" (logout): o auto-flush
// inicial so deve disparar apos bind explicito, senao tenta drenar a fila
// generica __anon__ antes do AuthProvider resolver a sessao.
let bindCalled = false;
let inFlight = false;
const subscribers = new Set<(size: number) => void>();
const pendingFinishSubs = new Set<(state: PendingFinishState) => void>();
const deadLetterSubs = new Set<(count: number) => void>();

function queueKey(userId = currentUserId): string {
  return `${QUEUE_PREFIX}.${userId ?? ANON_USER_KEY}`;
}

function deadLetterKey(userId = currentUserId): string {
  return `${DEAD_LETTER_PREFIX}.${userId ?? ANON_USER_KEY}`;
}

/**
 * Liga a fila ao usuario atual. Cada usuario tem sua propria fila para
 * que jobs de A nunca sejam aplicados com a sessao de B (corromperia
 * dado entre usuarios no mesmo aparelho).
 *
 * Idempotente. Notifica subscribers para refletirem a fila do novo usuario
 * e dispara um flush imediato se o auto-flush ja estiver ativo.
 */
export function bindOfflineQueueToUser(userId: string | null): void {
  if (bindCalled && currentUserId === userId) return;
  bindCalled = true;
  currentUserId = userId;
  void notifyAll();
  if (started) void flush().catch(() => { /* ignore */ });
}

async function notifyAll(): Promise<void> {
  // Captura o user no momento da chamada para evitar que um bind concorrente
  // mande notificacoes com a fila do user errado para os subscribers.
  const userAtCall = currentUserId;
  const [q, dlCount] = await Promise.all([
    readQueueFor(userAtCall),
    readDeadLetterCountFor(userAtCall),
  ]);
  if (currentUserId !== userAtCall) return; // bind mudou: descarta
  subscribers.forEach((cb) => cb(q.length));
  if (pendingFinishSubs.size > 0) {
    const state = derivePendingFinishes(q);
    pendingFinishSubs.forEach((cb) => cb(state));
  }
  deadLetterSubs.forEach((cb) => cb(dlCount));
}

// ---------- helpers de derivacao / IO ----------

function derivePendingFinishes(jobs: StoredJob[]): PendingFinishState {
  const checklistIds = new Set<string>();
  const activityIds = new Set<string>();
  for (const stored of jobs) {
    const j = stored.job;
    if (j.kind === 'updateChecklist' && j.payload.patch.status === 'completed') {
      checklistIds.add(j.payload.id);
    } else if (j.kind === 'updateActivity' && j.payload.patch.end_time) {
      activityIds.add(j.payload.id);
    } else if (j.kind === 'updateActivityWithPhoto' && j.payload.patch.end_time) {
      activityIds.add(j.payload.id);
    }
  }
  return { checklistIds, activityIds };
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function readQueue(): Promise<StoredJob[]> {
  return readQueueFor(currentUserId);
}

async function readQueueFor(userId: string | null): Promise<StoredJob[]> {
  try {
    const raw = await AsyncStorage.getItem(queueKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(jobs: StoredJob[]): Promise<void> {
  await AsyncStorage.setItem(queueKey(), JSON.stringify(jobs));
  subscribers.forEach((cb) => cb(jobs.length));
  if (pendingFinishSubs.size > 0) {
    const state = derivePendingFinishes(jobs);
    pendingFinishSubs.forEach((cb) => cb(state));
  }
}

async function readDeadLetterCount(): Promise<number> {
  return readDeadLetterCountFor(currentUserId);
}

async function readDeadLetterCountFor(userId: string | null): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(deadLetterKey(userId));
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

async function pushToDeadLetter(stored: StoredJob, error: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(deadLetterKey());
    const dl: StoredJob[] = raw ? JSON.parse(raw) : [];
    dl.push({ ...stored, lastError: error });
    await AsyncStorage.setItem(deadLetterKey(), JSON.stringify(dl));
    const count = dl.length;
    deadLetterSubs.forEach((cb) => cb(count));
  } catch (e) {
    console.log('[OfflineQueue] falha ao gravar dead-letter:', e);
  }
}

export async function getDeadLetter(): Promise<StoredJob[]> {
  try {
    const raw = await AsyncStorage.getItem(deadLetterKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function clearDeadLetter(): Promise<void> {
  await AsyncStorage.removeItem(deadLetterKey());
  deadLetterSubs.forEach((cb) => cb(0));
}

// ---------- subscribers ----------

export function subscribeQueueSize(cb: (size: number) => void): () => void {
  subscribers.add(cb);
  void readQueue().then((q) => cb(q.length));
  return () => { subscribers.delete(cb); };
}

/**
 * Notifica sempre que muda o conjunto de checklists/atividades com
 * encerramento pendente na fila. Usado pelas telas de lista para
 * tratar esses itens como "ja finalizados" (optimistic UI), evitando
 * que o operador finalize 2x e duplique jobs.
 */
export function subscribePendingFinishes(cb: (state: PendingFinishState) => void): () => void {
  pendingFinishSubs.add(cb);
  void readQueue().then((q) => cb(derivePendingFinishes(q)));
  return () => { pendingFinishSubs.delete(cb); };
}

export function subscribeDeadLetterCount(cb: (count: number) => void): () => void {
  deadLetterSubs.add(cb);
  void readDeadLetterCount().then(cb);
  return () => { deadLetterSubs.delete(cb); };
}

export async function getQueueSize(): Promise<number> {
  const q = await readQueue();
  return q.length;
}

// ---------- execucao ----------

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
      case 'updateActivityWithPhoto': {
        const { photo } = job.payload;
        let photoUrl: string | null = null;
        if (photo) {
          if (photo.uploadedPath) {
            photoUrl = photo.uploadedPath;
          } else {
            const r = await uploadQueuedPhoto(photo.localPath, photo.bucket, photo.storagePath);
            if (!r.ok) return { ok: false, error: `upload foto: ${r.error}` };
            photoUrl = r.uploadedPath ?? null;
            // Memoiza no proprio job: se o update do DB falhar, o retry
            // pula o re-upload (mutacao eh visivel ao caller pois o objeto
            // job eh o mesmo armazenado na fila).
            if (photoUrl) photo.uploadedPath = photoUrl;
          }
        }
        const finalPatch: Record<string, unknown> = { ...job.payload.patch };
        if (photo && photoUrl) finalPatch[photo.field] = photoUrl;
        const { error } = await supabase
          .from('activities')
          .update(finalPatch as never)
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

    const queue = await readQueue();
    const next: StoredJob[] = [];
    let abortRest = false;

    for (const stored of queue) {
      if (abortRest) {
        // Rede caiu durante o flush: preserva os restantes sem penalizar
        // attempts (se penalizassemos, perderiamos jobs validos por rede ruim).
        next.push(stored);
        continue;
      }

      const r = await executeJob(stored.job);
      if (r.ok) {
        processed += 1;
        continue;
      }

      // Distingue erro de rede (preserva) de erro real (incrementa attempts).
      if (!(await isOnline())) {
        abortRest = true;
        next.push(stored);
        continue;
      }

      const attempts = stored.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        // Job que falhou MAX vezes vai para dead-letter: nao some
        // silenciosamente; UI alerta o operador para acionar suporte.
        await pushToDeadLetter(stored, r.error ?? 'erro desconhecido');
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

// ---------- auto flush ----------

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

  // Tentativa inicial: so se ja houve bind explicito (auto-flush pode ter
  // iniciado antes do AuthProvider resolver a sessao). Se ainda nao
  // bind-ou, o proprio bindOfflineQueueToUser dispara um flush ao ser chamado.
  if (bindCalled) void flush().catch(() => {});

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
