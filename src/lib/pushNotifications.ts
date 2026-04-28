import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerPushTokenForUser(userId: string) {
  if (!Device.isDevice) {
    console.log('[Push] skip: nao eh dispositivo fisico (emulador/simulador)');
    return;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F97316',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.log('[Push] skip: permissao de notificacao negada pelo usuario');
    return;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    console.warn(
      '[Push] skip: projectId do EAS ausente. Rode "npx eas init" e rebuild do app.',
    );
    return;
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = tokenResponse.data;

  const { data: current } = await supabase
    .from('user_push_tokens')
    .select('push_token')
    .eq('user_id', userId)
    .maybeSingle();

  if (current?.push_token === token) {
    console.log('[Push] token ja registrado, nao precisa atualizar');
    return;
  }

  const { error } = await supabase
    .from('user_push_tokens')
    .upsert({ user_id: userId, push_token: token, updated_at: new Date().toISOString() });

  if (error) {
    console.error('[Push] falha ao gravar token em user_push_tokens:', error.message);
  } else {
    console.log('[Push] token registrado com sucesso para user', userId);
  }
}
