import { BusinessProfile, NotificationSubscription } from 'src/lib';
import { Device } from 'src/util/pushNotification';
import { BaseDto } from '../lib/base.dto';
import { User } from '../lib/user';

export class UserDto extends BaseDto implements User {
  constructor(user: User) {
    super(user);
    this.firstName = user.firstName;
    this.lastName = user.lastName;
    this.avatar = user.avatar;
    this.businessProfile = user.businessProfile;
    this.email = user.email;
    this.countryCode = user.countryCode;
    this.callingCode = user.callingCode;
    this.phoneNumber = user.phoneNumber;
    this.zipCode = user.zipCode;
    this.role = user.role;
    this.isMobileVerfied = user.isMobileVerfied;
    this.isEmailVerified = user.isEmailVerified;
    this.devices = user.devices;
    this.passwordEncrypted = user?.passwordEncrypted;
    this.isActive = user.isActive;
    this.receiveMailForChat = user.receiveMailForChat;
    this.isSocialLogin = user.isSocialLogin;
    this.notificationSubscriptions = user.notificationSubscriptions;
    this.blockedUsers = user.blockedUsers;
    this.deletedAt = user.deletedAt;
    this.facebookProvider = user.facebookProvider;
    //this.appleProvider = user.appleProvider;
    this.wordpressProvider = user.wordpressProvider;
    this.dob = user.dob;
      this.index = user.index; // <-- Add this line

  }

  firstName: string;
  lastName: string;
  avatar: string;
  businessProfile?: BusinessProfile;
  email: string;
  countryCode: string;
  passwordEncrypted?: string;
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
  notificationSubscriptions: NotificationSubscription[];
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
    index?: number; // <-- Add this optional field

}
