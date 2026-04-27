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
    console.log('[Push] Skipping: not a physical device (emulator/simulator).');
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
    console.warn('[Push] Permission denied by user.');
    return;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    console.error(
      '[Push] Missing EAS projectId. Run `eas init` and add it to app.json (expo.extra.eas.projectId).',
    );
    return;
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = tokenResponse.data;
  console.log('[Push] Got Expo push token:', token.slice(0, 40) + '...');

  const { data: current } = await supabase
    .from('profiles')
    .select('push_token')
    .eq('id', userId)
    .single();

  if (current?.push_token === token) {
    console.log('[Push] Token unchanged, skipping update.');
    return;
  }

  const { error } = await supabase
    .from('profiles')
    .update({ push_token: token })
    .eq('id', userId);

  if (error) {
    console.error('[Push] Failed to save token:', error.message);
  } else {
    console.log('[Push] Token saved to profile', userId);
  }
}
