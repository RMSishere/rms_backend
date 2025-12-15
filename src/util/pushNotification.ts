import admin from '../firebase/firebase-admin';

const OS = {
  ANDROID: 'android',
  IOS: 'ios',
};

export interface Message {
  title: string;
  body?: string;
}

export interface Device {
  token: string;
  os: string;
}

/**
 * CLASS-BASED (multiple devices)
 */
export default class PushNotification {
  message: Message;

  constructor(message: Message) {
    this.message = message;
  }

  async send(devices: Device[]) {
    const tokens = devices.map((d) => d.token);
    if (!tokens.length) return;

    await this.sendMultiple(tokens);
  }

  private async sendMultiple(tokens: string[]) {
    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens,
        notification: {
          title: this.message.title,
          body:
            this.message.body ||
            'This is a notification that will be displayed if your app is in the background.',
        },
        android: { priority: 'high' },
      });

      console.log('✅ Multicast push result:', response);
    } catch (error) {
      console.error('❌ Multicast push error:', error);
    }
  }
}

/**
 * FUNCTION-BASED (single token)
 * 👉 This is what your controller should call
 */
export async function sendPushByToken(
  token: string,
  message: Message,
): Promise<{ success: boolean; response?: any; error?: any }> {
  if (!token) {
    return { success: false, error: 'FCM token is required' };
  }

  try {
    const response = await admin.messaging().send({
      token,
      notification: {
        title: message.title,
        body:
          message.body ||
          'This is a notification that will be displayed if your app is in the background.',
      },
      android: {
        priority: 'high',
      },
    });

    console.log('✅ Push sent:', response);
    return { success: true, response };
  } catch (error) {
    console.error('❌ Push error:', error);
    return { success: false, error };
  }
}
