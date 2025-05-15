import { Base } from './base';

export interface ZipCode extends Base {
    zipCode: string;
    leadCalculations: Array<object>;
}
