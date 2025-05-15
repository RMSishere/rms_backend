import { UserMiscInfo, BaseDto } from '../lib/index';

export class UserMiscInfoDto extends BaseDto implements UserMiscInfo {
  constructor(userMiscInfo: UserMiscInfo) {
    super(userMiscInfo);

    this.user = userMiscInfo.user;
    this.name = userMiscInfo.name;
    this.address = userMiscInfo.address;
    this.city = userMiscInfo.city;
    this.zipCode = userMiscInfo.zipCode;
    this.homePhoneNumber = userMiscInfo.homePhoneNumber;
    this.cellPhoneNumber = userMiscInfo.cellPhoneNumber;
    this.email = userMiscInfo.email;
    this.facebookProfile = userMiscInfo.facebookProfile;
    this.instagramProfile = userMiscInfo.instagramProfile;
    this.twiiterProfile = userMiscInfo.twiiterProfile;
    this.linkedinProfile = userMiscInfo.linkedinProfile;
    this.gender = userMiscInfo.gender;
    this.isMarried = userMiscInfo.isMarried;
    this.gainingMoneyForOrgainization =
      userMiscInfo.gainingMoneyForOrgainization;
    this.isWidow = userMiscInfo.isWidow;
    this.isMoving = userMiscInfo.isMoving;
    this.isMovingIntoRetirementHome = userMiscInfo.isMovingIntoRetirementHome;
    this.isDownsizing = userMiscInfo.isDownsizing;
    this.howDidYouFindUs = userMiscInfo.howDidYouFindUs;
    this.howDidYouFindUsDesc = userMiscInfo.howDidYouFindUsDesc;
    this.ageGroup = userMiscInfo.ageGroup;
  }

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
