import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SIGNING_KEY_STORE = 'marrua.queue.signing.key';
const WEB_KEY_STORAGE = 'marrua.queue.signing.key.v1';

let cachedKey: string | null = null;
let cachedWebKey: CryptoKey | null = null;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return globalThis.btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = globalThis.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(bytes.length);
  new Uint8Array(buf).set(bytes);
  return buf;
}

async function getWebSigningKey(): Promise<CryptoKey | null> {
  if (cachedWebKey) return cachedWebKey;
  const subtle = globalThis.crypto?.subtle;
  if (!subtle || typeof globalThis.localStorage === 'undefined') return null;

  let raw = globalThis.localStorage.getItem(WEB_KEY_STORAGE);
  if (!raw) {
    const fresh = new Uint8Array(32);
    globalThis.crypto.getRandomValues(fresh);
    raw = bytesToBase64(fresh);
    globalThis.localStorage.setItem(WEB_KEY_STORAGE, raw);
  }

  const keyBytes = base64ToBytes(raw);
  cachedWebKey = await subtle.importKey(
    'raw',
    toArrayBuffer(keyBytes),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
  return cachedWebKey;
}

async function getNativeSigningKey(): Promise<string> {
  if (cachedKey) return cachedKey;
  try {
    const existing = await SecureStore.getItemAsync(SIGNING_KEY_STORE);
    if (existing) {
      cachedKey = existing;
      return existing;
    }
    const bytes = Crypto.getRandomBytes(32);
    const key = bytesToHex(bytes);
    await SecureStore.setItemAsync(SIGNING_KEY_STORE, key);
    cachedKey = key;
    return key;
  } catch {
    return '';
  }
}

export async function signPayload(json: string): Promise<string> {
  if (Platform.OS === 'web') {
    const key = await getWebSigningKey();
    if (!key) return '';
    const sig = await globalThis.crypto.subtle.sign(
      'HMAC',
      key,
      toArrayBuffer(new TextEncoder().encode(json)),
    );
    return bytesToBase64(new Uint8Array(sig));
  }

  const key = await getNativeSigningKey();
  if (!key) return '';
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    key + json,
  );
}

export async function verifyPayload(json: string, signature: string): Promise<boolean> {
  if (!signature) return false;

  if (Platform.OS === 'web') {
    const key = await getWebSigningKey();
    if (!key) return false;
    try {
      const sigBytes = base64ToBytes(signature);
      return await globalThis.crypto.subtle.verify(
        'HMAC',
        key,
        toArrayBuffer(sigBytes),
        toArrayBuffer(new TextEncoder().encode(json)),
      );
    } catch {
      return false;
    }
  }

  const key = await getNativeSigningKey();
  if (!key) return false;
  const expected = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    key + json,
  );
  return expected === signature;
}
