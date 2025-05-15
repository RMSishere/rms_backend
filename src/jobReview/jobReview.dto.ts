import { BaseDto, JobReview, Request, User } from '../lib/index';

export class JobReviewDto extends BaseDto implements JobReview {
  constructor(jobReview: JobReview) {
    super(jobReview);

    this.customer = jobReview.customer;
    this.affiliate = jobReview.affiliate;
    this.request = jobReview.request;
    this.name = jobReview.name;
    this.professionalism = jobReview.professionalism;
    this.qualityOfAreaPressureWashed = jobReview.qualityOfAreaPressureWashed;
    this.handlingOfItemsSafely = jobReview.handlingOfItemsSafely;
    this.timeliness = jobReview.timeliness;
    this.locationCleanliness = jobReview.locationCleanliness;
    this.amountMade = jobReview.amountMade;
    this.advertising = jobReview.advertising;
    this.totalSatisfaction = jobReview.totalSatisfaction;
    this.communication = jobReview.communication;
    this.overAllRating = jobReview.overAllRating;
    this.comments = jobReview.comments;
    this.allowtestimonial = jobReview.allowtestimonial;
  }

  customer: User;
  affiliate: User;
  request: Request;
  name: string;
  professionalism: number;
  qualityOfAreaPressureWashed: number;
  handlingOfItemsSafely: number;
  timeliness: number;
  locationCleanliness: number;
  amountMade: number;
  advertising: number;
  totalSatisfaction: number;
  communication: number;
  overAllRating: number;
  comments: string;
  allowtestimonial: boolean;
}
