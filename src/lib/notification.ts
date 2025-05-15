import { Base } from './base';

export interface Notification extends Base {
  recipient?: Object; // user ref
  message: Object;
  type: string;
  read?: Date;
}
