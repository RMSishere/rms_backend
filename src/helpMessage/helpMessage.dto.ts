import { HelpMessage, BaseDto, User } from '../lib/index';

export class HelpMessageDto extends BaseDto implements HelpMessage {
  constructor(helpMessage: HelpMessage) {
    super(helpMessage);

    this.user = helpMessage.user;
    this.message = helpMessage.message;
    this.cleanout = helpMessage.cleanout;
  }

  user: User;
  message: string;
  cleanout: boolean;
}
