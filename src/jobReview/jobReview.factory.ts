import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaginatedData } from 'src/common/interfaces';
import { paginationLimit } from 'src/config';

import { BaseFactory } from '../lib/base.factory';
import { Counter, JobReview } from '../lib/index';
import { JobReviewDto } from './jobReview.dto';

@Injectable()
export class JobReviewFactory extends BaseFactory {
  constructor(
    @InjectModel('JobReview') public readonly jobReviewModel: Model<JobReview>,
    @InjectModel('counters') public readonly countersModel: Model<Counter>,
  ) {
    super(countersModel);
  }

  async getAllJobReviews(params: any): Promise<PaginatedData> {
    const skip = parseInt(params.skip) || 0;
    const filter = { isActive: true };

    try {
      if (params.affiliate) {
        filter['affiliate'] = params.affiliate;
      }

      const count = await this.jobReviewModel.countDocuments(filter);

      const requests = await this.jobReviewModel
        .find(filter)
        .skip(skip)
        .limit(paginationLimit)
        .populate('customer')
        .populate('request')
        .sort({ createdAt: 'desc' })
        .exec();

      const result = requests.map(res => new JobReviewDto(res));

      const res = { result, count, skip };

      return res;
    } catch (error) {
      throw error;
    }
  }
}
