import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const isExpoGo = Constants.appOwnership === 'expo';
let Notifications: typeof import('expo-notifications') | null = null;
if (!isExpoGo) {
  Notifications = require('expo-notifications');
}

export type Recurrence = 'daily' | 'weekly' | 'once';

export const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function parseTime(str: string): { hour: number; minute: number } | null {
  const m = str.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { hour: h, minute: min };
}

export async function setupReminderChannel() {
  if (!Notifications || !Device.isDevice) return;
  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== 'granted') {
    const { status: asked } = await Notifications.requestPermissionsAsync();
    status = asked;
  }
  if (status !== 'granted') return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Lembretes',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
}

export interface ReminderInput {
  title: string;
  description: string | null;
  reminder_time: string;
  recurrence: Recurrence;
  days_of_week: number[] | null;
  specific_date: string | null;
}

export async function scheduleNotifications(reminder: ReminderInput): Promise<string[]> {
  if (!Notifications || !Device.isDevice) return [];
  const parsed = parseTime(reminder.reminder_time);
  if (!parsed) return [];
  const { hour, minute } = parsed;
  const ids: string[] = [];

  try {
    if (reminder.recurrence === 'daily') {
      const id = await Notifications.scheduleNotificationAsync({
        content: { title: `⏰ ${reminder.title}`, body: reminder.description ?? 'Hora do seu lembrete!', sound: true },
        trigger: Platform.OS === 'android'
          ? { channelId: 'reminders', hour, minute, repeats: true } as any
          : { hour, minute, repeats: true } as any,
      });
      ids.push(id);
    } else if (reminder.recurrence === 'weekly' && reminder.days_of_week) {
      for (const day of reminder.days_of_week) {
        const id = await Notifications.scheduleNotificationAsync({
          content: { title: `⏰ ${reminder.title}`, body: reminder.description ?? 'Hora do seu lembrete!', sound: true },
          trigger: Platform.OS === 'android'
            ? { channelId: 'reminders', weekday: day + 1, hour, minute, repeats: true } as any
            : { weekday: day + 1, hour, minute, repeats: true } as any,
        });
        ids.push(id);
      }
    } else if (reminder.recurrence === 'once' && reminder.specific_date) {
      const [y, mo, d] = reminder.specific_date.split('-').map(Number);
      const date = new Date(y, mo - 1, d, hour, minute, 0);
      if (date > new Date()) {
        const id = await Notifications.scheduleNotificationAsync({
          content: { title: `⏰ ${reminder.title}`, body: reminder.description ?? 'Hora do seu lembrete!', sound: true },
          trigger: { date } as any,
        });
        ids.push(id);
      }
    }
  } catch (e) {
    console.log('[Lembretes] falha ao agendar notificacao:', e);
  }

  return ids;
}

export async function cancelNotifications(ids: string[] | null) {
  if (!Notifications || !ids) return;
  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch { /* ignore */ }
  }
}
