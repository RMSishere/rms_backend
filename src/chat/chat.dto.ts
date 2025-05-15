import { Chat, BaseDto, User } from '../lib/index';

export class ChatDto extends BaseDto implements Chat {
  constructor(chat: Chat) {
    super(chat);

    this.sender = chat.sender;
    this.receiver = chat.receiver;
    this.text = chat.text;
    this.messageFor = chat.messageFor;
    this.messageForModel = chat.messageForModel;
    this.file = chat.file;
    this.read = chat.read;
  }

  sender: User;
  receiver: User;
  text: string;
  messageFor: any;
  messageForModel: string;
  file: { url: string; type: string };
  read: Date;
}
