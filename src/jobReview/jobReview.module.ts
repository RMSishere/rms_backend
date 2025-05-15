import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { jobReviewSchema } from './jobReview.schema';
import { JobReviewController } from './jobReview.controller';
import { JobReviewFactory } from './jobReview.factory';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: 'JobReview', schema: jobReviewSchema }]),
    ],
    exports: [
        MongooseModule.forFeature([{ name: 'JobReview', schema: jobReviewSchema }]),
    ],
    controllers: [JobReviewController],
    providers: [JobReviewFactory]
})

export class JobReviewModule { }