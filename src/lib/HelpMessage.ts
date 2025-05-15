import { User } from '.';
import { Base } from './base';

export interface HelpMessage extends Base {
    user: User;
    message: string;
}
