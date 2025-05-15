import { BaseDto, ZipCode } from '../lib/index';

export class ZipCodeDto extends BaseDto implements ZipCode {
  constructor(zipCode: ZipCode) {
    super(zipCode);
    this.zipCode = zipCode.zipCode;
    this.leadCalculations = zipCode.leadCalculations;
  }

  zipCode: string;
  leadCalculations: Array<object>;
}
