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

//
export class IncomingChatDto extends BaseDto {
  constructor(chat: any) {
    super(chat);

    // sender / receiver may be populated docs or just ObjectId strings
    this.sender =
      chat?.sender && typeof chat.sender === 'object'
        ? (chat.sender as User)
        : chat?.sender ?? null;

    this.receiver =
      chat?.receiver && typeof chat.receiver === 'object'
        ? (chat.receiver as User)
        : chat?.receiver ?? null;

    this.text = chat?.text ?? '';

    // request can be populated doc or id
    this.messageFor = chat?.messageFor ?? null;
    this.messageForModel = chat?.messageForModel ?? null;

    // normalize file shape to { url, mime }
    this.file = {
      url: chat?.file?.url ?? '',
      mime: chat?.file?.mime ?? chat?.file?.type ?? '',
    };

    this.read = chat?.read ?? null;
  }

  // allow either populated user object or ObjectId string or null
  sender: User | string | null;
  receiver: User | string | null;

  text: string;
  messageFor: any;
  messageForModel: string | null;

  file: { url: string; mime: string };

  read: Date | null;
}
