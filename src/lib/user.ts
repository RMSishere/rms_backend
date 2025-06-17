import { Device } from 'src/util/pushNotification';
import { Base } from './base';
import { BusinessProfile } from './BusinessProfile';
import { NotificationSubscription } from './NotificationSubscription';

// Subscription interface (you already have this, but we'll include it in the User interface)
interface Subscription {
  subscriptionId?: string;  // Stripe Subscription ID
  customerId?: string;      // Stripe Customer ID
  type: string;             // Subscription Plan (e.g., Starter, Simplify, White Glove)
  billingType: 'MONTHLY' | 'YEARLY';  // Billing frequency
  status: 'ACTIVE' | 'INACTIVE' | 'CANCELED';  // Subscription status
  startedAt: Date;         // Subscription start date
  expiresAt: Date;         // Subscription expiration date
  jobRequestCountThisMonth: number;  // Number of job requests made this month
  pricingRequestsUsed: number;       // Number of pricing requests used
  customVideosUsed: number;          // Number of custom videos used
  pitchReviewsUsed: number;          // Number of pitch reviews used
  lastReset: Date;         // Last reset of usage limits
}

export interface User extends Base {
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

  // Add subscription field
  subscription?: Subscription;  // Optional, because it may not always be present

  // Add businessProfile
  businessProfile?: BusinessProfile;  // Optional, based on your schema
}
