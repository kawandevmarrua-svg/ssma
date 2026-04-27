import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { Alert } from 'react-native';
import { supabase } from './supabase';

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'heic', 'webp'];
const COMPRESSED_QUALITY = 0.5;

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
      console.log(`[Upload] Erro ao enviar ${fullPath}:`, error.message);
      Alert.alert('Falha no upload da foto', error.message);
      return null;
    }
    return fullPath;
  } catch (e: any) {
    console.log('[Upload] Excecao:', e);
    Alert.alert('Falha no upload da foto', e?.message ?? 'Erro inesperado ao enviar a imagem.');
    return null;
  }
}
