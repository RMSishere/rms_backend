import { Base } from './base';

export interface UserMiscInfo extends Base {
  user: object;
  name: string;
  address: string;
  city: string;
  zipCode: string;
  homePhoneNumber: string;
  cellPhoneNumber: string;
  email: string;
  facebookProfile: string;
  instagramProfile: string;
  twiiterProfile: string;
  linkedinProfile: string;
  socialProfiles: Array<object>;
  gender: string;
  isMarried: boolean;
  gainingMoneyForOrgainization: boolean;
  isWidow: boolean;
  isMoving: boolean;
  isMovingIntoRetirementHome: boolean;
  isDownsizing: boolean;
  howDidYouFindUs: string;
  howDidYouFindUsDesc: string;
  ageGroup: string;
}
