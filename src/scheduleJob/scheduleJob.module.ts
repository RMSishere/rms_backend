import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleFactory } from './scheduleJob.factory';
import { scheduleJobSchema } from './scheduleJob.schema';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'scheduleJobs', schema: scheduleJobSchema }]),

    // ✅ ensures NotificationFactory (and its models users/counters) are available here
    NotificationModule,
  ],
  providers: [ScheduleFactory],
  exports: [MongooseModule, ScheduleFactory],
})
export class ScheduleJobsModule {}
