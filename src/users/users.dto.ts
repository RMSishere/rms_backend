// src/users/users.dto.ts

import { BusinessProfile, NotificationSubscription } from 'src/lib';
import { Device } from 'src/util/pushNotification';
import { BaseDto } from '../lib/base.dto';
import { User } from '../lib/user';

export class SubscriptionDto {
  subscriptionId?: string;
  customerId?: string;
  type?: string;
  billingType?: string;
  status?: string;
  startedAt?: Date;
  expiresAt?: Date;
  jobRequestCountThisMonth?: number;
  pricingRequestsUsed?: number;
  customVideosUsed?: number;
  pitchReviewsUsed?: number;
  lastReset?: Date;

  constructor(subscription: any = {}) {
    this.subscriptionId = subscription.subscriptionId;
    this.customerId = subscription.customerId;
    this.type = subscription.type;
    this.billingType = subscription.billingType;
    this.status = subscription.status;
    this.startedAt = subscription.startedAt;
    this.expiresAt = subscription.expiresAt;
    this.jobRequestCountThisMonth = subscription.jobRequestCountThisMonth;
    this.pricingRequestsUsed = subscription.pricingRequestsUsed;
    this.customVideosUsed = subscription.customVideosUsed;
    this.pitchReviewsUsed = subscription.pitchReviewsUsed;
    this.lastReset = subscription.lastReset;
  }
}

export class UserDto extends BaseDto implements User {
  constructor(user?: User) {
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
    this.wordpressProvider = user.wordpressProvider;
    this.dob = user.dob;
    this.index = user.index;
    this.firsttime = user.firsttime;
    this.address = user.address;
    this.distance = user.distance;
    this.bio = user.bio;

    // ✅ Affiliate status from DB enum
    this.affiliateStatus = user.affiliateStatus;

    // ✅ Friendly client status
    this.status =
      this.affiliateStatus === 'APPROVED'
        ? 'approved'
        : this.affiliateStatus === 'DENIED'
        ? 'rejected'
        : 'pending';

    // --------------------------------------------------------------------
    // ✅ NEW FIELDS FOR GHL SYNC
    // --------------------------------------------------------------------
    this.ghlContactId = user.ghlContactId;
    this.ghlCustomerOpportunityId = user.ghlCustomerOpportunityId;
    this.ghlAffiliateOpportunityId = user.ghlAffiliateOpportunityId;
  }

  firstName: string;
  lastName: string;
  avatar: string;
  businessProfile?: BusinessProfile;
  email: string;
  countryCode: string;
  callingCode: string;
  passwordEncrypted?: string;
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
  facebookProvider: { id: string; token: string };
  wordpressProvider: { id: string; token: string };
  dob: Date;
  index?: number;
  firsttime?: number;
  address?: string;
  distance?: number;
  bio?: string;

  // --------------------------------------------------------------------
  // NEW FIELDS
  // --------------------------------------------------------------------
  affiliateStatus?: 'PENDING' | 'APPROVED' | 'DENIED';
  status?: 'pending' | 'approved' | 'rejected';

  ghlContactId?: string;
  ghlCustomerOpportunityId?: string;
  ghlAffiliateOpportunityId?: string;
}

export class User2Dto extends UserDto {
  constructor(user?: User) {
    super(user);
    this.subscription = user.subscription
      ? new SubscriptionDto(user.subscription)
      : undefined;
  }
  subscription?: SubscriptionDto;
}
