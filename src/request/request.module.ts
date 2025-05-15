import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppointmentModule } from 'src/appointment/appointment.module';
import { JobReviewModule } from 'src/jobReview/jobReview.module';
import { ZipCodeModule } from 'src/zipCode/zipCode.module';
import { RequestController } from './request.controller';
import { RequestFactory } from './request.factory';
import { requestSchema } from './request.schema';
import { UsersModule } from 'src/users/users.module';
import { ScheduleJobsModule } from '../scheduleJob/scheduleJob.module';
import { ScheduleFactory } from 'src/scheduleJob/scheduleJob.factory';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'request', schema: requestSchema }]),
    AppointmentModule,
    ZipCodeModule,
    JobReviewModule,
    UsersModule,
    ScheduleJobsModule,
  ],
  exports: [
    MongooseModule.forFeature([{ name: 'request', schema: requestSchema }]),
    RequestFactory,
  ],
  controllers: [RequestController],
  providers: [RequestFactory],
})
export class RequestModule {}
