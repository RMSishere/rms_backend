import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Interval } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { SCHEDULE_JOB, NOTIFICATION_TYPES } from 'src/config';
import { sendTemplateEmail } from 'src/util/sendMail';
import { ScheduleJob } from '../lib/scheduleJob';
import { NotificationFactory } from 'src/notification/notification.factory';

@Injectable()
export class ScheduleFactory {
  constructor(
    @InjectModel('scheduleJobs')
    public readonly scheduleJobModel: Model<ScheduleJob>,

    // ✅ add NotificationFactory
    public readonly notificationFactory: NotificationFactory,
  ) {}

  async addScheduleJob(job: ScheduleJob): Promise<ScheduleJob> {
    const newScheduleJob = new this.scheduleJobModel(job);
    return await newScheduleJob.save();
  }

  @Interval(30000)
  async performJobs() {
    const jobs: ScheduleJob[] = await this.scheduleJobModel
      .find({
        jobDate: {
          $lt: new Date(),
          $gte: new Date(new Date().setDate(new Date().getDate() - 1)),
        },
        completed: false,
      })
      .lean();

    if (!jobs?.length) return;

    for (const job of jobs) {
      try {
        // ✅ await job execution
        await this.doJob(job);

        // ✅ mark completed only if doJob succeeded
        await this.scheduleJobModel.updateOne(
          { _id: job._id },
          { $set: { completed: true } },
        );
      } catch (err: any) {
        // ❌ keep it incomplete so it retries next interval
        console.error('⚠️ Schedule job failed:', err?.message || err);
      }
    }
  }

  async doJob(job: ScheduleJob) {
    const jobData: any = job.jobData || {};

    switch (job.jobType) {
      case SCHEDULE_JOB.SEND_MAIL: {
        await sendTemplateEmail(
          jobData.to,
          jobData.template,
          jobData.emailData,
          jobData.from,
        );
        return;
      }

      // ✅ NEW: PUSH via NotificationFactory
      case SCHEDULE_JOB.SEND_PUSH: {
        /**
         * Expected jobData:
         * {
         *   recipients: User | User[] | userId(string) | userId[](string[]),
         *   title: string,
         *   body: string,
         *   data?: any,
         *   quietHours?: boolean,
         *   // optional inApp payload if you want it too:
         *   inApp?: { message: object }
         * }
         */
        const recipients = jobData.recipients;
        if (!recipients) return;

        const title = jobData.title;
        const body = jobData.body;
        if (!title || !body) return;

        await this.notificationFactory.sendNotification(
          recipients,
          // ✅ choose a suitable notification type (or make a dedicated one)
          NOTIFICATION_TYPES.JOB_STATUS_UPDATES,
          {
            // Optional: also store in-app row if you want
            ...(jobData.inApp?.message
              ? { inApp: { message: jobData.inApp.message } }
              : {}),

            // ✅ PUSH
            push: {
              title,
              body,
              data: jobData.data || {},
              quietHours: jobData.quietHours ?? true,
            },
          },
        );

        return;
      }

      default:
        return;
    }
  }

  async removeIncompleteJobs(condition: any) {
    return await this.scheduleJobModel.deleteMany({
      ...condition,
      completed: false,
    });
  }
}
