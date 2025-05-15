import twilio = require('twilio');

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

export const twilioVerifyService = twilioClient.verify.services(
  process.env.TWILIO_VERIFICATION_SERVICE_SID,
);
export const twilioNotifyService = twilioClient.notify.services(
  process.env.TWILIO_NOTIFY_SERVICE_A,
);

export const sendBulkTextMessage = async (
  body: string,
  numbersList: string[] = [],
): Promise<any> => {
  try {
    if (!numbersList.length) {
      return;
    }

    const chunk = 10000;
    const arrayOfBindings = [];
    const bindings = numbersList
      .filter(number => !!number)
      .map(number => {
        return JSON.stringify({ binding_type: 'sms', address: number });
      });

    for (let i = 0, j = bindings.length; i < j; i += chunk) {
      arrayOfBindings.push(bindings.slice(i, i + chunk));
    }

    const promises = [];

    for (let i = 0; i < arrayOfBindings.length; i++) {
      const bindings = arrayOfBindings[i];
      promises.push(
        twilioNotifyService.notifications.create({ toBinding: bindings, body }),
      );
    }

    let res;
    if (promises.length) {
      res = await Promise.all(promises);
    }

    return res;
  } catch (err) {
    console.error(err);

    throw err;
  }
};
