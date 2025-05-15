import { Base } from './base';
import { UserDto } from '../users/users.dto';
import { Appointment } from './Appointment';

export interface Request extends Base {
  zip?: string;
  deliveryTime?: string;
  whereToSell?: string;
  noOfItems?: string;
  typeOfItems?: object; // array
  itemsSizes?: Array<any>;
  itemQualities?: Array<any>;
  itemlocation?: object; // array
  needRealtor?: string;
  pressureWashItems?: object; // array
  state?: string;
  city?: string;
  movingFrom?: Array<string>;
  movingFromFloor?: number;
  movingTo?: Array<string>;
  movingToFloor?: number;
  extraItem?: string;
  organized?: object;
  images?: Array<any>; // array
  videos?: Array<any>; // array
  remark?: string;
  requesterOwner?: UserDto;
  hiredAffiliate?: UserDto;
  price?: number;
  status?: string;
  isActive?: boolean;
  requestType?: string;
  leads?: Array<any>;
  leadPrice?: number;
  items?: Array<object>;
  realtorConnectedWith?: string;
  affiliateNotes?: string;
  affiliateImages?: Array<string>;
  affiliateVideos?: Array<string>;
  jobDate?: Date;
  endDate?: Date;
  whatHelpNeed?: string;
  itemsWeight?: string;
  isFinalized?: boolean;
  appointments?: Appointment[];
  jobUpdates?: Array<any>;
}
