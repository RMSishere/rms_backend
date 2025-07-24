import { Base } from './base';

export interface BusinessProfile extends Base {
  businessImage: string;
  businessVideo: string;
  businessName: string;
  bio: string;
  foundingDate: Date;
  services: Array<string>;
  rating: number;
  ratingCount: number;
  serviceCoverageRadius: number;
  areaServices: Array<{ zipCode: string; lat: number; lng: number }>;
  nearByZipCodes: Array<string>;
  questionAnswers: any[];
  isApproved: boolean;
  approvedDate: Date;
  termsAccepted: boolean;
  allowMinimumPricing: boolean;

  // Add these optional fields for WP sync
  zip_code?: string;
  country_code?: string;
}

