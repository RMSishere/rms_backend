// src/util/notification.util.ts
import admin from '../firebase/firebase-admin';
import moment from 'moment-timezone';

export const OS = {
  ANDROID: 'android',
  IOS: 'ios',
} as const;

export interface Message {
  title: string;
  body?: string;
}

export interface Device {
  token: string;
  os: string; // 'android' | 'ios'
}

export interface PushOptions {
  data?: Record<string, string>; // ✅ deep links / type / ids
  collapseKey?: string;          // ✅ best-effort dedupe
  ttlSeconds?: number;           // ✅ time-to-live
  androidChannelId?: string;     // optional
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface NotificationOptions extends PushOptions {
  quietHours?: boolean; // suppress during quiet hours
  quietStart?: number;  // default 21 (9pm)
  quietEnd?: number;    // default 8 (8am)
  timezone?: string;    // default America/New_York
  dedupeKey?: string;   // reserved
  skipIf?: boolean;     // suppression flag
}

function uniq(arr: string[]) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

// Firebase wants data values as strings. Keep it safe.
function safeData(data?: Record<string, string>): Record<string, string> {
  return data ? data : {};
}

// Quiet hours can cross midnight (e.g., 21 -> 8)
function isQuietHour(nowHour: number, quietStart: number, quietEnd: number) {
  if (quietStart === quietEnd) return true;
  if (quietStart < quietEnd) return nowHour >= quietStart && nowHour < quietEnd;
  return nowHour >= quietStart || nowHour < quietEnd;
}

/**
 * Send push to MANY device tokens (multicast)
 */
export async function sendPushToTokens(
  tokens: string[],
  message: Message,
  opts: PushOptions = {},
): Promise<{ success: boolean; sent: number; failed: number; response?: any; error?: any }> {
  const cleanTokens = uniq(tokens);
  if (!cleanTokens.length) return { success: false, sent: 0, failed: 0, error: 'No tokens provided' };

  try {
    const ttl = opts.ttlSeconds ?? 60 * 60 * 24; // default 24h

    const response = await admin.messaging().sendEachForMulticast({
      tokens: cleanTokens,
      notification: {
        title: message.title,
        body: message.body || '',
      },
      data: safeData(opts.data),
      android: {
        priority: 'high',
        ttl: ttl * 1000,
        collapseKey: opts.collapseKey,
        notification: opts.androidChannelId ? { channelId: opts.androidChannelId } : undefined,
      },
      apns: {
        headers: {
          'apns-priority': '10',
          'apns-expiration': String(Math.floor(Date.now() / 1000) + ttl),
          ...(opts.collapseKey ? { 'apns-collapse-id': opts.collapseKey } : {}),
        },
        payload: {
          aps: { sound: 'default' },
        },
      },
    });

    return {
      success: response.failureCount === 0,
      sent: response.successCount,
      failed: response.failureCount,
      response,
    };
  } catch (error: any) {
    console.error('❌ Multicast push error:', error?.message || error);
    return { success: false, sent: 0, failed: cleanTokens.length, error };
  }
}

/**
 * Send push to ONE token
 */
export async function sendPushByToken(
  token: string,
  message: Message,
  opts: PushOptions = {},
): Promise<{ success: boolean; response?: any; error?: any }> {
  if (!token) return { success: false, error: 'FCM token is required' };

  try {
    const ttl = opts.ttlSeconds ?? 60 * 60 * 24;

    const response = await admin.messaging().send({
      token,
      notification: {
        title: message.title,
        body: message.body || '',
      },
      data: safeData(opts.data),
      android: {
        priority: 'high',
        ttl: ttl * 1000,
        collapseKey: opts.collapseKey,
        notification: opts.androidChannelId ? { channelId: opts.androidChannelId } : undefined,
      },
      apns: {
        headers: {
          'apns-priority': '10',
          'apns-expiration': String(Math.floor(Date.now() / 1000) + ttl),
          ...(opts.collapseKey ? { 'apns-collapse-id': opts.collapseKey } : {}),
        },
        payload: {
          aps: { sound: 'default' },
        },
      },
    });

    console.log('✅ Push sent:', response);
    return { success: true, response };
  } catch (error: any) {
    console.error('❌ Push error:', error?.message || error);
    return { success: false, error };
  }
}

/**
 * Convenience: send to a user (many devices)
 */
export async function sendPushToUser(
  user: { devices?: Device[] },
  message: Message,
  opts: PushOptions = {},
) {
  const tokens = (user?.devices || []).map((d) => d.token).filter(Boolean);
  return sendPushToTokens(tokens, message, opts);
}

/**
 * ✅ Your existing API used across codebase:
 * Send a FCM push notification to all devices of a user
 * Includes quiet-hours suppression + multicast delivery
 */
export async function sendPushNotificationToUser(
  user: any,
  payload: PushPayload,
  options: NotificationOptions = {},
): Promise<{ success: boolean; sent: number; failed: number }> {
  try {
    const devices = Array.isArray(user?.devices) ? user.devices : [];
    const tokens = uniq(devices.map((d: any) => d?.token).filter(Boolean));

    if (!tokens.length) return { success: false, sent: 0, failed: 0 };

    // Generic skip condition
    if (options.skipIf) return { success: false, sent: 0, failed: 0 };

    const timezone = options.timezone || 'America/New_York';
    const quietStart = options.quietStart ?? 21;
    const quietEnd = options.quietEnd ?? 8;

    if (options.quietHours) {
      const nowHour = moment().tz(timezone).hour();
      if (isQuietHour(nowHour, quietStart, quietEnd)) {
        console.log(`⏸ Notification suppressed (quiet hours): Hour=${nowHour} TZ=${timezone}`);
        return { success: false, sent: 0, failed: 0 };
      }
    }

    const ttl = options.ttlSeconds ?? 60 * 60 * 24;
    const data = safeData(options.data ?? payload.data);

    const res = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data,
      android: {
        priority: 'high',
        ttl: ttl * 1000,
        collapseKey: options.collapseKey,
        notification: options.androidChannelId ? { channelId: options.androidChannelId } : undefined,
      },
      apns: {
        headers: {
          'apns-priority': '10',
          'apns-expiration': String(Math.floor(Date.now() / 1000) + ttl),
          ...(options.collapseKey ? { 'apns-collapse-id': options.collapseKey } : {}),
        },
        payload: {
          aps: { sound: 'default' },
        },
      },
    });

    // Optional logging of per-token failures
    res.responses.forEach((r, idx) => {
      if (!r.success) {
        const code = (r.error as any)?.code;
        console.error('❌ FCM token failed:', tokens[idx], code, (r.error as any)?.message);
      }
    });

    return {
      success: res.failureCount === 0,
      sent: res.successCount,
      failed: res.failureCount,
    };
  } catch (err: any) {
    console.error('❌ Push Notification Error:', err?.message || err);
    return { success: false, sent: 0, failed: 1 };
  }
}
