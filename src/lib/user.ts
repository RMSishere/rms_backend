import { Device } from 'src/util/pushNotification';
import { Base } from './base';
import { BusinessProfile } from './BusinessProfile';
import { NotificationSubscription } from './NotificationSubscription';

export interface User extends Base {
  firstName: string;
  lastName: string;
  businessProfile?: BusinessProfile;
  avatar: string;
  email: string;
  password?: string;
  countryCode: string;
  callingCode: string;
  phoneNumber: string;
  zipCode: number;
  role: number;
  isMobileVerfied: boolean;
  isEmailVerified: boolean;
  isActive: boolean;
  isSocialLogin: boolean;
  receiveMailForChat: boolean;
  devices: Array<Device>;
  isUserVerified?: boolean;
  notificationSubscriptions: NotificationSubscription[];
  termsAccepted?: boolean;
  blockedUsers: string[];
  deletedAt: Date;
  facebookProvider: {
    id: string;
    token: string;
  };
  wordpressProvider: {
    id: string;
    token: string;
  };
  dob: Date;
}
