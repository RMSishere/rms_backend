import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Interval } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import type { FilterQuery } from 'mongoose';

import { SCHEDULE_JOB, NOTIFICATION_TYPES } from 'src/config';
import { sendTemplateEmail } from 'src/util/sendMail';
import { NotificationFactory } from 'src/notification/notification.factory';
import { ScheduleJob } from '../lib/scheduleJob';
import { User } from '../lib/index';

// ✅ Push is now ONLY here
import { sendPushNotificationToUser } from 'src/util/notification.util';

@Injectable()
export class ScheduleFactory {
  constructor(
    @InjectModel('scheduleJobs')
    public readonly scheduleJobModel: Model<ScheduleJob>,

    // ✅ needed for inApp notifications
    public readonly notificationFactory: NotificationFactory,

    // ✅ needed to resolve recipients by userId(s)
    @InjectModel('users')
    public readonly usersModel: Model<any>,
  ) {}

  async addScheduleJob(job: ScheduleJob): Promise<ScheduleJob> {
    const newScheduleJob = new this.scheduleJobModel(job);
    return await newScheduleJob.save();
  }

  @Interval(30000)
  async performJobs() {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const jobs: ScheduleJob[] = await this.scheduleJobModel
      .find({
        jobDate: { $lt: now, $gte: dayAgo },
        completed: false,
      })
      .lean();

    if (!jobs?.length) return;

    for (const job of jobs) {
      try {
        await this.doJob(job);

        await this.scheduleJobModel.updateOne(
          { _id: job._id },
          { $set: { completed: true } },
        );
      } catch (err: any) {
        console.error('⚠️ Schedule job failed:', err?.message || err);
        // ❌ keep incomplete to retry next interval
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Helpers                                                            */
  /* ------------------------------------------------------------------ */

  private isUser(obj: any): obj is User {
    return (
      !!obj &&
      typeof obj === 'object' &&
      ('email' in obj || 'phoneNumber' in obj || '_id' in obj)
    );
  }

  private async resolveRecipients(
    recipients: User | User[] | string | string[],
  ): Promise<User[]> {
    if (!recipients) return [];

    // User[]
    if (Array.isArray(recipients) && recipients.length && this.isUser(recipients[0])) {
      return recipients as User[];
    }

    // User
    if (!Array.isArray(recipients) && this.isUser(recipients)) {
      return [recipients as User];
    }

    // IDs path
    const ids = (Array.isArray(recipients) ? recipients : [recipients]) as unknown[];

    const stringIds = ids.filter((x): x is string => typeof x === 'string' && x.length > 0);
    if (!stringIds.length) return [];

    const objectIds = stringIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    if (!objectIds.length) return [];

    const filter: FilterQuery<any> = { _id: { $in: objectIds } };
    const users = await this.usersModel.find(filter).lean();

    return (users || []) as any;
  }

  /* ------------------------------------------------------------------ */
  /* Job Execution                                                      */
  /* ------------------------------------------------------------------ */

  async doJob(job: ScheduleJob) {
    const jobData: any = job?.jobData || {};

    switch (job.jobType) {
      case SCHEDULE_JOB.SEND_MAIL: {
        // jobData: { to, template, emailData, from? }
        if (!jobData?.to || !jobData?.template) return;

        await sendTemplateEmail(
          jobData.to,
          jobData.template,
          jobData.emailData || {},
          jobData.from,
        );
        return;
      }

      case SCHEDULE_JOB.SEND_PUSH: {
        /**
         * Expected jobData:
         * {
         *   recipients: User | User[] | userId(string) | userId[](string[]),
         *   title: string,
         *   body: string,
         *   data?: Record<string,string>,
         *   quietHours?: boolean,
         *   timezone?: string,
         *   quietStart?: number,
         *   quietEnd?: number,
         *   skipIf?: boolean,
         *   // Optional inApp record too:
         *   inApp?: { message: object }
         * }
         */

        const recipients = jobData?.recipients;
        const title = jobData?.title;
        const body = jobData?.body;

        if (!recipients || !title || !body) return;

        // Resolve recipients to full user docs (to get devices[])
        const users = await this.resolveRecipients(recipients);
        if (!users.length) return;

        // ✅ Optional: store in-app notification (no push field involved)
        if (jobData?.inApp?.message) {
          await this.notificationFactory.sendInAppNotification(
            jobData.inApp.message,
            users,
            // Must be the same type shape your NotificationFactory expects
            NOTIFICATION_TYPES.JOB_STATUS_UPDATES,
          );
        }

        // ✅ Push via util (ONLY place for push now)
        for (const user of users) {
          await sendPushNotificationToUser(
            user,
            {
              title,
              body,
              data: jobData?.data || {},
            },
            {
              quietHours: jobData?.quietHours ?? true,
              timezone: jobData?.timezone || 'America/New_York',
              quietStart: jobData?.quietStart ?? 21,
              quietEnd: jobData?.quietEnd ?? 8,
              skipIf: jobData?.skipIf ?? false,
            },
          );
        }

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
