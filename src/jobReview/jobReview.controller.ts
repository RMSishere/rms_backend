import { Controller, Get, Param, Put, Query, Req } from "@nestjs/common";
import { JobReviewFactory } from './jobReview.factory';

@Controller('jobReview')
export class JobReviewController {
  constructor(public readonly jobReviewFactory: JobReviewFactory) { }

  @Get('')
  async getAllJobReviews(
    @Query() params: any
  ) {
    return this.jobReviewFactory.getAllJobReviews(
      params,
    );
  }
}