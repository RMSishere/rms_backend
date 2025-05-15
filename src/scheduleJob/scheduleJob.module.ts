import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleFactory } from './scheduleJob.factory';
import { scheduleJobSchema } from './scheduleJob.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'scheduleJobs', schema: scheduleJobSchema },
    ]),
  ],
  providers: [ScheduleFactory],
  exports: [
    MongooseModule.forFeature([
      { name: 'scheduleJobs', schema: scheduleJobSchema },
    ]),
    ScheduleFactory,
  ],
})
export class ScheduleJobsModule {}
