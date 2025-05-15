import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Interval } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { SCHEDULE_JOB } from 'src/config';
import { sendTemplateEmail } from 'src/util/sendMail';
import { ScheduleJob } from '../lib/scheduleJob';

@Injectable()
export class ScheduleFactory {
  constructor(
    @InjectModel('scheduleJobs')
    public readonly scheduleJobModel: Model<ScheduleJob>,
  ) {}

  async addScheduleJob(job: ScheduleJob): Promise<ScheduleJob> {
    try {
      const newScheduleJob = new this.scheduleJobModel(job);
      const result = await newScheduleJob.save();
      return result;
    } catch (err) {
      throw err;
    }
  }

  @Interval(30000)
  async performJobs() {
    // Get all the incomplete jobs of past 24 hours
    const jobs: ScheduleJob[] = await this.scheduleJobModel
      .find({
        jobDate: {
          $lt: new Date(),
          $gte: new Date(new Date().setDate(new Date().getDate() - 1)),
        },
        completed: false,
      })
      .lean();
    if (jobs?.length) {
      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        this.doJob(job);
        this.scheduleJobModel
          .updateOne(
            { _id: job._id },
            {
              $set: { completed: true },
            },
          )
          .exec();
      }
    }
  }

  async doJob(job: ScheduleJob) {

    const jobData: any = job.jobData;
    switch (job.jobType) {
      case SCHEDULE_JOB.SEND_MAIL:
        sendTemplateEmail(
          jobData.to,
          jobData.template,
          jobData.emailData,
          jobData.from,
        );
        return;

      default:
        break;
    }
  }

  async removeIncompleteJobs(condition: any) {
    const res = await this.scheduleJobModel.deleteMany({
      ...condition,
      completed: false,
    });
    return res;
  }
}
