import { HelpMessage, BaseDto, User } from '../lib/index';

export class HelpMessageDto extends BaseDto implements HelpMessage {
  constructor(helpMessage: HelpMessage) {
    super(helpMessage);

    this.user = helpMessage.user;
    this.message = helpMessage.message;
    this.CLEANOUT = helpMessage.CLEANOUT;
  }

  user: User;
  message: string;
  CLEANOUT: boolean;
}
