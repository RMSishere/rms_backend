// src/lib/user.ts

import { Device } from 'src/util/pushNotification';
import { Base } from './base';
import { BusinessProfile } from './BusinessProfile';
import { NotificationSubscription } from './NotificationSubscription';

// Subscription interface (unchanged)
interface Subscription {
  subscriptionId?: string;
  customerId?: string;
  type: string;
  billingType: 'MONTHLY' | 'YEARLY';
  status: 'ACTIVE' | 'INACTIVE' | 'CANCELED';
  startedAt: Date;
  expiresAt: Date;
  jobRequestCountThisMonth: number;
  pricingRequestsUsed: number;
  customVideosUsed: number;
  pitchReviewsUsed: number;
  lastReset: Date;
}

export interface User extends Base {
  firsttime?: number;
  passwordEncrypted?: string;
  firstName: string;
  lastName: string;
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
  index?: number;

  subscription?: Subscription;
  businessProfile?: BusinessProfile;

  // Newly added fields
  bio?: string;
  address?: string;
  distance?: number;

  // DB enum
  affiliateStatus?: 'PENDING' | 'APPROVED' | 'DENIED';

  // ✅ REQUIRED FOR GHL CODE
  ghlContactId?: string | null;
  ghlAffiliateOpportunityId?: string | null;
  ghlCustomerOpportunityId?: string | null;
}

