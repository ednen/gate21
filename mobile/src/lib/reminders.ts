import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const REMINDER_ID = 'gate21-daily-lesson';

/** Schedules (or moves) the daily lesson reminder at the user's chosen hour. */
export async function scheduleDailyReminder(hour: number): Promise<boolean> {
  // Browsers have no scheduled local notifications; there the permission request never settles.
  if (Platform.OS === 'web') {
    return false;
  }
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) {
    return false;
  }
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => undefined);
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title: 'Bugünkü görevin hazır',
      body: '8 dakikalık dersini yap, serini koru.',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute: 0 },
  });
  return true;
}
