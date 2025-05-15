import gcm = require("node-gcm");

const sender = new gcm.Sender(process.env.FCM_API_KEY);

const OS = {
  ANDROID: 'android',
  IOS: 'ios'
}

export interface Message {
  title: string
}

export interface Device {
  token: string,
  os: string,
}

export default class PushNotification {
  message: Message

  constructor(message: Message) {
    this.message = message;
  }

  send(devices: Array<Device>) {
    const androidDevices = devices
      .filter(device => device.os === OS.ANDROID);

    androidDevices.length && this.sendAndroid(androidDevices);

    const iosDevices = devices
      .filter(device => device.os === OS.IOS);

    iosDevices.length && this.sendIOS(iosDevices);
  }

  sendAndroid(devices: Array<Device>) {
    const deviceTokens = devices.map(device => device.token);

    const message = new gcm.Message({
      // data: { key1: 'msg1' },
      notification: {
        title: this.message.title,
        icon: "ic_launcher",
        body: "This is a notification that will be displayed if your app is in the background.",
      },
    });

    sender.send(message, { registrationTokens: deviceTokens }, function (err, response) {
      if (err) console.error(err, "notification err");
      else console.log(response, "notification res");
    });
  }

  sendIOS(devices: Array<Device>) {
    const deviceTokens = devices.map(device => device.token);
  }

}