export class APIMessage {
  constructor(apiMessage: string, messageType: APIMessageTypes) {
    this.apiMessage = apiMessage;
    this.messageType = messageType;
  }

  apiMessage: string;
  messageType: APIMessageTypes;
}

export enum APIMessageTypes {
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS',
}
