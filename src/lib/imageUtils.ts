import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { Alert } from 'react-native';
import { supabase } from './supabase';

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'heic', 'webp'];
const COMPRESSED_QUALITY = 0.5;
const QUEUED_PHOTOS_DIR = `${FileSystem.documentDirectory}queued-photos/`;

export async function pickPhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Permissao necessaria', 'Permita o acesso a camera.');
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: COMPRESSED_QUALITY,
    allowsEditing: true,
  });

  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}

export async function uploadPhoto(
  uri: string,
  bucket: string,
  path: string,
): Promise<string | null> {
  try {
    const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      Alert.alert('Erro', 'Tipo de imagem nao suportado.');
      return null;
    }

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const fullPath = `${path}.${ext}`;

    const { error } = await supabase.storage
      .from(bucket)
      .upload(fullPath, decode(base64), {
        contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        upsert: true,
      });

    if (error) {
      console.error('[uploadPhoto] storage error', error);
      Alert.alert('Falha no upload da foto', 'Nao foi possivel enviar a imagem. Tente novamente.');
      return null;
    }
    return fullPath;
  } catch (e: any) {
    console.error('[uploadPhoto] unexpected', e);
    Alert.alert('Falha no upload da foto', 'Erro inesperado ao enviar a imagem.');
    return null;
  }
}

/**
 * Copia a foto recem-tirada (cache da camera) para um diretorio persistente
 * dentro do app. Necessario quando o upload sera enfileirado para depois:
 * o cache da camera pode ser limpo pelo OS antes do flush rodar.
 *
 * Retorna o caminho local persistente, ou null em caso de falha.
 */
export async function persistPhotoForQueue(
  uri: string,
  suffix: string,
): Promise<string | null> {
  try {
    const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
    if (!ALLOWED_EXTENSIONS.includes(ext)) return null;

    await FileSystem.makeDirectoryAsync(QUEUED_PHOTOS_DIR, { intermediates: true });
    const target = `${QUEUED_PHOTOS_DIR}${suffix}-${Date.now()}.${ext}`;
    await FileSystem.copyAsync({ from: uri, to: target });
    return target;
  } catch (e) {
    console.error('[persistPhotoForQueue] falhou', e);
    return null;
  }
}

/**
 * Faz upload de uma foto previamente persistida (queued-photos/...).
 * Em caso de sucesso, remove o arquivo local. Em caso de falha,
 * preserva o arquivo para retry posterior.
 *
 * Diferente de uploadPhoto, NAO mostra Alert — eh chamado em background
 * pela fila offline e nao deve interferir na UI.
 */
export async function uploadQueuedPhoto(
  localPath: string,
  bucket: string,
  storagePath: string,
): Promise<{ ok: boolean; uploadedPath?: string; error?: string }> {
  try {
    const ext = localPath.split('.').pop()?.toLowerCase() ?? 'jpg';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return { ok: false, error: 'extensao nao suportada' };
    }
    const exists = await FileSystem.getInfoAsync(localPath);
    if (!exists.exists) {
      // Arquivo sumiu (cache do OS limpou). Sem o que fazer.
      return { ok: false, error: 'arquivo local nao encontrado' };
    }

    const base64 = await FileSystem.readAsStringAsync(localPath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const fullPath = `${storagePath}.${ext}`;

    const { error } = await supabase.storage
      .from(bucket)
      .upload(fullPath, decode(base64), {
        contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        upsert: true, // idempotente: retry sobrescreve mesmo path
      });

    if (error) return { ok: false, error: error.message };

    // Sucesso: remove a copia local.
    await FileSystem.deleteAsync(localPath, { idempotent: true });
    return { ok: true, uploadedPath: fullPath };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'erro desconhecido' };
  }
}
