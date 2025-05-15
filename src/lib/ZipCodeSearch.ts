import { Base } from './base';
import { User } from '../lib/user';

export interface ZipCodeSearch extends Base {
  zipCode: string;
  searchCount: number;
  affiliatesCount: number;
  users: User[];
}
