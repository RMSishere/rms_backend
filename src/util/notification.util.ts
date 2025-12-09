// src/util/notification.util.ts
import admin from '../../firebase-admin'; // firebase-admin.ts file
import * as moment from 'moment-timezone'; // FIXED import ✔

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface NotificationOptions {
  quietHours?: boolean;      // suppress during quiet hours
  quietStart?: number;       // default quiet start 21 (9pm)
  quietEnd?: number;         // default quiet end 8 (8am)
  timezone?: string;         // default timezone
  dedupeKey?: string;        // for redis-based dedupe (future use)
  skipIf?: boolean;          // suppression flag
}

/**
 * Send a FCM push notification to all devices of a user
 */
export async function sendPushNotificationToUser(
  user: any,
  payload: PushPayload,
  options: NotificationOptions = {}
): Promise<{ success: boolean; sent: number; failed: number }> {
  try {
    if (!user?.devices || user.devices.length === 0) {
      return { success: false, sent: 0, failed: 0 };
    }

    // Generic skip condition (e.g., proposal arrived, job updated, etc.)
    if (options.skipIf) {
      return { success: false, sent: 0, failed: 0 };
    }

    const timezone = options.timezone || 'America/New_York';
    const quietStart = options.quietStart ?? 21; // 9pm
    const quietEnd = options.quietEnd ?? 8;      // 8am

    // Quiet hour suppression logic
    if (options.quietHours) {
      const nowHour = moment().tz(timezone).hour();
      const isQuiet = nowHour >= quietStart || nowHour < quietEnd;

      if (isQuiet) {
        console.log(`⏸ Notification suppressed due to quiet hours: Hour=${nowHour}`);
        return { success: false, sent: 0, failed: 0 };
      }
    }

    // Payload for Firebase
    const fcmPayload = {
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
    };

    let sent = 0;
    let failed = 0;

    // Send to all device tokens
    for (const device of user.devices) {
      if (!device?.token) continue;

      try {
        await admin.messaging().send({
          token: device.token,
          ...fcmPayload,
        });
        sent++;
      } catch (err: any) {
        failed++;
        console.error('❌ FCM error:', err?.message || err);
      }
    }

    return {
      success: failed === 0,
      sent,
      failed,
    };

  } catch (err) {
    console.error('❌ Push Notification Error:', err);
    return { success: false, sent: 0, failed: 1 };
  }
}
