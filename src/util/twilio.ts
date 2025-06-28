import twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

export const twilioVerifyService = client.verify.services(
  process.env.TWILIO_VERIFICATION_SERVICE_SID,
);
export const twilioNotifyService = client.notify.services(
  process.env.TWILIO_NOTIFY_SERVICE_A,
);

export const sendBulkTextMessage = async (
  body: string,
  numbersList: string[] = []
): Promise<any> => {
  try {
    if (!numbersList.length) return;

    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    const promises = numbersList
      .filter(number => !!number)
      .map(number =>
        client.messages.create({
          body,
          to: number,
          from: fromNumber,
        })
      );

    const responses = await Promise.all(promises);
    console.log(responses);
    return responses;
  } catch (err) {
    console.error(err);
    throw err;
  }
};
