import admin from '../firebase/firebase-admin';

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
  data?: Record<string, string>;        // ✅ for deep links / type / ids
  collapseKey?: string;                 // ✅ dedupe on device (best-effort)
  ttlSeconds?: number;                  // ✅ time-to-live
  androidChannelId?: string;            // optional
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr.filter(Boolean)));
}

/**
 * Send push to MANY device tokens
 */
export async function sendPushToTokens(
  tokens: string[],
  message: Message,
  opts: PushOptions = {},
): Promise<{ success: boolean; response?: any; error?: any }> {
  const cleanTokens = uniq(tokens);
  if (!cleanTokens.length) return { success: false, error: 'No tokens provided' };

  try {
    const ttl = opts.ttlSeconds ?? 60 * 60 * 24; // default 24h

    const response = await admin.messaging().sendEachForMulticast({
      tokens: cleanTokens,
      notification: {
        title: message.title,
        body: message.body || '',
      },
      data: opts.data, // ✅ IMPORTANT: React Native uses this for navigation
      android: {
        priority: 'high',
        ttl: ttl * 1000,
        collapseKey: opts.collapseKey,
        notification: opts.androidChannelId
          ? { channelId: opts.androidChannelId }
          : undefined,
      },
      apns: {
        headers: {
          'apns-priority': '10',
          'apns-expiration': String(Math.floor(Date.now() / 1000) + ttl),
          ...(opts.collapseKey ? { 'apns-collapse-id': opts.collapseKey } : {}),
        },
        payload: {
          aps: {
            sound: 'default',
          },
        },
      },
    });

    console.log('✅ Multicast push result:', response);
    return { success: true, response };
  } catch (error) {
    console.error('❌ Multicast push error:', error);
    return { success: false, error };
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
      data: opts.data,
      android: {
        priority: 'high',
        ttl: ttl * 1000,
        collapseKey: opts.collapseKey,
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
  } catch (error) {
    console.error('❌ Push error:', error);
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
  const tokens = (user.devices || []).map((d) => d.token);
  return sendPushToTokens(tokens, message, opts);
}
