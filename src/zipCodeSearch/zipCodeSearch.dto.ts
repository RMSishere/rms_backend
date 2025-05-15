import { BaseDto, ZipCodeSearch } from '../lib/index';
import { User } from '../lib/user';

export class ZipCodeSearchDto extends BaseDto implements ZipCodeSearch {
  constructor(zipCodeSearch: ZipCodeSearch) {
    super(zipCodeSearch);
    this.zipCode = zipCodeSearch.zipCode;
    this.searchCount = zipCodeSearch.searchCount;
    this.affiliatesCount = zipCodeSearch.affiliatesCount;
    this.users = zipCodeSearch.users;
  }

  zipCode: string;
  searchCount: number;
  affiliatesCount: number;
  users: User[];
}
