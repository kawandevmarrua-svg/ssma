import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SIGNING_KEY_STORE = 'marrua.queue.signing.key';

let cachedKey: string | null = null;

async function getSigningKey(): Promise<string> {
  if (cachedKey) return cachedKey;

  if (Platform.OS === 'web') {
    // Web usa sessionStorage — nao ha SecureStore. Signing desativado.
    return '';
  }

  try {
    const existing = await SecureStore.getItemAsync(SIGNING_KEY_STORE);
    if (existing) {
      cachedKey = existing;
      return existing;
    }
    const bytes = Crypto.getRandomBytes(32);
    const key = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    await SecureStore.setItemAsync(SIGNING_KEY_STORE, key);
    cachedKey = key;
    return key;
  } catch {
    return '';
  }
}

export async function signPayload(json: string): Promise<string> {
  const key = await getSigningKey();
  if (!key) return '';
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    key + json,
  );
  return digest;
}

export async function verifyPayload(json: string, signature: string): Promise<boolean> {
  const key = await getSigningKey();
  if (!key) return true; // Sem chave (web) = skip verificacao
  if (!signature) return false; // Dado sem assinatura = tampered
  const expected = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    key + json,
  );
  return expected === signature;
}
